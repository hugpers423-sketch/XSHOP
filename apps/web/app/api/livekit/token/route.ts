import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getSessionUser } from '@/lib/auth';
import { verifyAudioInvite } from '@/lib/livekit-invites';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const ROOM_PATTERN = /^[a-zA-Z0-9_-]{3,120}$/;
// LiveKit espera el nombre del source en el claim JWT, no su valor numérico.
const LIVEKIT_MICROPHONE_SOURCE = 'microphone';

type TokenMode = 'publisher' | 'viewer' | 'speaker';

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return jsonError('LiveKit no está configurado. Añade LIVEKIT_API_KEY, LIVEKIT_API_SECRET y LIVEKIT_URL.', 503);
  }

  const body = await request.json().catch(() => null) as {
    roomName?: unknown;
    mode?: unknown;
    inviteToken?: unknown;
  } | null;
  const roomName = typeof body?.roomName === 'string' ? body.roomName.trim() : '';
  const mode: TokenMode | null = body?.mode === 'publisher' || body?.mode === 'viewer' || body?.mode === 'speaker'
    ? body.mode
    : null;
  const inviteToken = typeof body?.inviteToken === 'string' ? body.inviteToken : '';

  if (!ROOM_PATTERN.test(roomName)) return jsonError('roomName inválido', 400);
  if (!mode) return jsonError('mode inválido', 400);

  const user = await getSessionUser();
  if (mode === 'publisher' && (!user || !['SELLER', 'ADMIN', 'MODERATOR'].includes(user.role))) {
    return jsonError('Se requiere una cuenta de vendedor', 403);
  }
  if (mode === 'speaker' && !user) return jsonError('Inicia sesión para hablar con el vendedor', 401);

  if (mode === 'speaker') {
    const invite = await verifyAudioInvite(inviteToken, roomName);
    if (!invite) return jsonError('La invitación de audio no es válida o expiró', 403);
    try {
      const live = await prisma.liveStream.findUnique({
        where: { roomName },
        select: { isLive: true, transport: true },
      });
      if (!live || !live.isLive || live.transport !== 'livekit') {
        return jsonError('El live ya no está disponible', 403);
      }
    } catch {
      return jsonError('No se pudo validar el live', 503);
    }
  }

  const isPublisher = mode === 'publisher';
  const isSpeaker = mode === 'speaker';
  const identity = isPublisher && user
    ? `seller-${user.id}`
    : `viewer-${randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const videoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: isPublisher || isSpeaker,
    canSubscribe: true,
    // Los viewers need publicar data para decline/ack de una invitación; no publican pistas.
    canPublishData: true,
    ...(isSpeaker ? { canPublishSources: [LIVEKIT_MICROPHONE_SOURCE] } : {}),
  };
  const token = await new SignJWT({
    name: user?.name || 'X-STORE viewer',
    video: videoGrant,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(apiKey)
    .setSubject(identity)
    .setNotBefore(now)
    .setExpirationTime(now + (isSpeaker ? 10 * 60 : 2 * 60 * 60))
    .sign(new TextEncoder().encode(apiSecret));

  return NextResponse.json({
    token,
    url: livekitUrl,
    roomName,
    identity,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
