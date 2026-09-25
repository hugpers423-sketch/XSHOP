import 'server-only';

import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { prisma } from './prisma';
import type { AuthRole, AuthUser } from './auth';

export type ExternalProvider = 'PASSWORD' | 'GOOGLE';

export interface ExternalUserInput {
  externalId?: string | null;
  googleSub?: string | null;
  email: string;
  name: string;
  role?: AuthRole;
  avatar?: string | null;
}

/**
 * Sincroniza una identidad externa con la base de datos de producción.
 * El correo es la identidad estable; externalId/googleSub permiten revocar
 * y enlazar cuentas sin exponer tokens del proveedor en el frontend.
 */
export async function ensureExternalUser(input: ExternalUserInput): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  const externalId = input.externalId?.trim() || null;
  const googleSub = input.googleSub?.trim() || null;
  const requestedRole = normalizeRole(input.role);

  const identityFilters: Array<{ email: string } | { externalId: string } | { googleSub: string }> = [
    { email },
  ];
  if (externalId) identityFilters.push({ externalId });
  if (googleSub) identityFilters.push({ googleSub });

  const existing = await prisma.user.findFirst({ where: { OR: identityFilters } });
  const role = existing
    ? preservePrivilegedRole(existing.role, requestedRole)
    : requestedRole;

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: input.name.trim().slice(0, 120) || existing.name,
          avatar: input.avatar ?? existing.avatar,
          externalId: externalId ?? googleSub ?? existing.externalId,
          googleSub: googleSub ?? existing.googleSub,
          authProvider: googleSub ? 'GOOGLE' : existing.authProvider,
          role,
        },
      })
    : await prisma.user.create({
        data: {
          id: randomUUID(),
          email,
          name: input.name.trim().slice(0, 120) || email.split('@')[0],
          password: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
          externalId: externalId ?? googleSub,
          googleSub,
          authProvider: googleSub ? 'GOOGLE' : 'PASSWORD',
          role,
        },
      });

  return toAuthUser(user);
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function toAuthUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  xCoins: number;
}): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role as AuthRole),
    xCoins: Number(user.xCoins ?? 0),
  };
}

function normalizeRole(role?: AuthRole | string): AuthRole {
  if (role === 'SELLER' || role === 'ADMIN' || role === 'MODERATOR') return role;
  return 'BUYER';
}

function preservePrivilegedRole(current: string, requested: AuthRole): AuthRole {
  if (current === 'ADMIN' || current === 'MODERATOR' || current === 'SELLER') {
    return current as AuthRole;
  }
  return requested;
}
