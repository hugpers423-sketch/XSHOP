// apps/web/lib/uploads.ts
import 'server-only';

import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_UPLOAD_BYTES, ALLOWED_VIDEO_TYPES, type VideoExtension } from './uploads-constants';

export { ALLOWED_VIDEO_TYPES, MAX_UPLOAD_BYTES, type VideoExtension };

/**
 * Almacenamiento local de videos subidos por vendedores.
 *
 * Decisión de arquitectura: los archivos viven en disco (carpeta `uploads/`)
 * y se sirven por streaming desde `/api/videos/stream/<id>.<ext>` con soporte
 * de Range. El modelo `Video` ya tiene `muxPlaybackId` para que esta capa
 * pueda reemplazarse por Mux sin cambiar la UI ni el feed.
 */

/** Carpeta de subidas, relativa a la raíz de `apps/web`. */
export function uploadsDir(): string {
  return path.join(process.cwd(), 'uploads');
}

export function publicVideoPath(fileName: string): string {
  return `/api/videos/stream/${fileName}`;
}

export function resolveVideoFile(fileName: string): string {
  return path.join(uploadsDir(), fileName);
}

export async function ensureUploadsDir(): Promise<void> {
  await mkdir(uploadsDir(), { recursive: true });
}

export async function saveVideoFile(fileName: string, bytes: Uint8Array): Promise<void> {
  await ensureUploadsDir();
  await writeFile(resolveVideoFile(fileName), bytes);
}

export async function videoFileSize(fileName: string): Promise<number | null> {
  try {
    const info = await stat(resolveVideoFile(fileName));
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

/** Reversa la escritura si la fila de base de datos no llega a crearse. */
export async function removeVideoFile(fileName: string): Promise<void> {
  try {
    await unlink(resolveVideoFile(fileName));
  } catch {
    // El archivo puede no existir: la limpieza es best-effort.
  }
}
