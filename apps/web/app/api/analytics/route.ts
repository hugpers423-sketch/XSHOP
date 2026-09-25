// apps/web/app/api/analytics/route.ts
// Endpoint privacy-first de analítica — recibe eventos en lote (sin cookies de terceros)

import { NextRequest, NextResponse } from 'next/server';

// Límites anti-abuso (OWASP)
const MAX_EVENTS_PER_BATCH = 50;
const MAX_NAME_LEN = 64;
const MAX_PARAM_KEYS = 20;
const MAX_VALUE_LEN = 256;

interface AnalyticsEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

/** Valida y normaliza un lote de eventos. Devuelve null si es inválido. */
function sanitizeBatch(body: unknown): AnalyticsEvent[] | null {
  if (!body || typeof body !== 'object') return null;
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS_PER_BATCH) {
    return null;
  }

  const clean: AnalyticsEvent[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') return null;
    const { name, params } = raw as { name?: unknown; params?: unknown };

    if (typeof name !== 'string' || !name || name.length > MAX_NAME_LEN) return null;

    let cleanParams: AnalyticsEvent['params'];
    if (params !== undefined) {
      if (typeof params !== 'object' || params === null || Array.isArray(params)) return null;
      const entries = Object.entries(params as Record<string, unknown>);
      if (entries.length > MAX_PARAM_KEYS) return null;

      cleanParams = {};
      for (const [key, value] of entries) {
        // Solo escalares permitidos (nada de objetos anidados — anti-payload-bomb)
        if (typeof value === 'string') {
          cleanParams[key.slice(0, 64)] = value.slice(0, MAX_VALUE_LEN);
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          cleanParams[key.slice(0, 64)] = value;
        } else if (typeof value === 'boolean') {
          cleanParams[key.slice(0, 64)] = value;
        }
      }
    }

    clean.push({ name, params: cleanParams });
  }

  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const events = sanitizeBatch(body);

    if (!events) {
      return NextResponse.json({ error: 'Lote de eventos inválido' }, { status: 400 });
    }

    // En producción: publicar a NATS/ClickHouse (fire-and-forget).
    // Aquí solo se registra de forma agregada (sin PII — nunca se guarda IP o user-agent).
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[analytics] ${events.length} evento(s):`,
        events.map((e) => e.name).join(', ')
      );
    }

    // 202: aceptado y procesado — el cliente nunca debe reintentar
    return NextResponse.json({ ok: true, received: events.length }, { status: 202 });
  } catch (error) {
    console.error('[API /analytics] Error:', error);
    // Falla silenciosa por diseño: la analítica nunca rompe la UX
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
