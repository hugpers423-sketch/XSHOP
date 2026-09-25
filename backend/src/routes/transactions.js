import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { validate, validateParams, validateQuery } from '../middleware/validate.js';
import { transactionSchema, paginationSchema } from '../utils/schemas.js';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

export const transactionsRouter = Router();

// Cupo de pagos por usuario (más estrecho que el global): una cuenta
// comprometida no puede disparar cargos en bucle
const paymentsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  // Clave por usuario autenticado (IP solo como fallback anónimo)
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Límite de operaciones de pago alcanzado, intente más tarde' },
  standardHeaders: true,
  legacyHeaders: false
});

// MM/AA → vencimiento al final de ese mes (tarjeta válida durante su mes)
const esTarjetaExpirada = (expiry) => {
  const [mm, yy] = (expiry || '').split('/').map(Number);
  if (!mm || !yy || mm < 1 || mm > 12) return true; // formato ilegible ⇒ inválida
  const finDeMes = new Date(2000 + yy, mm); // mes 0 del mes siguiente
  return finDeMes <= new Date();
};

// Formato de respuesta estándar de una transacción (amount en PEN, no en centavos)
const formatearTx = (t, reincidente = false) => ({
  ...t,
  amount: t.amount / 100,
  card: t.card ? `${t.card.brand.toUpperCase()} •••• ${t.card.last4}` : null,
  ...(reincidente ? { idempotent: true } : {})
});

transactionsRouter.get('/', validateQuery(paginationSchema), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const where = { userId: req.user.id };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: { card: { select: { brand: true, last4: true } } }
    }),
    prisma.transaction.count({ where })
  ]);

  res.json({
    data: transactions.map(t => formatearTx(t)),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}));

transactionsRouter.post('/', paymentsLimiter, validate(transactionSchema), asyncHandler(async (req, res) => {
  const { amount, description, cardId, provider = 'manual' } = req.body;

  // Idempotencia: mismo Idempotency-Key ⇒ misma transacción. El cliente
  // puede reintentar un POST perdido sin provocar un cobro doble.
  // Se acepta en el body o en el header estándar Idempotency-Key
  const headerKey = req.get('Idempotency-Key');
  const idempotencyKey = req.body.idempotencyKey
    ?? (headerKey && headerKey.length >= 8 && headerKey.length <= 128 ? headerKey : undefined);

  const incluirCard = { include: { card: { select: { brand: true, last4: true } } } };

  if (idempotencyKey) {
    const existente = await prisma.transaction.findFirst({
      where: { userId: req.user.id, idempotencyKey },
      ...incluirCard
    });
    if (existente) return res.json(formatearTx(existente, true));
  }

  const card = await prisma.card.findFirst({
    where: { id: cardId, userId: req.user.id }
  });
  if (!card) throw new AppError('Tarjeta no encontrada', 404, 'CARD_NOT_FOUND');

  // Re-validar vigencia en el momento del cobro: la tarjeta pudo expirar
  // después de guardarse
  if (esTarjetaExpirada(card.expiry)) {
    throw new AppError('Tarjeta expirada', 400, 'CARD_EXPIRED');
  }

  const amountCents = Math.round(amount * 100);
  const providerRef = `xshop_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  let transaction;
  try {
    transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        cardId,
        amount: amountCents,
        description,
        status: 'PROCESSING',
        provider,
        providerRef,
        idempotencyKey,
        metadata: JSON.stringify({ cardBrand: card.brand, cardLast4: card.last4 })
      },
      ...incluirCard
    });
  } catch (err) {
    // Carrera de idempotencia: dos reintentos simultáneos con la misma key
    // — el índice único resuelve el conflicto y devolvemos la ganadora
    if (err?.code === 'P2002' && idempotencyKey) {
      const existente = await prisma.transaction.findFirst({
        where: { userId: req.user.id, idempotencyKey },
        ...incluirCard
      });
      if (existente) return res.json(formatearTx(existente, true));
    }
    throw err;
  }

  // Mock del proveedor: resolución asíncrona a los 1.5s (5% de rechazo).
  // Si el servidor se reinicia dentro de esa ventana, sweepStaleTransactions
  // (al arrancar) la resolverá para que no quede atascada en PROCESSING
  setTimeout(async () => {
    try {
      const approved = Math.random() > 0.05;
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: approved ? 'APPROVED' : 'DECLINED',
          metadata: JSON.stringify({ ...JSON.parse(transaction.metadata || '{}'), processedAt: new Date().toISOString() })
        }
      });

      if (approved) {
        await updateReputationOnSale(req.user.id, amountCents);
      }
    } catch (e) {
      console.error('Transaction processing error:', e);
    }
  }, 1500);

  res.status(201).json(formatearTx(transaction));
}));

transactionsRouter.get('/:id', validateParams(z.object({ id: z.string().cuid() })), asyncHandler(async (req, res) => {
  const tx = await prisma.transaction.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { card: { select: { brand: true, last4: true, holderName: true } } }
  });

  if (!tx) throw new AppError('Transacción no encontrada', 404, 'NOT_FOUND');

  res.json(formatearTx(tx));
}));

// Barrido de mantenimiento: transacciones atascadas en PROCESSING (p. ej.
// el servidor se reinició dentro de la ventana del mock) se resuelven como
// DECLINED para que no queden colgadas para siempre
export async function sweepStaleTransactions() {
  const corte = new Date(Date.now() - 5 * 60 * 1000);
  const { count } = await prisma.transaction.updateMany({
    where: { status: 'PROCESSING', updatedAt: { lt: corte } },
    data: { status: 'DECLINED' }
  });
  return count;
}

async function updateReputationOnSale(userId, amountCents) {
  const rep = await prisma.reputation.findUnique({ where: { userId } });
  if (!rep) return;

  const newSales = rep.totalSales + 1;
  const newScore = Math.min(1000, Math.round(newSales * 2 + rep.rating * 100 + rep.completionRate));

  let newLevel = rep.level;
  if (newScore >= 900) newLevel = 'MERCADO_LIDER';
  else if (newScore >= 750) newLevel = 'GOLD';
  else if (newScore >= 500) newLevel = 'SILVER';
  else if (newScore >= 250) newLevel = 'BRONZE';

  await prisma.$transaction([
    prisma.reputation.update({
      where: { userId },
      data: {
        totalSales: newSales,
        score: newScore,
        level: newLevel
      }
    }),
    prisma.reputationHistory.create({
      data: {
        reputationId: rep.id,
        type: 'SALE',
        amount: amountCents,
        buyerId: userId,
        buyerName: 'Cliente',
        status: 'completed'
      }
    })
  ]);
}
