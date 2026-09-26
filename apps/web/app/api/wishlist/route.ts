// apps/web/app/api/wishlist/route.ts
// Lista de deseos persistente sobre la tabla WishlistItem que ya existia.
// Solo lectura (GET) y alta (POST). El borrado vive en /api/wishlist/[productId].

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Resuelve el usuario de la base a partir de la sesion web. */
async function resolveDbUser() {
  const user = await getSessionUser();
  if (!user) return null;
  return ensureExternalUser({
    externalId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

/** GET /api/wishlist → productos guardados del usuario, del mas nuevo al mas viejo. */
export async function GET() {
  const user = await resolveDbUser();
  if (!user) return jsonError('No autenticado', 401);
  if (!databaseConfigured()) return jsonError('Base de datos no configurada', 503);

  try {
    const items = await prisma.wishlistItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            compareAtPrice: true,
            stock: true,
            location: true,
            images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
            seller: { select: { name: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: items.map((item) => ({
          id: item.id,
          addedAt: item.createdAt,
          product: {
            id: item.product.id,
            title: item.product.title,
            price: item.product.price.toNumber(),
            compareAtPrice: item.product.compareAtPrice?.toNumber() ?? null,
            stock: item.product.stock,
            location: item.product.location,
            image: item.product.images[0]?.url ?? '/icons/icon-192.png',
            seller: item.product.seller.name,
          },
        })),
        meta: { total: items.length },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return jsonError('No se pudo consultar la lista de deseos', 503);
  }
}

/** POST /api/wishlist { productId } → guarda un producto (idempotente). */
export async function POST(request: NextRequest) {
  const user = await resolveDbUser();
  if (!user) return jsonError('No autenticado', 401);
  if (!databaseConfigured()) return jsonError('Base de datos no configurada', 503);

  const body = await request.json().catch(() => null) as { productId?: unknown } | null;
  const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';
  if (!productId) return jsonError('Falta productId', 400);

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true },
    });
    if (!product) return jsonError('El producto no existe o está inactivo', 404);

    // upsert: guardar dos veces el mismo producto no debe fallar.
    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      create: { userId: user.id, productId: product.id },
      update: {},
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ data: { id: item.id, productId: product.id, addedAt: item.createdAt } }, { status: 201 });
  } catch {
    return jsonError('No se pudo guardar el producto', 503);
  }
}
