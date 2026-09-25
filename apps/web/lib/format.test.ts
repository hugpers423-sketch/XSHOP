// apps/web/lib/format.test.ts
// Unit tests — formateadores es-PE (moneda, distancias, conteos)

import { describe, it, expect } from 'vitest';
import { formatPEN, formatPrice, formatDistance, formatCount, timeAgo, maskEmail, maskPhone } from './format';

describe('formatPEN / formatPrice', () => {
  it('formatea soles con 2 decimales', () => {
    const out = formatPEN(1234.5);
    expect(out).toMatch(/1.?234[.,]50/); // separador según ICU
    expect(out).toContain('S/'); // símbolo PEN
  });

  it('formatPrice es alias de formatPEN', () => {
    expect(formatPrice(10)).toBe(formatPEN(10));
  });

  it('maneja 0 y negativos', () => {
    expect(formatPEN(0)).toBeTruthy();
    expect(formatPEN(-50)).toBeTruthy();
  });
});

describe('formatDistance', () => {
  it('usa metros bajo 1km', () => {
    expect(formatDistance(0.4)).toBe('400 m');
  });

  it('usa km con 1 decimal', () => {
    expect(formatDistance(12.34)).toBe('12.3 km');
  });
});

describe('formatCount', () => {
  it('abrevia miles y millones', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1500)).toBe('1.5K');
    expect(formatCount(2_400_000)).toBe('2.4M');
  });
});

describe('timeAgo', () => {
  it('devuelve "ahora" para fechas recientes', () => {
    expect(timeAgo(new Date())).toBe('ahora');
  });

  it('devuelve unidad relativa pasada', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    expect(timeAgo(twoHoursAgo)).toMatch(/hora/);
  });

  it('acepta string ISO', () => {
    const yesterday = new Date(Date.now() - 86400_000).toISOString();
    expect(timeAgo(yesterday)).toMatch(/ayer|día/);
  });
});

describe('mascarado de datos sensibles', () => {
  it('maskEmail oculta el nombre local', () => {
    const out = maskEmail('victor.reyes@xstore.pe');
    expect(out.startsWith('vi')).toBe(true);
    expect(out).toContain('@xstore.pe');
    expect(out).not.toContain('victor.reyes');
  });

  it('maskPhone conserva prefijo y últimos 4', () => {
    const out = maskPhone('987654321');
    expect(out.startsWith('987')).toBe(true);
    expect(out.endsWith('4321')).toBe(true);
    expect(out).not.toContain('987654321');
  });
});
