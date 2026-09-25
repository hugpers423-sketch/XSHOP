// apps/web/app/api/videos/route.ts
// Feed de Reels persistente: lista videos READY y permite subirlos como vendedor.
// El archivo se guarda en disco (apps/web/uploads) y se sirve con Range desde
// /api/videos/stream/<id>.<ext> para que el navegador pueda hacer seek.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { databaseConfigured, ensureExternalUser } from '@/lib/users';
import { videoToReel, type VideoForFeed } from '@/lib/reels';
import { ALLOWED_VIDEO_TYPES, MAX_UPLOAD_BYTES, type VideoExtension } from '@/lib/uploads-constants';
import { newVideoFileName } from '@/lib/video-file';
import { publicVideoPath, removeVideoFile, saveVideoFile } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const UPLOAD_ROLES = ['SELLER', 'ADMIN', 'MODERATOR'];

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Consulta los videos listos para el feed, del más nuevo al más viejo. */
export async function GET(request: NextRequest) {
  if (!databaseConfigured()) {
    return NextResponse.json({ data: [], persistence: false });
  }

  const limitValue = Number(request.nextUrl.searchParams.get('limit') || 24);
  const take = Number.isFinite(limitValue) ? Math.min(50, Math.max(1, Math.floor(limitValue))) : 24;

  try {
    const videos = await prisma.video.findMany({
      where: { status: 'READY' },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        author: { select: { id: true, name: true } },
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            compareAtPrice: true,
            stock: true,
            images: { orderBy: { position: 'asc' }, select: { url: true } },
            variants: { select: { id: true, name: true, price: true, stock: true } },
            seller: { select: { id: true, name: true } },
          },
        },
      },
    });

    const data = videos.map((video) => videoToReel(video as unknown as VideoForFeed));
    return NextResponse.json(
      { data, meta: { total: data.length, persistence: true } },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return jsonError('No se pudo consultar el feed de videos', 503);
  }
}

/**
 * Subida de video del vendedor (multipart/form-data).
 * Campos: file (video), caption, hashtags, productId, durationSec.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !UPLOAD_ROLES.includes(user.role)) {
    return jsonError('Se requiere una cuenta de vendedor', 403);
  }
  if (!databaseConfigured()) return jsonError('Base de datos no configurada', 503);

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError('Formulario inválido', 400);

  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('Falta el archivo de video', 400);
  if (file.size === 0) return jsonError('El archivo está vacío', 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError(`El video supera el límite de ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`, 413);
  }

  const mime = file.type.toLowerCase();
  const extension = ALLOWED_VIDEO_TYPES[mime as keyof typeof ALLOWED_VIDEO_TYPES];
  if (!extension) {
    return jsonError('Formato no permitido. Usa MP4, WebM, MOV o M4V', 415);
  }

  const caption = typeof form.get('caption') === 'string'
    ? String(form.get('caption')).trim().slice(0, 220)
    : '';
  if (caption.length < 3) return jsonError('Escribe un texto de al menos 3 caracteres', 400);

  const hashtags = typeof form.get('hashtags') === 'string'
    ? String(form.get('hashtags'))
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length <= 30)
        .slice(0, 8)
    : [];

  const durationSec = Math.max(1, Math.min(600, Math.round(Number(form.get('durationSec')) || 15)));

  const productId = typeof form.get('productId') === 'string' ? String(form.get('productId')).trim() : '';
  if (!productId) return jsonError('Selecciona el producto que se vende en el video', 400);

  let product: { id: string } | null = null;
  try {
    product = await prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true },
    });
  } catch {
    return jsonError('No se pudo validar el producto', 503);
  }
  if (!product) return jsonError('El producto no existe o está inactivo', 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { id, fileName } = newVideoFileName(extension as VideoExtension);
  const url = publicVideoPath(fileName);

  try {
    await saveVideoFile(fileName, bytes);
  } catch {
    return jsonError('No se pudo guardar el archivo en el servidor', 500);
  }

  try {
    const dbUser = await ensureExternalUser({
      externalId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const video = await prisma.video.create({
      data: {
        id,
        url,
        caption,
        hashtags,
        durationSec,
        status: 'READY',
        authorId: dbUser.id,
        productId: product.id,
      },
    });

    return NextResponse.json(
      { data: { id: video.id, url: video.url, caption: video.caption, hashtags: video.hashtags, durationSec: video.durationSec } },
      { status: 201 }
    );
  } catch {
    // Si la base falla, el archivo no debe quedar huérfano en disco.
    await removeVideoFile(fileName);
    return jsonError('No se pudo registrar el video', 503);
  }
}
