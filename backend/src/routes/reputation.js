import { Router } from 'express';
import { prisma } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { reputationQuerySchema, paginationSchema, metricsSchema } from '../utils/schemas.js';

export const reputationRouter = Router();

reputationRouter.get('/', validateQuery(reputationQuerySchema), asyncHandler(async (req, res) => {
  const { userId } = req.query;
  const targetUserId = userId || req.user.id;

  let reputation = await prisma.reputation.findUnique({
    where: { userId: targetUserId },
    include: { history: { orderBy: { createdAt: 'desc' }, take: 20 } }
  });

  if (!reputation) {
    reputation = await prisma.reputation.create({
      data: { userId: targetUserId },
      include: { history: true }
    });
  }

  const levelColors = {
    MERCADO_LIDER: { bg: 'linear-gradient(135deg, #ffd700, #ff8c00)', text: '#000' },
    GOLD: { bg: 'linear-gradient(135deg, #ffdf00, #ffb300)', text: '#000' },
    SILVER: { bg: 'linear-gradient(135deg, #c0c0c0, #808080)', text: '#000' },
    BRONZE: { bg: 'linear-gradient(135deg, #cd7f32, #b87333)', text: '#fff' },
    NEW: { bg: 'linear-gradient(135deg, #6c757d, #495057)', text: '#fff' }
  };

  res.json({
    ...reputation,
    levelColor: levelColors[reputation.level] || levelColors.NEW
  });
}));

reputationRouter.get('/leaderboard', validateQuery(paginationSchema), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const [reputations, total] = await Promise.all([
    prisma.reputation.findMany({
      orderBy: { score: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, name: true, avatarUrl: true, isVerified: true } } }
    }),
    prisma.reputation.count()
  ]);

  res.json({
    data: reputations,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}));

// F2 — Métricas de confianza: solo SELLER y con schema zod estricto.
// Antes cualquier usuario autenticado se asignaba totalSales/rating/
// completionRate a voluntad (se autoacuñaba MERCADO_LIDER) y el body
// crudo llegaba sin validar hasta Prisma.
reputationRouter.post('/update-metrics',
  requireRole('SELLER'),
  validate(metricsSchema),
  asyncHandler(async (req, res) => {
    const { totalSales, rating, responseTimeSec, completionRate, disputesCount, returnsCount } = req.body;
    const reputation = await prisma.reputation.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, totalSales: totalSales || 0, rating: rating || 0, responseTimeSec: responseTimeSec || 0, completionRate: completionRate || 100, disputesCount: disputesCount || 0, returnsCount: returnsCount || 0 },
      update: { totalSales: totalSales ?? undefined, rating: rating ?? undefined, responseTimeSec: responseTimeSec ?? undefined, completionRate: completionRate ?? undefined, disputesCount: disputesCount ?? undefined, returnsCount: returnsCount ?? undefined }
    });
    res.json(reputation);
  })
);
