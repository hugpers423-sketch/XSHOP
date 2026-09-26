// apps/web/app/api/wishlist/[productId]/route.ts
// Quita un producto de la lista de deseos e informa si estaba guardado.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** DELETE /api/wishlist/[productId] */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return jsonError('No autenticado', 401);
  if (!databaseConfigured()) return jsonError('Base de datos no configurada', 503);

  const { productId } = await params;
  if (!productId || productId.length > 64) return jsonError('productId inválido', 400);

  try {
    const dbUser = await ensureExternalUser({
      externalId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // deleteMany evita el error de Prisma cuando el registro no existe:
    // quitar algo que no está guardado no es un error para la UI.
    const result = await prisma.wishlistItem.deleteMany({
      where: { userId: dbUser.id, productId },
    });

    return NextResponse.json({ data: { productId, removed: result.count > 0 } });
  } catch {
    return jsonError('No se pudo quitar el producto', 503);
  }
}
