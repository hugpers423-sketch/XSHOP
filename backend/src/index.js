import 'dotenv/config';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware, sweepExpiredSessions } from './middleware/auth.js';
import { cardsRouter } from './routes/cards.js';
import { transactionsRouter, sweepStaleTransactions } from './routes/transactions.js';
import { postsRouter } from './routes/posts.js';
import { reputationRouter } from './routes/reputation.js';
import { usersRouter } from './routes/users.js';
import { healthRouter } from './routes/health.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const allowedOrigins = Array.from(new Set([
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3200',
  'http://localhost:3200',
  ...(process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || []),
]));

app.disable('x-powered-by');

// La API nunca se expone directamente: siempre hay un proxy inverso delante
// (Tailscale Funnel en desarrollo, Caddy en produccion) y este proceso escucha
// en 127.0.0.1. Sin esto, Express ignora X-Forwarded-For, todas las peticiones
// sharean la IP del proxy y el rate limit por IP se vuelve inútil: un unico
// atacante podria bloquear a todos los usuarios a la vez.
//
// `1` = confiar en exactamente un salto. Nunca usar `true`: si el backend
// llegara a exponerse sin proxy, cualquier cliente podria falseificar la
// cabecera y saltarse los limites.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // la CSP aplica al HTML, lo sirve serve.mjs (:3000)
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// helmet no envía estas dos: Permissions-Policy desactiva capacidades de
// dispositivo que la API nunca usa; no-store impide que un proxy intermedio
// memorice respuestas con datos de usuario o tokens
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(cors({
  // Origen del frontend web; con .env se amplía vía CORS_ORIGIN.
  origin: allowedOrigins,
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────
// Realtime de Live Shopping y chat (Socket.IO)
// - El video puede viajar por HLS/MP4 (Mux, LiveKit, CDN o RTMP→HLS) o por
//   WebRTC cuando el vendedor transmite desde /seller/live/studio.
// - Este canal distribuye estado, chat, presencia, reacciones y señalización.
// - Es deliberadamente stateless en memoria para la demo; producción debe
//   sustituir rooms por Redis/DB y validar la sesión del socket.
// ─────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
  transports: ['websocket', 'polling'],
});

let redisPublisher = null;
let redisSubscriber = null;
let redisReady = false;

async function configureRedisAdapter() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    globalThis.xstoreRedisReady = false;
    console.log('ℹ️ Redis no configurado: Socket.IO opera en modo de una sola instancia.');
    return false;
  }

  const options = {
    url: redisUrl,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: false,
    },
  };
  redisPublisher = createClient(options);
  redisSubscriber = createClient(options);
  redisPublisher.on('error', (err) => console.error('Redis publisher error:', err.message));
  redisSubscriber.on('error', (err) => console.error('Redis subscriber error:', err.message));

  try {
    await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
    io.adapter(createAdapter(redisPublisher, redisSubscriber));
    redisReady = true;
    globalThis.xstoreRedisReady = true;
    console.log('✅ Redis conectado: Socket.IO distribuido entre instancias.');
    return true;
  } catch (err) {
    redisReady = false;
    globalThis.xstoreRedisReady = false;
    console.warn(`⚠️ Redis no disponible; se usará Socket.IO local: ${err.message}`);
    await Promise.allSettled([redisPublisher.quit(), redisSubscriber.quit()]);
    redisPublisher = null;
    redisSubscriber = null;
    if (process.env.REDIS_REQUIRED === 'true') throw err;
    return false;
  }
}

const liveRooms = new Map();
const livePublishers = new Map();
const chatRooms = new Map();

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getLiveRoom(streamId) {
  if (!liveRooms.has(streamId)) {
    liveRooms.set(streamId, {
      comments: [],
      likes: 0,
      pinned: null,
      viewers: new Map(),
    });
  }
  return liveRooms.get(streamId);
}

function getChatRoom(chatId) {
  if (!chatRooms.has(chatId)) chatRooms.set(chatId, { messages: [] });
  return chatRooms.get(chatId);
}

function liveState(room) {
  return {
    comments: room.comments.slice(-100),
    likes: room.likes,
    pinned: room.pinned,
    viewers: room.viewers.size,
  };
}

