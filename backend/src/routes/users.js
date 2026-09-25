import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { userRegisterSchema, userLoginSchema } from '../utils/schemas.js';
import { hashToken, createSession, revokeSession, revokeAllUserSessions, touchSession } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';

export const usersRouter = Router();

// Anti fuerza bruta: 10 intentos de login por minuto por IP. El límite
// global (300/15min) es demasiado laxo para credenciales; ventana corta
// para no castigar reintentos legítimos en desarrollo
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login, espere un minuto' },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Demasiados registros desde esta IP, intente más tarde' },
  standardHeaders: true,
  legacyHeaders: false
});

// Hash ficticio para igualar el tiempo de respuesta cuando el email no
// existe (evita enumerar usuarios midiendo la latencia del 401)
const DUMMY_HASH = bcrypt.hashSync('x-shop-timing-equalizer', 12);

usersRouter.post('/register', registerLimiter, validate(userRegisterSchema), asyncHandler(async (req, res) => {
  const { email, phone, name, password, role } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] }
  });
  if (existing) throw new AppError('Email o teléfono ya registrado', 409, 'DUPLICATE_USER');

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      phone,
      name,
      passwordHash,
      role
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  });

  if (role === 'SELLER') {
    await prisma.reputation.create({ data: { userId: user.id } });
  }

  const { token, expiresAt } = await createSession(user.id);
  res.status(201).json({ user, token, expiresAt });
}));

usersRouter.post('/login', loginLimiter, validate(userLoginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  // Comparación igualada en tiempo: si el usuario no existe se compara
  // contra el hash ficticio para no filtrar la existencia del email
  const valid = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !valid) throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');

  const { token, expiresAt } = await createSession(user.id);

  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe, token, expiresAt });
}));

usersRouter.post('/logout', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    await revokeSession(authHeader.slice(7));
  }
  res.json({ success: true });
}));

// Rotación de token: canjea la sesión vigente por una nueva e invalida la
// anterior de inmediato (reduce la ventana de uso de un token robado)
usersRouter.post('/refresh', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Token requerido', 401, 'UNAUTHORIZED');
  }
  const tokenViejo = authHeader.slice(7);
  const session = await prisma.session.findUnique({
    where: { token: hashToken(tokenViejo) }
  });
  if (!session || session.expiresAt < new Date()) {
    throw new AppError('Sesión expirada o inválida', 401, 'UNAUTHORIZED');
  }

  // Crear primero y revocar después: si la creación falla, el usuario
  // conserva su sesión original (nunca queda sin sesión válida)
  const nueva = await createSession(session.userId);
  await revokeSession(tokenViejo);
  res.json(nueva);
}));

// Cierre total: revoca TODAS las sesiones del usuario (todos los dispositivos)
usersRouter.post('/logout-all', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Token requerido', 401, 'UNAUTHORIZED');
  }
  const session = await prisma.session.findUnique({
    where: { token: hashToken(authHeader.slice(7)) }
  });
  if (session) await revokeAllUserSessions(session.userId);
  res.json({ success: true });
}));

usersRouter.get('/me', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Token requerido', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.slice(7);
  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { token: tokenHash },
    include: { user: { select: { id: true, email: true, name: true, role: true, avatarUrl: true, isVerified: true, createdAt: true } } }
  });

  if (!session || session.expiresAt < new Date()) {
    throw new AppError('Sesión expirada', 401, 'UNAUTHORIZED');
  }

  // Restaurar la app = actividad: renueva la expiración deslizante
  touchSession(session);

  res.json({ user: session.user });
}));

usersRouter.patch('/me', validate(z.object({
  name: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  phone: z.string().regex(/^\+?51\d{9}$/).optional().nullable()
})), asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: req.body,
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, phone: true, isVerified: true }
  });
  res.json({ user });
}));
