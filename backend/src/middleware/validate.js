import { ZodError } from 'zod';
import { AppError } from './errorHandler.js';

export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      throw err;
    }
    next(new AppError('Error de validación', 400, 'VALIDATION_ERROR'));
  }
};

export const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (err) {
    if (err instanceof ZodError) throw err;
    next(new AppError('Parámetros de consulta inválidos', 400, 'VALIDATION_ERROR'));
  }
};

export const validateParams = (schema) => (req, res, next) => {
  try {
    req.params = schema.parse(req.params);
    next();
  } catch (err) {
    if (err instanceof ZodError) throw err;
    next(new AppError('Parámetros de ruta inválidos', 400, 'VALIDATION_ERROR'));
  }
};