function leaveLiveRoom(socket) {
  const streamId = socket.data.liveStreamId;
  if (!streamId) return;
  const room = liveRooms.get(streamId);
  if (room) {
    room.viewers.delete(socket.id);
    io.to(`live:${streamId}`).emit('live:viewers', room.viewers.size);
  }
  socket.leave(`live:${streamId}`);
  socket.data.liveStreamId = null;
}

function leavePublisher(socket) {
  const streamId = socket.data.publisherStreamId;
  if (!streamId) return;
  if (livePublishers.get(streamId) === socket.id) livePublishers.delete(streamId);
  io.to(`live:${streamId}`).emit('live:publisher-offline', { streamId });
  socket.data.publisherStreamId = null;
}

function leaveChatRoom(socket) {
  const chatId = socket.data.chatId;
  if (!chatId) return;
  socket.leave(`chat:${chatId}`);
  socket.data.chatId = null;
}

io.on('connection', (socket) => {
  socket.on('live:join', ({ streamId: rawStreamId, userId: rawUserId } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    if (!streamId) return;
    leaveLiveRoom(socket);
    const room = getLiveRoom(streamId);
    socket.join(`live:${streamId}`);
    socket.data.liveStreamId = streamId;
    room.viewers.set(socket.id, cleanText(rawUserId, 120) || 'guest');
    socket.emit('live:state', liveState(room));
    io.to(`live:${streamId}`).emit('live:viewers', room.viewers.size);
    const publisherId = livePublishers.get(streamId);
    if (publisherId && publisherId !== socket.id) {
      socket.emit('live:publisher-online', { streamId, publisherId });
    }
  });

  socket.on('live:publish', ({ streamId: rawStreamId, userId: rawUserId } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    if (!streamId) return;
    leavePublisher(socket);
    livePublishers.set(streamId, socket.id);
    socket.data.publisherStreamId = streamId;
    socket.join(`live:${streamId}`);
    io.to(`live:${streamId}`).emit('live:publisher-online', {
      streamId,
      publisherId: socket.id,
      userId: cleanText(rawUserId, 120) || 'seller',
    });
  });

  socket.on('live:publish-stop', ({ streamId: rawStreamId } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    if (!streamId || socket.data.publisherStreamId !== streamId) return;
    leavePublisher(socket);
  });

  socket.on('live:viewer-ready', ({ streamId: rawStreamId } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    const publisherId = livePublishers.get(streamId);
    if (!streamId || !publisherId || publisherId === socket.id) return;
    io.to(publisherId).emit('live:viewer-ready', { streamId, viewerId: socket.id });
  });

  socket.on('live:offer', ({ streamId: rawStreamId, targetId, sdp } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    if (!streamId || !targetId || !sdp || livePublishers.get(streamId) !== socket.id) return;
    io.to(targetId).emit('live:offer', { streamId, publisherId: socket.id, sdp });
  });

  socket.on('live:answer', ({ streamId: rawStreamId, targetId, sdp } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    if (!streamId || !targetId || !sdp) return;
    io.to(targetId).emit('live:answer', { streamId, viewerId: socket.id, sdp });
  });

  socket.on('live:ice-candidate', ({ streamId: rawStreamId, targetId, candidate } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    if (!streamId || !targetId || !candidate) return;
    io.to(targetId).emit('live:ice-candidate', {
      streamId,
      candidate,
      ...(livePublishers.get(streamId) === socket.id
        ? { fromId: socket.id }
        : { publisherId: livePublishers.get(streamId) }),
    });
  });

  socket.on('live:comment', ({ streamId: rawStreamId, userId: rawUserId, text: rawText } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    const text = cleanText(rawText, 500);
    if (!streamId || !text) return;
    const room = getLiveRoom(streamId);
    const comment = {
      id: randomUUID(),
      userId: cleanText(rawUserId, 120) || 'guest',
      text,
      createdAt: new Date().toISOString(),
    };
    room.comments.push(comment);
    if (room.comments.length > 100) room.comments.shift();
    socket.to(`live:${streamId}`).emit('live:comment', comment);
  });

  socket.on('live:like', ({ streamId: rawStreamId } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    if (!streamId) return;
    const room = getLiveRoom(streamId);
    room.likes += 1;
    socket.to(`live:${streamId}`).emit('live:likes', room.likes);
  });

  socket.on('live:pin', ({ streamId: rawStreamId, productId: rawProductId } = {}) => {
    const streamId = cleanText(rawStreamId, 120);
    if (!streamId) return;
    const room = getLiveRoom(streamId);
    room.pinned = cleanText(rawProductId, 120) || null;
    socket.to(`live:${streamId}`).emit('live:pin', room.pinned);
  });

  socket.on('chat:join', ({ chatId: rawChatId } = {}) => {
    const chatId = cleanText(rawChatId, 120);
    if (!chatId) return;
    leaveChatRoom(socket);
    socket.join(`chat:${chatId}`);
    socket.data.chatId = chatId;
    const room = getChatRoom(chatId);
    socket.emit('chat:history', room.messages.slice(-100));
  });

  socket.on('chat:send', ({ chatId: rawChatId, message: rawMessage } = {}) => {
    const chatId = cleanText(rawChatId, 120);
    const message = rawMessage && typeof rawMessage === 'object' ? rawMessage : {};
    const content = cleanText(message.content, 1000);
    if (!chatId || !content) return;
    const room = getChatRoom(chatId);
    const outgoing = {
      id: cleanText(message.id, 100) || randomUUID(),
      senderId: cleanText(message.senderId, 120) || 'guest',
      content,
      createdAt: new Date().toISOString(),
      sharedProductId: cleanText(message.sharedProductId, 120) || undefined,
    };
    room.messages.push(outgoing);
    if (room.messages.length > 100) room.messages.shift();
    io.to(`chat:${chatId}`).emit('chat:message', outgoing);
  });

  socket.on('chat:typing', ({ chatId: rawChatId, userId: rawUserId } = {}) => {
    const chatId = cleanText(rawChatId, 120);
    if (!chatId) return;
    socket.to(`chat:${chatId}`).emit('chat:typing', { userId: cleanText(rawUserId, 120) || 'guest' });
  });

  socket.on('disconnect', () => {
    const streamId = socket.data.liveStreamId;
    const publisherId = streamId ? livePublishers.get(streamId) : null;
    if (streamId && publisherId && publisherId !== socket.id) {
      io.to(publisherId).emit('live:viewer-left', { streamId, viewerId: socket.id });
    }
    leavePublisher(socket);
    leaveLiveRoom(socket);
    leaveChatRoom(socket);
  });
});

