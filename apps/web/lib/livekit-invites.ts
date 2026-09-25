import 'server-only';

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const INVITE_ISSUER = 'xshop-livekit';
const INVITE_AUDIENCE = 'livekit-audio-speaker';
const INVITE_TTL_SECONDS = 5 * 60;
const LOCAL_SECRET = 'xshop-local-livekit-invite-secret-change-me';

export interface AudioInviteClaims extends JWTPayload {
  type: 'audio-invite';
  roomName: string;
  sellerId: string;
  sellerIdentity: string;
  viewerIdentity: string;
}

function inviteSecret(): Uint8Array {
  const configured = process.env.LIVEKIT_AUDIO_INVITE_SECRET
    || process.env.SESSION_SECRET
    || process.env.TOKEN_SECRET;
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('LIVEKIT_AUDIO_INVITE_SECRET o SESSION_SECRET deben estar configurados');
  }
  return new TextEncoder().encode(configured || LOCAL_SECRET);
}

/** Emite una invitación breve y firmada para publicar solo micrófono. */
export async function issueAudioInvite(input: {
  roomName: string;
  sellerId: string;
  sellerIdentity: string;
  viewerIdentity: string;
}): Promise<{ inviteToken: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const claims: AudioInviteClaims = {
    type: 'audio-invite',
    roomName: input.roomName,
    sellerId: input.sellerId,
    sellerIdentity: input.sellerIdentity,
    viewerIdentity: input.viewerIdentity,
  };
  const inviteToken = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(INVITE_ISSUER)
    .setAudience(INVITE_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + INVITE_TTL_SECONDS)
    .sign(inviteSecret());

  return {
    inviteToken,
    expiresAt: (now + INVITE_TTL_SECONDS) * 1000,
  };
}

export async function verifyAudioInvite(
  inviteToken: string,
  roomName: string,
): Promise<AudioInviteClaims | null> {
  try {
    const { payload } = await jwtVerify(inviteToken, inviteSecret(), {
      issuer: INVITE_ISSUER,
      audience: INVITE_AUDIENCE,
    });
    if (
      payload.type !== 'audio-invite'
      || typeof payload.roomName !== 'string'
      || payload.roomName !== roomName
      || typeof payload.sellerId !== 'string'
      || typeof payload.sellerIdentity !== 'string'
      || typeof payload.viewerIdentity !== 'string'
    ) return null;
    return {
      type: 'audio-invite',
      roomName: payload.roomName,
      sellerId: payload.sellerId,
      sellerIdentity: payload.sellerIdentity,
      viewerIdentity: payload.viewerIdentity,
    };
  } catch {
    return null;
  }
}
