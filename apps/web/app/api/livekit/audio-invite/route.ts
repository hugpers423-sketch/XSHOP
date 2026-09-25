import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { issueAudioInvite } from '@/lib/livekit-invites';
import { prisma } from '@/lib/prisma';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';

export const runtime = 'nodejs';

const ROOM_PATTERN = /^[a-zA-Z0-9_-]{3,120}$/;
const VIEWER_IDENTITY_PATTERN = /^viewer-[a-zA-Z0-9_-]{1,110}$/;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return jsonError('Inicia sesión para invitar compradores', 401);
  if (!['SELLER', 'ADMIN', 'MODERATOR'].includes(sessionUser.role)) {
    return jsonError('Se requiere una cuenta de vendedor', 403);
  }
  if (!databaseConfigured()) return jsonError('La persistencia de lives no está configurada', 503);

  const body = await request.json().catch(() => null) as {
    roomName?: unknown;
    viewerIdentity?: unknown;
  } | null;
  const roomName = typeof body?.roomName === 'string' ? body.roomName.trim() : '';
  const viewerIdentity = typeof body?.viewerIdentity === 'string' ? body.viewerIdentity.trim() : '';
  if (!ROOM_PATTERN.test(roomName)) return jsonError('roomName inválido', 400);
  if (!VIEWER_IDENTITY_PATTERN.test(viewerIdentity)) return jsonError('viewerIdentity inválido', 400);

  try {
    const dbUser = await ensureExternalUser({
      externalId: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      role: sessionUser.role,
    });
    const live = await prisma.liveStream.findUnique({
      where: { roomName },
      select: { sellerId: true, isLive: true, transport: true },
    });
    if (!live || !live.isLive || live.transport !== 'livekit') {
      return jsonError('El live no está disponible', 404);
    }
    if (live.sellerId !== dbUser.id && !['ADMIN', 'MODERATOR'].includes(dbUser.role)) {
      return jsonError('No puedes invitar compradores a este live', 403);
    }

    const invite = await issueAudioInvite({
      roomName,
      sellerId: live.sellerId,
      sellerIdentity: `seller-${live.sellerId}`,
      viewerIdentity,
    });
    return NextResponse.json(invite, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return jsonError('No se pudo crear la invitación de audio', 503);
  }
}
