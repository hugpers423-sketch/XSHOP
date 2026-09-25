import { NextResponse } from 'next/server';
import { createSession, type AuthRole, type AuthUser } from '@/lib/auth';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';
import { isValidEmail, passwordStrength } from '@/lib/validate';

const AUTH_API_URL = process.env.AUTH_API_URL || 'http://127.0.0.1:3001';

function normalizeRole(role: string): AuthRole {
  if (role === 'SELLER' || role === 'ADMIN' || role === 'MODERATOR') return role;
  return 'BUYER';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
  } | null;

  if (!body || typeof body.name !== 'string' || body.name.trim().length < 3) {
    return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
  }
  if (typeof body.email !== 'string' || !isValidEmail(body.email)) {
    return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
  }
  if (typeof body.password !== 'string' || passwordStrength(body.password).score < 2) {
    return NextResponse.json({ error: 'Contraseña muy débil' }, { status: 400 });
  }

  const role: AuthRole = body.role === 'SELLER' ? 'SELLER' : 'BUYER';
  try {
    const response = await fetch(`${AUTH_API_URL}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        password: body.password,
        role,
      }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: data.error || 'No se pudo crear la cuenta' }, { status: response.status });
    }

    const backendUser = {
      id: String(data.user.id),
      name: String(data.user.name),
      email: String(data.user.email),
      role: String(data.user.role),
    };
    let user: AuthUser = {
      id: backendUser.id,
      name: backendUser.name,
      email: backendUser.email,
      role: normalizeRole(backendUser.role),
      xCoins: 0,
    };
    if (databaseConfigured()) {
      try {
        user = await ensureExternalUser({
          externalId: backendUser.id,
          email: backendUser.email,
          name: backendUser.name,
          role: normalizeRole(backendUser.role),
        });
      } catch {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: 'La base de datos de usuarios no está disponible' }, { status: 503 });
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Configura DATABASE_URL para autenticación de producción' }, { status: 503 });
    }
    await createSession(user);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo conectar con el servicio de usuarios. Inicia el backend en el puerto 3001.' },
      { status: 503 }
    );
  }
}
