// apps/web/lib/format.ts
// Formateadores para el mercado peruano

const PEN = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
});

export function formatPEN(amount: number): string {
  return PEN.format(amount);
}

// Alias genérico usado por páginas nuevas
export const formatPrice = formatPEN;

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  const intervals: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ];

  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

  for (const [secs, unit] of intervals) {
    const value = Math.floor(seconds / secs);
    if (Math.abs(value) >= 1) return rtf.format(-value, unit);
  }
  return 'ahora';
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits.slice(0, 3)}${'*'.repeat(digits.length - 7)}${digits.slice(-4)}`;
}

/**
 * Tile SVG data-URI con emoji — miniatura sin assets externos.
 * Usada en carrito/tendencias para evitar imágenes rotas.
 */
export function emojiTile(emoji: string, bg = '#1a1a26'): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">` +
    `<rect width="240" height="240" rx="24" fill="${bg}"/>` +
    `<text x="120" y="128" font-size="110" text-anchor="middle" dominant-baseline="central">${emoji}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Fallback genérico para <img> rotas en cualquier página
export const IMG_FALLBACK = emojiTile('🛍️');
