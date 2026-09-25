// apps/web/lib/video-file.test.ts
// Pruebas aisladas de los validadores del pipeline de video.
// Sin base de datos, sin red y sin sistema de archivos.

import { describe, it, expect } from 'vitest';
import {
  isVideoExtension,
  mimeForExtension,
  newVideoFileName,
  parseByteRange,
  parseVideoFileName,
} from './video-file';

const VALID_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('parseVideoFileName', () => {
  it('acepta un uuid con extensión conocida', () => {
    const result = parseVideoFileName(`${VALID_ID}.mp4`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.id).toBe(VALID_ID);
      expect(result.extension).toBe('mp4');
    }
  });

  it('normaliza a minúsculas', () => {
    const result = parseVideoFileName(`${VALID_ID.toUpperCase()}.MP4`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fileName).toBe(`${VALID_ID}.mp4`);
  });

  it('rechaza traversals de path', () => {
    expect(parseVideoFileName('../../../.env').ok).toBe(false);
    expect(parseVideoFileName('..%2Fpackage.json').ok).toBe(false);
    expect(parseVideoFileName(`${VALID_ID}.mp4/../../secret`).ok).toBe(false);
  });

  it('rechaza extensiones que no son video', () => {
    expect(parseVideoFileName(`${VALID_ID}.env`).ok).toBe(false);
    expect(parseVideoFileName(`${VALID_ID}.exe`).ok).toBe(false);
    expect(parseVideoFileName(`${VALID_ID}.php`).ok).toBe(false);
  });

  it('rechaza nombres sin uuid o sin extensión', () => {
    expect(parseVideoFileName('video.mp4').ok).toBe(false);
    expect(parseVideoFileName(`${VALID_ID}`).ok).toBe(false);
    expect(parseVideoFileName('').ok).toBe(false);
  });
});

describe('isVideoExtension / mimeForExtension', () => {
  it('acepta las cinco extensiones soportadas', () => {
    for (const ext of ['mp4', 'webm', 'mov', 'm4v', '3gp'] as const) {
      expect(isVideoExtension(ext)).toBe(true);
      expect(mimeForExtension(ext)).toMatch(/^video\//);
    }
  });

  it('rechaza lo que no es extensión de video', () => {
    expect(isVideoExtension('gif')).toBe(false);
    expect(isVideoExtension('toString')).toBe(false);
  });
});

describe('newVideoFileName', () => {
  it('genera nombres únicos con la forma uuid.ext', () => {
    const first = newVideoFileName('mp4');
    const second = newVideoFileName('mp4');
    expect(first.fileName).not.toBe(second.fileName);
    expect(parseVideoFileName(first.fileName).ok).toBe(true);
    expect(parseVideoFileName(second.fileName).ok).toBe(true);
  });
});

describe('parseByteRange', () => {
  const size = 1000;

  it('interpreta un rango abierto', () => {
    expect(parseByteRange('bytes=0-', size)).toEqual({ start: 0, end: 999 });
  });

  it('interpreta un rango acotado', () => {
    expect(parseByteRange('bytes=100-199', size)).toEqual({ start: 100, end: 199 });
  });

  it('interpreta rangos sufijo', () => {
    expect(parseByteRange('bytes=-500', size)).toEqual({ start: 500, end: 999 });
  });

  it('pide el último byte', () => {
    expect(parseByteRange('bytes=-1', size)).toEqual({ start: 999, end: 999 });
  });

  it('recorta un final que excede el tamaño', () => {
    expect(parseByteRange('bytes=900-5000', size)).toEqual({ start: 900, end: 999 });
  });

  it('rechaza rangos imposibles', () => {
    expect(parseByteRange('bytes=1000-', size)).toBeNull();
    expect(parseByteRange('bytes=200-100', size)).toBeNull();
    expect(parseByteRange('bytes=abc-def', size)).toBeNull();
    expect(parseByteRange('bytes=-0', size)).toBeNull();
    expect(parseByteRange('bytes=-', size)).toBeNull();
    expect(parseByteRange('items=0-10', size)).toBeNull();
    expect(parseByteRange('bytes=0-10, 20-30', size)).toBeNull();
  });

  it('rechaza tamaños inválidos', () => {
    expect(parseByteRange('bytes=0-10', 0)).toBeNull();
    expect(parseByteRange('bytes=0-10', -5)).toBeNull();
    expect(parseByteRange('bytes=0-10', Number.NaN)).toBeNull();
  });
});
