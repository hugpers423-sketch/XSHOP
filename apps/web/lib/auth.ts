import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from './prisma';
import { databaseConfigured } from './users';

const COOKIE = 'session';
const SESSION_DAYS = 30;
const SECRET = process.env.SESSION_SECRET || process.env.TOKEN_SECRET || 'xshop-local-session-secret-change-me';
if (process.env.NODE_ENV === 'production' && SECRET === 'xshop-local-session-secret-change-me') {
  throw new Error('SESSION_SECRET debe configurarse en producción');
}

export type AuthRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'MODERATOR';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  xCoins: number;
};

type SessionPayload = {
  user: AuthUser;
  exp: number;
};

function sign(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('base64url');
}

function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

function decodeSession(raw: string): SessionPayload | null {
  const [body, signature] = raw.split('.');
  if (!body || !signature) return null;

  const expected = sign(body);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(receivedBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.user?.id || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Crea una cookie de sesión firmada; no guarda contraseñas ni tokens en texto plano. */
export async function createSession(user: AuthUser): Promise<void> {
  const payload: SessionPayload = {
    user: { ...user, xCoins: Number(user.xCoins ?? 0) },
    exp: Date.now() + SESSION_DAYS * 86_400_000,
  };
  (await cookies()).set(COOKIE, encodeSession(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const sessionUser = decodeSession(raw)?.user;
  if (!sessionUser) return null;
  if (!databaseConfigured()) return sessionUser;

  try {
    // La cookie identifies la sesión; PostgreSQL es la fuente de verdad para
    // estado, rol, revocación y suspensión. El fallback por email permite
    // migrar cookies antiguas sin duplicar usuarios.
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: sessionUser.id }, { email: sessionUser.email.toLowerCase() }] },
      select: { id: true, name: true, email: true, role: true, xCoins: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      xCoins: user.xCoins,
    };
  } catch {
    // En desarrollo permite diagnosticar sin DB; en producción falla cerrado.
    return process.env.NODE_ENV === 'production' ? null : sessionUser;
  }
}

export async function requireUser(): Promise<AuthUser | Response> {
  const user = await getSessionUser();
  return user ?? Response.json({ error: 'No autenticado' }, { status: 401 });
}
