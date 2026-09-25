// apps/web/lib/uploads-constants.ts
// Constantes compartidas entre el servidor (subida/streaming) y el cliente
// (formulario de subida). Sin 'server-only' para poder importarse en la UI.

/** Tope defensivo: evita que una subida agote la memoria/disco del proceso. */
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

/** Solo formatos que los navegadores (iOS y Android) reproducen de forma nativa. */
export const ALLOWED_VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'video/3gpp': '3gp',
} as const;

export type VideoExtension = (typeof ALLOWED_VIDEO_TYPES)[keyof typeof ALLOWED_VIDEO_TYPES];
