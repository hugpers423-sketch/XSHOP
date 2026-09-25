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

export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}`, err);

  if (err instanceof ZodError) {
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
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details
    });
  }

  if (err.name === 'UnauthorizedError' || err.message === 'jwt expired') {
    return res.status(401).json({ error: 'Token expirado o inválido', code: 'UNAUTHORIZED' });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
    code: 'INTERNAL_ERROR'
  });
};

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);