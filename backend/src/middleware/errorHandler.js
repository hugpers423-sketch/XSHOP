import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * body-parser (express.json/urlencoded) y las capas de http-errors adjuntan un
 * status propio. Un cuerpo mal formado es un error del CLIENTE, no una caida
 * del servidor: reportarlo como 500 ensucia los logs y hace creer que la API
 * esta rota cuando solo llego una peticion invalida.
 */
function resolveClientError(err) {
  const status = Number(err?.status ?? err?.statusCode);
  if (!Number.isInteger(status) || status < 400 || status > 499) return null;
  if (err?.type === 'entity.parse.failed') {
    return { status, code: 'INVALID_JSON', message: 'El cuerpo de la petición no es JSON válido' };
  }
  if (err?.type === 'entity.too.large') {
    return { status, code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la petición es demasiado grande' };
  }
  return { status, code: 'BAD_REQUEST', message: 'Petición inválida' };
}

export const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    // Error del cliente: una linea, sin stack.
    console.warn(`[WARN] ${req.method} ${req.path} validacion: ${err.issues.map((i) => i.path.join('.')).join(', ') || 'payload'}`);
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'campo';
      return res.status(409).json({ error: `${field} ya existe`, code: 'DUPLICATE_ENTRY' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Recurso no encontrado', code: 'NOT_FOUND' });
    }
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      console.error(`[ERROR] ${req.method} ${req.path}`, err);
    } else {
      console.warn(`[WARN] ${req.method} ${req.path} ${err.code}: ${err.message}`);
    }
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details
    });
  }

  if (err.name === 'UnauthorizedError' || err.message === 'jwt expired') {
    return res.status(401).json({ error: 'Token expirado o inválido', code: 'UNAUTHORIZED' });
  }

  const clientError = resolveClientError(err);
  if (clientError) {
    console.warn(`[WARN] ${req.method} ${req.path} ${clientError.code} (${clientError.status})`);
    return res.status(clientError.status).json({ error: clientError.message, code: clientError.code });
  }

  // A partir de aqui si es un fallo real del servidor: stack completo.
  console.error(`[ERROR] ${req.method} ${req.path}`, err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
    code: 'INTERNAL_ERROR'
  });
};

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
