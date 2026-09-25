import { prisma } from '../config/database.js';
import { AppError } from './errorHandler.js';
import crypto from 'crypto';

const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-in-production';

// TTL de sesión: 30 días con expiración DESLIZANTE (se renueva con la
// actividad, ver touchSession): una sesión activa nunca caduca y una
// abandonada caduca a los 30 días
export const SESSION_TTL_DAYS = 30;
// Máximo de sesiones concurrentes por usuario (rotación de dispositivos)
const MAX_SESSIONS_PER_USER = 10;
// Ventana de gracia para renovar lastUsedAt/expiresAt: evita un UPDATE
// en cada request autenticado
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function hashToken(token) {
  // HMAC-SHA256 con secreto: aunque se filtre la tabla sessions, sin el
  // secreto no es posible resolver un token en bruto
  return crypto.createHmac('sha256', TOKEN_SECRET).update(token).digest('hex');
}

// Expiración deslizante: marca la última actividad y extiende la vigencia.
// Fire-and-forget: el request no debe esperar el UPDATE (un fallo puntual
// de BD no puede romper la autenticación)
export function touchSession(session) {
  const now = Date.now();
  const last = session.lastUsedAt?.getTime() ?? 0;
  if (now - last < TOUCH_INTERVAL_MS) return;
  prisma.session.update({
    where: { id: session.id },
    data: {
      lastUsedAt: new Date(now),
      expiresAt: new Date(now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
    }
  }).catch(() => {});
}

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Token de autorización requerido', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7);
    const tokenHash = hashToken(token);

    const session = await prisma.session.findUnique({
      where: { token: tokenHash },
      include: { user: true }
    });

    if (!session || session.expiresAt < new Date()) {
      throw new AppError('Sesión expirada o inválida', 401, 'UNAUTHORIZED');
    }

    touchSession(session);
    req.user = session.user;
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();

    const token = authHeader.slice(7);
    const tokenHash = hashToken(token);

    const session = await prisma.session.findUnique({
      where: { token: tokenHash },
      include: { user: true }
    });

    if (session && session.expiresAt > new Date()) {
      req.user = session.user;
      req.session = session;
    }
    next();
  } catch {
    next();
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('No autenticado', 401, 'UNAUTHORIZED'));
  if (!roles.includes(req.user.role)) {
    return next(new AppError('Permisos insuficientes', 403, 'FORBIDDEN'));
  }
  next();
};

export const generateToken = () => crypto.randomBytes(32).toString('hex');

export const createSession = async (userId, expiresInDays = SESSION_TTL_DAYS) => {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = new Date(now + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId, token: tokenHash, expiresAt, lastUsedAt: new Date(now) }
  });

  // Tope de sesiones concurrentes: descartar las más antiguas para que una
  // fuga de dispositivos no haga crecer la tabla sin límite
  const total = await prisma.session.count({ where: { userId } });
  if (total > MAX_SESSIONS_PER_USER) {
    const viejas = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: total - MAX_SESSIONS_PER_USER,
      select: { id: true }
    });
    await prisma.session.deleteMany({ where: { id: { in: viejas.map(s => s.id) } } });
  }

  return { token, expiresAt };
};

export const revokeSession = async (token) => {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { token: tokenHash } });
};

export const revokeAllUserSessions = async (userId) => {
  await prisma.session.deleteMany({ where: { userId } });
};

// Barrido de mantenimiento: la validación rechaza las sesiones caducadas
// en caliente, pero limpiar la tabla evita que crezca para siempre
export const sweepExpiredSessions = async () => {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } }
  });
  return count;
};
