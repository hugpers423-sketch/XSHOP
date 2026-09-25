// apps/web/app/api/lives/route.ts
// Persistencia real de lives en PostgreSQL para producción. El endpoint es
// público para lectura y exige sesión de vendedor para crear, mantener o cerrar.

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, type AuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';

const configuredStaleMs = Number(process.env.LIVE_STALE_AFTER_MS || 24 * 60 * 60_000);
const STALE_LIVE_MS = Number.isFinite(configuredStaleMs)
  ? Math.max(15 * 60_000, configuredStaleMs)
  : 24 * 60 * 60_000;
const VALID_TRANSPORTS = new Set(['hls', 'webrtc', 'livekit']);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function canPublish(user: AuthUser | null): user is AuthUser {
  return Boolean(user && ['SELLER', 'ADMIN', 'MODERATOR'].includes(user.role));
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

function serializeLive(live: {
  id: string;
  title: string;
  seller: { name: string };
  category: string;
  productName: string | null;
  productPrice: { toNumber: () => number } | null;
  roomName: string | null;
  streamUrl: string | null;
  transport: string;
  isLive: boolean;
  createdAt: Date;
  startedAt: Date;
  lastHeartbeatAt: Date;
  endedAt: Date | null;
}) {
  return {
    id: live.id,
    title: live.title,
    hostName: live.seller.name,
    hostAvatar: null,
    category: live.category,
    productName: live.productName,
    productPrice: live.productPrice?.toNumber() ?? null,
    roomName: live.roomName,
    streamUrl: live.streamUrl,
    transport: live.transport,
    isLive: live.isLive,
    viewers: 0,
    createdAt: live.createdAt.toISOString(),
    startedAt: live.startedAt.toISOString(),
    lastHeartbeatAt: live.lastHeartbeatAt.toISOString(),
    endedAt: live.endedAt?.toISOString() ?? null,
  };
}

export async function GET(request: NextRequest) {
  if (!databaseConfigured()) {
    if (process.env.NODE_ENV === 'production') return jsonError('La persistencia de lives no está configurada', 503);
    return NextResponse.json({ data: [], persistence: false }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const id = request.nextUrl.searchParams.get('id');
  const staleBefore = new Date(Date.now() - STALE_LIVE_MS);
  try {
    // Un proceso que muere no debe dejar un live fantasma para siempre.
    await prisma.liveStream.updateMany({
      where: { isLive: true, lastHeartbeatAt: { lt: staleBefore } },
      data: { isLive: false, endedAt: new Date(), updatedAt: new Date() },
    });

    if (id) {
      const live = await prisma.liveStream.findUnique({
        where: { id },
        include: { seller: { select: { name: true } } },
      });
      if (!live) return jsonError('Live no encontrado', 404);
      return NextResponse.json({ data: serializeLive(live) }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const lives = await prisma.liveStream.findMany({
      where: { isLive: true },
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: { seller: { select: { name: true } } },
    });
    return NextResponse.json(
      { data: lives.map(serializeLive), persistence: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return jsonError('No se pudo consultar la persistencia de lives', 503);
  }
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError('Inicia sesión para transmitir', 401);
  if (!canPublish(sessionUser)) return jsonError('Se requiere una cuenta de vendedor', 403);
  if (!databaseConfigured()) return jsonError('La persistencia de lives no está configurada', 503);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 140) : '';
  const category = typeof body?.category === 'string' ? body.category.trim().slice(0, 60) : 'General';
  const productName = typeof body?.product === 'string' ? body.product.trim().slice(0, 140) || null : null;
  const rawPrice = Number(body?.productPrice);
  const productPrice = productName && Number.isFinite(rawPrice) && rawPrice > 0
    ? Math.round(rawPrice * 100) / 100
    : null;
  const requestedTransport = typeof body?.transport === 'string' ? body.transport : 'livekit';
  const transport = VALID_TRANSPORTS.has(requestedTransport) ? requestedTransport : 'livekit';
  const streamUrl = typeof body?.streamUrl === 'string' ? body.streamUrl.trim().slice(0, 1000) : '';

  if (title.length < 5) return jsonError('Título inválido', 400);
  if (transport === 'hls' && streamUrl && !/^https?:\/\//i.test(streamUrl)) {
    return jsonError('La URL del live debe comenzar con http(s)://', 400);
  }
  if (productName && productPrice == null) return jsonError('Precio de producto inválido', 400);

  const id = randomUUID();
  const roomName = transport === 'livekit' ? `xshop-${id}` : null;
  try {
    const dbUser = await resolveDatabaseUser(sessionUser);
    if (!dbUser) return jsonError('No se pudo sincronizar la cuenta vendedora', 503);
    const live = await prisma.liveStream.create({
      data: {
        id,
        sellerId: dbUser.id,
        title,
        category: category || 'General',
        productName,
        productPrice,
        roomName,
        streamUrl: transport === 'hls' ? streamUrl || null : null,
        transport,
        isLive: true,
        startedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
      include: { seller: { select: { name: true } } },
    });
    return NextResponse.json({ data: serializeLive(live) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('No se pudo crear el live', 503);
  }
}

export async function PATCH(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError('Inicia sesión para administrar el live', 401);
  if (!canPublish(sessionUser)) return jsonError('Se requiere una cuenta de vendedor', 403);
  if (!databaseConfigured()) return jsonError('La persistencia de lives no está configurada', 503);

  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : '';
  const action = body?.action === 'end' ? 'end' : 'heartbeat';
  if (!id) return jsonError('id es requerido', 400);

  try {
    const dbUser = await resolveDatabaseUser(sessionUser);
    if (!dbUser) return jsonError('No se pudo sincronizar la cuenta vendedora', 503);
    const live = await prisma.liveStream.findUnique({ where: { id } });
    if (!live) return jsonError('Live no encontrado', 404);
    if (live.sellerId !== dbUser.id && !['ADMIN', 'MODERATOR'].includes(dbUser.role)) {
      return jsonError('No puedes modificar este live', 403);
    }
    const updated = await prisma.liveStream.update({
      where: { id },
      data: action === 'end'
        ? { isLive: false, endedAt: new Date(), lastHeartbeatAt: new Date() }
        : { lastHeartbeatAt: new Date() },
      include: { seller: { select: { name: true } } },
    });
    return NextResponse.json({ data: serializeLive(updated) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('No se pudo actualizar el live', 503);
  }
}

export async function DELETE(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError('Inicia sesión para detener el live', 401);
  if (!canPublish(sessionUser)) return jsonError('Se requiere una cuenta de vendedor', 403);
  if (!databaseConfigured()) return jsonError('La persistencia de lives no está configurada', 503);
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return jsonError('id es requerido', 400);

  try {
    const dbUser = await resolveDatabaseUser(sessionUser);
    if (!dbUser) return jsonError('No se pudo sincronizar la cuenta vendedora', 503);
    const live = await prisma.liveStream.findUnique({ where: { id } });
    if (!live) return jsonError('Live no encontrado', 404);
    if (live.sellerId !== dbUser.id && !['ADMIN', 'MODERATOR'].includes(dbUser.role)) {
      return jsonError('No puedes detener este live', 403);
    }
    const ended = await prisma.liveStream.update({
      where: { id },
      data: { isLive: false, endedAt: new Date(), lastHeartbeatAt: new Date() },
      include: { seller: { select: { name: true } } },
    });
    return NextResponse.json({ data: serializeLive(ended) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('No se pudo detener el live', 503);
  }
}
