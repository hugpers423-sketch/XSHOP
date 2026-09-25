/**
 * Rate limiter en memoria (sliding window).
 * En producción multi-instancia reemplazar por Redis:
 *   INCR key > EXPIRE key window
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - hits[0]) };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Limpieza periódica para evitar fuga de memoria
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { ok: true, remaining: limit - hits.length, retryAfterMs: 0 };
}
