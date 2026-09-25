// apps/web/app/api/orders/route.ts
// Checkout real persistido en PostgreSQL. El pago Yape/Plin se coordina por
// WhatsApp con el número de soporte; no se simula ni se cobra una tarjeta aquí.

import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma, type OrderStatus, type PaymentStatus } from '@prisma/client';
import { getSessionUser, type AuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';

const SHIPPING_CENTS = 1500;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 20;
const SUPPORT_PHONE = (process.env.WHATSAPP_SUPPORT_PHONE || process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_PHONE || '51904918121').replace(/\D/g, '');

const orderInclude: Prisma.OrderInclude = {
  items: { orderBy: { id: 'asc' } },
  transaction: true,
  statusHistory: { orderBy: { createdAt: 'asc' } },
};
type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

const PAYMENT_METHODS = {
  yape: 'YAPE',
  plin: 'PLIN',
  transfer: 'BANK_TRANSFER',
  cash: 'CASH_ON_DELIVERY',
} as const;
type PaymentMethod = keyof typeof PAYMENT_METHODS;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function resolveDatabaseUser(user: AuthUser) {
  if (!databaseConfigured()) return null;
  return ensureExternalUser({
    externalId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

function orderNumber(): string {
  const now = new Date();
  const date = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  return `XS-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function paymentUrl(order: { orderNumber: string; total: Prisma.Decimal; items: Array<{ title: string; quantity: number; price: Prisma.Decimal }> }, method: PaymentMethod) {
  const lines = [
    '🛍️ *PEDIDO X-STORE — PAGO POR WHATSAPP*',
    `*Orden:* ${order.orderNumber}`,
    `*Método:* ${PAYMENT_METHODS[method]}`,
    ...order.items.map((item, index) => `${index + 1}. ${item.title} x${item.quantity}`),
    `*Total:* S/ ${order.total.toFixed(2)}`,
    '',
    'Enviaré el comprobante por este chat. El pedido queda pendiente hasta la validación del pago.',
  ];
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function paymentMethodKey(method: string): PaymentMethod {
  const found = Object.entries(PAYMENT_METHODS).find(([, value]) => value === method);
  return (found?.[0] as PaymentMethod | undefined) || 'yape';
}

function serializeOrder(order: OrderWithDetails) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      title: item.title,
      price: item.price.toNumber(),
      quantity: item.quantity,
    })),
    subtotal: order.subtotal.toNumber(),
    shipping: order.shipping.toNumber(),
    discount: order.discount.toNumber(),
    total: order.total.toNumber(),
    status: order.status,
    shippingAddress: order.shippingAddress,
    district: order.district,
    city: order.city,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    payment: order.transaction ? {
      method: order.transaction.method,
      status: order.transaction.status,
      reference: order.transaction.reference,
      proofImageUrl: order.transaction.proofImageUrl,
    } : null,
    paymentUrl: order.transaction && order.transaction.status === 'PENDING'
      ? paymentUrl(order, paymentMethodKey(order.transaction.method))
      : undefined,
    statusHistory: order.statusHistory.map((entry) => ({
      status: entry.status,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
    })),
  };
}

async function findProduct(productId: string) {
  const safeId = productId.trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(safeId)) return null;
  const existing = await prisma.product.findUnique({ where: { id: safeId } });
  if (existing) return existing;

  // Solo desarrollo: los productos del catálogo de demostración se materializan
  // en la BD para que el flujo de prueba use las mismas relaciones y APIs.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_CATALOG !== 'true') return null;
  const demoCatalog: Record<string, { title: string; description: string; price: number }> = {
    c01: { title: 'Audífonos Pro ANC', description: 'Cancelación de ruido ANC', price: 149.9 },
    c02: { title: 'Hoodie Oversize Premium', description: 'Algodón premium', price: 79.9 },
    c03: { title: 'Smartwatch AMOLED 1.43"', description: 'Pantalla AMOLED', price: 189 },
    c04: { title: 'Lámpara LED ambiente', description: 'Luz ambiental regulable', price: 59.9 },
    c05: { title: 'Mochila antirrobo Urban', description: 'Compartimento reforzado', price: 99 },
    c06: { title: 'Perfumé Ambar Noir 100ml', description: 'Aroma ambarado', price: 119.9 },
    p1: { title: 'Hoodie Oversize Premium', description: 'Algodón premium', price: 79.9 },
    p2: { title: 'Audífonos Pro ANC', description: 'Cancelación de ruido ANC', price: 149.9 },
  };
  const demo = demoCatalog[safeId];
  if (!demo) return null;
  const seller = await prisma.user.findFirst({ where: { role: 'SELLER' }, select: { id: true } });
  if (!seller) return null;
  return prisma.product.create({
    data: {
      id: safeId,
      title: demo.title,
      description: demo.description,
      price: demo.price,
      sellerId: seller.id,
      isActive: true,
    },
  });
}

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError('Inicia sesión para consultar tus pedidos', 401);
  if (!databaseConfigured()) return jsonError('La persistencia de pedidos no está configurada', 503);

  try {
    const dbUser = await resolveDatabaseUser(sessionUser);
    if (!dbUser) return jsonError('No se pudo sincronizar la cuenta', 503);
    const requestedId = request.nextUrl.searchParams.get('id');
    const requestedSellerId = request.nextUrl.searchParams.get('sellerId');
    const canSell = ['SELLER', 'ADMIN', 'MODERATOR'].includes(dbUser.role);
    const privileged = ['ADMIN', 'MODERATOR'].includes(dbUser.role);
    const where: Prisma.OrderWhereInput = requestedId
      ? { id: requestedId }
      : requestedSellerId && canSell
        ? { sellerId: privileged ? requestedSellerId : dbUser.id }
        : privileged
          ? {}
          : { buyerId: dbUser.id };

    if (requestedId) {
      const order = await prisma.order.findFirst({
        where: {
          ...where,
          ...(privileged ? {} : { OR: [{ buyerId: dbUser.id }, ...(canSell ? [{ sellerId: dbUser.id }] : [])] }),
        },
        include: orderInclude,
      });
      if (!order) return jsonError('Pedido no encontrado', 404);
      return NextResponse.json({ data: serializeOrder(order) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: orderInclude,
    });
    return NextResponse.json({ data: orders.map(serializeOrder), meta: { total: orders.length } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('No se pudieron consultar los pedidos', 503);
  }
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError('Inicia sesión para crear un pedido', 401);
  if (!databaseConfigured()) return jsonError('La persistencia de pedidos no está configurada', 503);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const shippingAddress = typeof body?.shippingAddress === 'string' ? body.shippingAddress.trim().slice(0, 240) : '';
  const district = typeof body?.district === 'string' ? body.district.trim().slice(0, 80) : null;
  const city = typeof body?.city === 'string' ? body.city.trim().slice(0, 80) : null;
  const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 500) : null;
  const requestedMethod = typeof body?.paymentMethod === 'string' ? body.paymentMethod : 'yape';
  const paymentMethod: PaymentMethod = requestedMethod in PAYMENT_METHODS
    ? requestedMethod as PaymentMethod
    : 'yape';
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const idempotencyCandidate = typeof body?.idempotencyKey === 'string'
    ? body.idempotencyKey.trim().slice(0, 128)
    : request.headers.get('Idempotency-Key')?.trim().slice(0, 128);
  const idempotencyKey = idempotencyCandidate || randomBytes(16).toString('hex');

  if (shippingAddress.length < 5) return jsonError('Dirección de entrega inválida', 400);
  if (!rawItems.length || rawItems.length > MAX_ITEMS) return jsonError('Carrito inválido', 400);

  const requestedItems = rawItems.map((raw) => {
    const item = raw as Record<string, unknown>;
    const rawQuantity = Number(item.quantity);
    const quantity = Number.isFinite(rawQuantity) ? Math.floor(rawQuantity) : 1;
    return {
      productId: typeof item.productId === 'string' ? item.productId : '',
      quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)),
    };
  });
  if (requestedItems.some((item) => !item.productId)) return jsonError('Carrito inválido', 400);

  try {
    const dbUser = await resolveDatabaseUser(sessionUser);
    if (!dbUser) return jsonError('No se pudo sincronizar la cuenta', 503);

    const existing = await prisma.order.findFirst({
      where: { buyerId: dbUser.id, idempotencyKey },
      include: orderInclude,
    });
    if (existing) return NextResponse.json({ data: { ...serializeOrder(existing), paymentUrl: paymentUrl(existing, paymentMethod) }, idempotent: true });

    const products = [] as Array<{ id: string; title: string; price: Prisma.Decimal; sellerId: string }>;
    for (const requested of requestedItems) {
      const product = await findProduct(requested.productId);
      if (!product) return jsonError(`Producto no encontrado: ${requested.productId}`, 404);
      if (!product.isActive || product.stock < requested.quantity) return jsonError(`Producto no disponible: ${requested.productId}`, 409);
      products.push(product);
    }
    const sellerIds = new Set(products.map((product) => product.sellerId));
    if (sellerIds.size !== 1) return jsonError('Por ahora un pedido debe pertenecer a un solo vendedor', 409);
    const sellerId = products[0].sellerId;
    const subtotalCents = products.reduce((sum, product, index) => sum + Math.round(product.price.toNumber() * 100) * requestedItems[index].quantity, 0);
    const totalCents = subtotalCents + SHIPPING_CENTS;
    const number = orderNumber();

    const order = await prisma.$transaction(async (tx) => {
      for (let index = 0; index < products.length; index += 1) {
        const reserved = await tx.product.updateMany({
          where: { id: products[index].id, isActive: true, stock: { gte: requestedItems[index].quantity } },
          data: { stock: { decrement: requestedItems[index].quantity } },
        });
        if (reserved.count !== 1) throw new Error('STOCK_CHANGED');
      }
      const created = await tx.order.create({
        data: {
          orderNumber: number,
          status: 'PENDING',
          subtotal: subtotalCents / 100,
          shipping: SHIPPING_CENTS / 100,
          discount: 0,
          total: totalCents / 100,
          shippingAddress,
          district,
          city,
          notes,
          idempotencyKey,
          buyerId: dbUser.id,
          sellerId,
          items: {
            create: products.map((product, index) => ({
              productId: product.id,
              title: product.title,
              price: product.price,
              quantity: requestedItems[index].quantity,
            })),
          },
          transaction: {
            create: {
              userId: dbUser.id,
              amount: totalCents / 100,
              method: PAYMENT_METHODS[paymentMethod],
              status: 'PENDING',
              reference: number,
              notes: 'Pago manual coordinado por WhatsApp; validar antes de liberar al vendedor.',
            },
          },
          statusHistory: { create: { status: 'PENDING', note: 'Pedido creado; esperando pago por WhatsApp.' } },
        },
        include: orderInclude,
      });
      return created;
    });

    return NextResponse.json({ data: { ...serializeOrder(order), paymentUrl: paymentUrl(order, paymentMethod) } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'STOCK_CHANGED') {
      return jsonError('El stock cambió; vuelve a revisar el carrito', 409);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return jsonError('Ya existe un pedido con esa clave de idempotencia', 409);
    }
    return jsonError('No se pudo crear el pedido', 503);
  }
}

export async function PATCH(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError('Inicia sesión para actualizar el pedido', 401);
  if (!databaseConfigured()) return jsonError('La persistencia de pedidos no está configurada', 503);
  const body = await request.json().catch(() => null) as { id?: unknown; status?: unknown; paymentStatus?: unknown; reference?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : request.nextUrl.searchParams.get('id') || '';
  const requestedStatus = typeof body?.status === 'string' ? body.status : '';
  const requestedPaymentStatus = typeof body?.paymentStatus === 'string' ? body.paymentStatus : '';
  const paymentReference = typeof body?.reference === 'string' ? body.reference.trim().slice(0, 120) : '';
  if (!id) return jsonError('id es requerido', 400);
  if (!requestedStatus && !requestedPaymentStatus) return jsonError('Indica un estado de pedido o pago', 400);

  const allowedOrderStatuses = new Set(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DISPUTED', 'REFUNDED']);
  const allowedPaymentStatuses = new Set(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']);
  if (requestedStatus && !allowedOrderStatuses.has(requestedStatus)) return jsonError('Estado de pedido inválido', 400);
  if (requestedPaymentStatus && !allowedPaymentStatuses.has(requestedPaymentStatus)) return jsonError('Estado de pago inválido', 400);

  try {
    const dbUser = await resolveDatabaseUser(sessionUser);
    if (!dbUser) return jsonError('No se pudo sincronizar la cuenta', 503);
    const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) return jsonError('Pedido no encontrado', 404);
    const privileged = ['ADMIN', 'MODERATOR'].includes(dbUser.role);
    const isSeller = order.sellerId === dbUser.id;
    const isBuyer = order.buyerId === dbUser.id;
    if (!isSeller && !isBuyer && !privileged) return jsonError('No puedes modificar este pedido', 403);
    if (requestedPaymentStatus && !privileged) return jsonError('Solo soporte/admin puede validar el pago', 403);
    if (requestedStatus) {
      const sellerStatuses = new Set(['CONFIRMED', 'PROCESSING', 'SHIPPED']);
      const buyerStatuses = new Set(['CANCELLED', 'DISPUTED']);
      if (!privileged && !(isSeller && sellerStatuses.has(requestedStatus)) && !(isBuyer && buyerStatuses.has(requestedStatus))) {
        return jsonError('No tienes permiso para ese cambio de estado', 403);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (requestedStatus && ['CANCELLED', 'REFUNDED'].includes(requestedStatus) && !['CANCELLED', 'REFUNDED'].includes(order.status)) {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }
      if (requestedStatus) {
        await tx.orderStatusHistory.create({ data: { orderId: id, status: requestedStatus as OrderStatus, note: 'Actualizado por el usuario autenticado.' } });
      }
      if (requestedPaymentStatus) {
        await tx.transaction.update({
          where: { orderId: id },
          data: { status: requestedPaymentStatus as PaymentStatus, ...(paymentReference ? { reference: paymentReference } : {}) },
        });
      }
      return tx.order.update({
        where: { id },
        data: requestedStatus ? { status: requestedStatus as OrderStatus } : {},
        include: orderInclude,
      });
    });
    return NextResponse.json({ data: serializeOrder(updated) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return jsonError('La referencia de pago ya existe', 409);
    }
    return jsonError('No se pudo actualizar el pedido', 503);
  }
}
