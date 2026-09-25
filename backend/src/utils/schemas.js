import { z } from 'zod';

export const cardSchema = z.object({
  number: z.string().regex(/^\d{13,19}$/, 'Número de tarjeta inválido'),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Formato MM/AA requerido'),
  cvc: z.string().regex(/^\d{3,4}$/, 'CVC inválido'),
  holderName: z.string().min(2).max(50).transform(s => s.toUpperCase())
});

export const cardIdParam = z.object({
  id: z.string().cuid('ID de tarjeta inválido')
});

export const transactionSchema = z.object({
  // Monto en soles con hasta 2 decimales (céntimos). Antes llevaba .int(),
  // lo que rechazaba pagos fraccionarios (S/ 50.99) contradiciendo la
  // conversión de la ruta (amount*100 → centavos) y su /100 al mostrar
  amount: z.number().positive('Monto debe ser positivo').max(1000000, 'Monto máximo 1,000,000 PEN')
    .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Máximo 2 decimales'),
  description: z.string().min(3).max(200),
  cardId: z.string().cuid('Tarjeta inválida'),
  provider: z.enum(['stripe', 'mercadopago', 'yape', 'plin', 'manual']).optional(),
  // Reintento seguro: mismo key ⇒ misma transacción (opcional)
  idempotencyKey: z.string().min(8).max(128).optional()
});

export const postSchema = z.object({
  type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL', 'LIVE']).default('IMAGE'),
  content: z.string().min(1).max(2000),
  mediaUrl: z.string().url().optional().nullable(),
  mediaAspectRatio: z.number().positive().max(3).optional(),
  isLive: z.boolean().default(false)
});

export const postQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(['IMAGE', 'VIDEO', 'CAROUSEL', 'LIVE']).optional(),
  authorId: z.string().cuid().optional(),
  isLive: z.coerce.boolean().optional()
});

export const likeSchema = z.object({
  postId: z.string().cuid('Post inválido')
});

export const commentSchema = z.object({
  postId: z.string().cuid('Post inválido'),
  content: z.string().min(1).max(1000),
  parentId: z.string().cuid().optional()
});

export const reputationQuerySchema = z.object({
  userId: z.string().cuid().optional()
});

export const userRegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  phone: z.string().regex(/^\+?51\d{9}$/, 'Teléfono Perú inválido (+51XXXXXXXXX)').optional(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
  role: z.enum(['BUYER', 'SELLER']).default('BUYER')
});

export const userLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Métricas de reputación (F2): rangos estrictos + claves conocidas.
// El score de nivel se calcula con estas cifras (totalSales*2 +
// rating*100 + completionRate), así que nunca pueden llegar sin validar
// desde el cliente — de ahí el .strict() que rechaza claves extra
// (p. ej. intentar inyectar level/score directamente).
export const metricsSchema = z.object({
  totalSales: z.number().int().min(0).max(1000000).optional(),
  rating: z.number().min(0).max(5).optional(),
  responseTimeSec: z.number().int().min(0).max(86400).optional(),
  completionRate: z.number().min(0).max(100).optional(),
  disputesCount: z.number().int().min(0).max(1000000).optional(),
  returnsCount: z.number().int().min(0).max(1000000).optional()
}).strict();