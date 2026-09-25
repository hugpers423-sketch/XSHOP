import { Router } from 'express';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(async (req, res) => {
  const dbStatus = await prisma.$queryRaw`SELECT 1`.then(() => 'healthy').catch(() => 'unhealthy');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    redis: process.env.REDIS_URL ? (globalThis.xstoreRedisReady ? 'healthy' : 'degraded') : 'disabled',
    version: '1.1.0'
  });
}));

healthRouter.get('/ready', asyncHandler(async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
}));

healthRouter.get('/live', (req, res) => {
  res.json({ alive: true });
});