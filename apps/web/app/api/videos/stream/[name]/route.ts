// apps/web/app/api/videos/stream/[name]/route.ts
// Streaming de los videos subidos por vendedores.
//
// Implementa HTTP Range (206 Partial Content) porque Safari e iOS no reproducen
// ni permiten hacer seek sin él. El nombre del archivo se valida contra un
// patrón estricto `<uuid>.<ext>`, por lo que no hay forma de leer rutas
// arbitrarias del disco.

import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { mimeForExtension, parseByteRange, parseVideoFileName } from '@/lib/video-file';
import { resolveVideoFile, videoFileSize } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const CHUNK_SIZE = 1024 * 1024;

function notFound() {
  return NextResponse.json({ error: 'Video no encontrado' }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const parsed = parseVideoFileName(decodeURIComponent(name));
  if (!parsed.ok) return notFound();

  const fileName = parsed.fileName;
  const size = await videoFileSize(fileName);
  if (size == null || size <= 0) return notFound();

  const contentType = mimeForExtension(parsed.extension);
  const rangeHeader = request.headers.get('range');

  if (!rangeHeader) {
    const stream = Readable.toWeb(
      createReadStream(resolveVideoFile(fileName), { highWaterMark: CHUNK_SIZE })
    );
    return new NextResponse(stream as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const range = parseByteRange(rangeHeader, size);
  if (!range) {
    return new NextResponse(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }

  const stream = Readable.toWeb(
    createReadStream(resolveVideoFile(fileName), {
      start: range.start,
      end: range.end,
      highWaterMark: CHUNK_SIZE,
    })
  );

  return new NextResponse(stream as ReadableStream, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(range.end - range.start + 1),
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
