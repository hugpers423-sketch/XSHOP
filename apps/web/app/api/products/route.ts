// apps/web/app/api/products/route.ts
// Catálogo production backed by PostgreSQL. El fallback estático solo existe
// para una instalación local sin DATABASE_URL.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';

const LEGACY_PRODUCTS = [
  { id: 'c01', title: 'Audífonos Pro ANC', description: 'Cancelación de ruido ANC', price: 149.9, freeShipping: true, rating: 4.9, reviewCount: 1243, images: [{ url: '/icons/icon-192.png' }], seller: { name: 'AudioPerú' }, category: 'Tecnología' },
  { id: 'c02', title: 'Hoodie Oversize Premium', description: 'Algodón premium', price: 79.9, freeShipping: false, rating: 4.8, reviewCount: 892, images: [{ url: '/icons/icon-192.png' }], seller: { name: 'ModaLima' }, category: 'Moda' },
  { id: 'c03', title: 'Smartwatch AMOLED 1.43"', description: 'Pantalla AMOLED', price: 189, freeShipping: true, rating: 4.7, reviewCount: 654, images: [{ url: '/icons/icon-192.png' }], seller: { name: 'TechStore Lima' }, category: 'Tecnología' },
  { id: 'c04', title: 'Lámpara LED ambiente', description: 'Luz ambiental regulable', price: 59.9, freeShipping: false, rating: 4.6, reviewCount: 431, images: [{ url: '/icons/icon-192.png' }], seller: { name: 'HogarTotal' }, category: 'Hogar' },
  { id: 'c05', title: 'Mochila antirrobo Urban', description: 'Compartimento reforzado', price: 99, freeShipping: false, rating: 4.9, reviewCount: 1102, images: [{ url: '/icons/icon-192.png' }], seller: { name: 'UrbanGear' }, category: 'Moda' },
  { id: 'c06', title: 'Perfumé Ambar Noir 100ml', description: 'Aroma ambarado', price: 119.9, freeShipping: true, rating: 4.8, reviewCount: 765, images: [{ url: '/icons/icon-192.png' }], seller: { name: 'BellezaPE' }, category: 'Belleza' },
];

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function serializeProduct(product: {
  id: string;
  title: string;
  description: string;
  price: { toNumber: () => number };
  stock: number;
  rating: number;
  freeShipping?: boolean;
  images: Array<{ url: string }>;
  seller: { name: string } | null;
  category: { name: string } | null;
}) {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    price: product.price.toNumber(),
    stock: product.stock,
    rating: product.rating,
    reviewCount: 0,
    freeShipping: product.freeShipping ?? false,
    images: product.images.length ? product.images : [{ url: '/icons/icon-192.png' }],
    seller: { name: product.seller?.name || 'Vendedor X-STORE' },
    category: product.category?.name || 'General',
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = (params.get('q') || '').trim();
  const category = (params.get('category') || '').trim();
  const minPrice = Number(params.get('minPrice') || 0);
  const maxPrice = Number(params.get('maxPrice') || 999999);
  const pageValue = Number(params.get('page') || 1);
  const perPageValue = Number(params.get('perPage') || 20);
  const page = Number.isFinite(pageValue) ? Math.max(1, Math.floor(pageValue)) : 1;
  const perPage = Number.isFinite(perPageValue) ? Math.min(50, Math.max(1, Math.floor(perPageValue))) : 20;

  if (!databaseConfigured()) {
    if (process.env.NODE_ENV === 'production') return jsonError('Catálogo no configurado', 503);
    const filtered = LEGACY_PRODUCTS.filter((product) => {
      const text = `${product.title} ${product.description}`.toLowerCase();
      return (!query || text.includes(query.toLowerCase()))
        && (!category || product.category.toLowerCase() === category.toLowerCase())
        && product.price >= minPrice && product.price <= maxPrice;
    });
    const start = (page - 1) * perPage;
    return NextResponse.json({
      data: filtered.slice(start, start + perPage),
      meta: { total: filtered.length, page, perPage, totalPages: Math.ceil(filtered.length / perPage), hasNext: start + perPage < filtered.length, hasPrev: page > 1 },
    });
  }

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(query ? { OR: [{ title: { contains: query, mode: 'insensitive' } }, { description: { contains: query, mode: 'insensitive' } }] } : {}),
    ...(category ? { category: { name: { equals: category, mode: 'insensitive' } } } : {}),
    ...(Number.isFinite(minPrice) || Number.isFinite(maxPrice) ? { price: { gte: Number.isFinite(minPrice) ? minPrice : undefined, lte: Number.isFinite(maxPrice) ? maxPrice : undefined } } : {}),
  };

  try {
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { images: { orderBy: { position: 'asc' } }, seller: { select: { name: true } }, category: { select: { name: true } } },
      }),
      prisma.product.count({ where }),
    ]);
    return NextResponse.json({
      data: products.map(serializeProduct),
      meta: { total, page, perPage, totalPages: Math.ceil(total / perPage), hasNext: page * perPage < total, hasPrev: page > 1 },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('No se pudo consultar el catálogo', 503);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !['SELLER', 'ADMIN', 'MODERATOR'].includes(user.role)) return jsonError('Se requiere una cuenta de vendedor', 403);
  if (!databaseConfigured()) return jsonError('Catálogo no configurado', 503);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 2000) : '';
  const price = Number(body?.price);
  const compareAtPrice = Number(body?.compareAtPrice);
  const location = typeof body?.location === 'string' ? body.location.trim().slice(0, 240) : null;
  const imageUrls = Array.isArray(body?.images)
    ? body.images.filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)).slice(0, 8)
    : [];
  if (title.length < 2 || description.length < 2 || !Number.isFinite(price) || price <= 0) return jsonError('Producto inválido', 400);
  if (body?.compareAtPrice != null && (!Number.isFinite(compareAtPrice) || compareAtPrice <= price)) return jsonError('Precio comparativo inválido', 400);

  try {
    const dbUser = await ensureExternalUser({ externalId: user.id, email: user.email, name: user.name, role: user.role });
    const product = await prisma.product.create({
      data: {
        title,
        description,
        price: Math.round(price * 100) / 100,
        stock: Math.max(0, Math.min(100000, Number(body?.stock) || 1)),
        sellerId: dbUser.id,
        isActive: true,
        ...(Number.isFinite(compareAtPrice) && body?.compareAtPrice != null ? { compareAtPrice: Math.round(compareAtPrice * 100) / 100 } : {}),
        ...(location ? { location } : {}),
        ...(imageUrls.length ? { images: { create: imageUrls.map((url, position) => ({ url, position })) } } : {}),
      },
      include: { images: true, seller: { select: { name: true } }, category: { select: { name: true } } },
    });
    return NextResponse.json({ data: serializeProduct(product) }, { status: 201 });
  } catch {
    return jsonError('No se pudo crear el producto', 503);
  }
}
