import { Router } from 'express';
import { prisma } from '../config/database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validate, validateParams } from '../middleware/validate.js';
import { cardSchema, cardIdParam, paginationSchema } from '../utils/schemas.js';
import { requireRole } from '../middleware/auth.js';

export const cardsRouter = Router();

cardsRouter.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = paginationSchema.parse(req.query);
  const [cards, total] = await Promise.all([
    prisma.card.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.card.count({ where: { userId: req.user.id } })
  ]);

  res.json({
    data: cards.map(c => ({ ...c, number: `**** **** **** ${c.last4}` })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}));

cardsRouter.post('/', validate(cardSchema), asyncHandler(async (req, res) => {
  const { number, expiry, cvc, holderName } = req.body;

  const luhnValid = (num) => {
    let sum = 0, alt = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let d = parseInt(num[i], 10);
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return sum % 10 === 0;
  };

  if (!luhnValid(number)) throw new AppError('Número de tarjeta inválido (Luhn)', 400, 'INVALID_CARD');

  const [mm, yy] = expiry.split('/');
  const expDate = new Date(2000 + parseInt(yy), parseInt(mm) - 1);
  if (expDate < new Date()) throw new AppError('Tarjeta expirada', 400, 'CARD_EXPIRED');

  const brand = number.startsWith('4') ? 'visa' :
    number.startsWith('5') || /^2[2-7]/.test(number) ? 'mastercard' :
    number.startsWith('3') ? 'amex' : 'unknown';

  const existingCount = await prisma.card.count({ where: { userId: req.user.id } });

  const card = await prisma.card.create({
    data: {
      userId: req.user.id,
      brand,
      last4: number.slice(-4),
      expiry,
      holderName,
      isDefault: existingCount === 0
    }
  });

  res.status(201).json({ ...card, number: `**** **** **** ${card.last4}` });
}));

cardsRouter.patch('/:id/default', validateParams(cardIdParam), asyncHandler(async (req, res) => {
  await prisma.$transaction([
    prisma.card.updateMany({
      where: { userId: req.user.id, isDefault: true },
      data: { isDefault: false }
    }),
    prisma.card.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { isDefault: true }
    })
  ]);

  res.json({ success: true });
}));

cardsRouter.delete('/:id', validateParams(cardIdParam), asyncHandler(async (req, res) => {
  const card = await prisma.card.findFirst({
    where: { id: req.params.id, userId: req.user.id }
  });

  if (!card) throw new AppError('Tarjeta no encontrada', 404, 'NOT_FOUND');

  const count = await prisma.card.count({ where: { userId: req.user.id } });
  if (count <= 1) throw new AppError('Debe mantener al menos una tarjeta', 400, 'MIN_CARDS');

  await prisma.card.delete({ where: { id: req.params.id } });

  if (card.isDefault) {
    const next = await prisma.card.findFirst({ where: { userId: req.user.id } });
    if (next) await prisma.card.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  res.json({ success: true });
}));