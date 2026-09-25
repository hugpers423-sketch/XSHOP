// apps/web/lib/video-file.ts
// Validadores puros del pipeline de video. Sin 'server-only' a propósito:
// son funciones deterministas y se prueban aisladas en video-file.test.ts.

import { randomUUID } from 'node:crypto';
import { ALLOWED_VIDEO_TYPES, type VideoExtension } from './uploads-constants';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIME_BY_EXTENSION: Record<VideoExtension, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  '3gp': 'video/3gpp',
};

export function isVideoExtension(value: string): value is VideoExtension {
  return Object.prototype.hasOwnProperty.call(MIME_BY_EXTENSION, value);
}

export function mimeForExtension(extension: VideoExtension): string {
  return MIME_BY_EXTENSION[extension];
}

export function newVideoFileName(extension: VideoExtension): { id: string; fileName: string } {
  const id = randomUUID();
  return { id, fileName: `${id}.${extension}` };
}

/**
 * Valida el nombre de archivo solicitado en la ruta de streaming.
 * Solo acepta `<uuid>.<ext>` conocida, lo que elimina traversals de path
 * y cualquier intento de servir un archivo que no sea un video subido.
 */
export function parseVideoFileName(
  raw: string
): { ok: true; id: string; fileName: string; extension: VideoExtension } | { ok: false } {
  const name = raw.trim().toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { ok: false };
  const id = name.slice(0, dot);
  const extension = name.slice(dot + 1);
  if (!UUID_PATTERN.test(id) || !isVideoExtension(extension)) return { ok: false };
  return { ok: true, id, fileName: `${id}.${extension}`, extension };
}

export type VideoRange = { start: number; end: number };

/**
 * Parsea `bytes=start-end` de forma defensiva. Devuelve null si la cabecera
 * es inválida, para que la ruta responda 416 en lugar de servir datos raros.
 */
export function parseByteRange(header: string, size: number): VideoRange | null {
  if (!Number.isFinite(size) || size <= 0) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  let start: number;
  let end: number;

  if (!rawStart) {
    // Sufijo: los últimos N bytes (`bytes=-500`).
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= size || end < start) return null;

  return { start, end: Math.min(end, size - 1) };
}