// Límite global: 300 requests / 15 min / IP (los rutas sensibles aplican
// cupos más estrechos por encima de este: login 10/min, pagos 30/15min)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Demasiadas solicitudes, intente más tarde' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

app.use('/api/health', healthRouter);
app.use('/api/users', usersRouter);
app.use('/api/cards', authMiddleware, cardsRouter);
app.use('/api/transactions', authMiddleware, transactionsRouter);
app.use('/api/posts', authMiddleware, postsRouter);
app.use('/api/reputation', authMiddleware, reputationRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);

// Mantenimiento periódico: caducar sesiones viejas y resolver transacciones
// atascadas en PROCESSING (p. ej. por un reinicio del servidor)
async function mantenimiento() {
  try {
    const [sesiones, pendientes] = await Promise.all([
      sweepExpiredSessions(),
      sweepStaleTransactions()
    ]);
    if (sesiones || pendientes) {
      console.log(`🧹 Mantenimiento: ${sesiones} sesiones expiradas eliminadas, ${pendientes} transacciones resueltas`);
    }
  } catch (err) {
    console.error('Error en mantenimiento periódico:', err);
  }
}

async function startServer() {
  try {
    await configureRedisAdapter();
  } catch (err) {
    console.error('No se pudo iniciar Redis requerido:', err.message);
    process.exitCode = 1;
    return;
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`🚀 X-SHOP API running on http://localhost:${PORT}`);
    console.log(`📚 Health check: http://localhost:${PORT}/api/health`);
    mantenimiento(); // barrido inicial al arrancar
    setInterval(mantenimiento, 6 * 60 * 60 * 1000).unref(); // y cada 6 horas
  });
}

void startServer();

async function shutdown(signal) {
  console.log(`${signal}: cerrando X-SHOP API...`);
  await Promise.allSettled([
    redisPublisher?.quit(),
    redisSubscriber?.quit(),
  ]);
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

export default app;
