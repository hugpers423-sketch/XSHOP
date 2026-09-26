// apps/web/app/api/notifications/route.ts
// Centro de notificaciones sobre la tabla Notification que ya existia.
// GET  → lista paginada con el total de no leídas.
// PATCH → marca como leídas (todas, o las_ids indicadas).

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

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

export async function GET(request: NextRequest) {
  const user = await resolveDbUser();
  if (!user) return jsonError('No autenticado', 401);
  if (!databaseConfigured()) return jsonError('Base de datos no configurada', 503);

  const limitValue = Number(request.nextUrl.searchParams.get('limit') || 20);
  const limit = Number.isFinite(limitValue) ? Math.min(50, Math.max(1, Math.floor(limitValue))) : 20;
  const onlyUnread = request.nextUrl.searchParams.get('unread') === '1';

  try {
    const where = { userId: user.id, ...(onlyUnread ? { isRead: false } : {}) };
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

    return NextResponse.json(
      {
        data: items.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          data: item.data,
          isRead: item.isRead,
          createdAt: item.createdAt,
        })),
        meta: { total: items.length, unread },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return jsonError('No se pudieron consultar las notificaciones', 503);
  }
}

/** PATCH /api/notifications  { ids?: string[], all?: boolean } */
export async function PATCH(request: NextRequest) {
  const user = await resolveDbUser();
  if (!user) return jsonError('No autenticado', 401);
  if (!databaseConfigured()) return jsonError('Base de datos no configurada', 503);

  const body = await request.json().catch(() => null) as { ids?: unknown; all?: unknown } | null;
  if (!body) return jsonError('Cuerpo inválido', 400);

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string' && id.length <= 64).slice(0, 50)
    : [];
  const all = body.all === true;

  if (!all && ids.length === 0) return jsonError('Indica ids o all:true', 400);

  try {
    // El filtro por userId impide que alguien marque como leidas las
    // notificaciones de otro usuario aunque conozca los ids.
    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
        ...(all ? {} : { id: { in: ids } }),
      },
      data: { isRead: true },
    });

    return NextResponse.json({ data: { updated: result.count } });
  } catch {
    return jsonError('No se pudieron actualizar las notificaciones', 503);
  }
}
