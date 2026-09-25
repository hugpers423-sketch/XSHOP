// apps/web/lib/analytics.ts
// Tracking de eventos de conversión (privacy-first, sin cookies de terceros)

type EventName =
  | 'page_view'
  | 'reel_view'
  | 'reel_like'
  | 'reel_share'
  | 'product_view'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'chat_open'
  | 'whatsapp_click';

interface AnalyticsEvent {
  name: EventName;
  params?: Record<string, string | number | boolean>;
}

const QUEUE: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function push(event: AnalyticsEvent): void {
  QUEUE.push(event);

  // Enviar en lote cada 3 segundos (o inmediato en eventos críticos)
  if (event.name === 'purchase' || QUEUE.length >= 20) {
    flush();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(flush, 3000);
  }
}

// API pública: track("nombre_evento", { param: valor })
export function track(name: string, params?: Record<string, string | number | boolean>): void {
  push({ name: name as EventName, params });
}

async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (QUEUE.length === 0) return;

  const batch = QUEUE.splice(0, QUEUE.length);

  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // Silencioso: analytics nunca debe romper la UX
  }
}

export const analytics = {
  track: push,
  page: (path: string) => push({ name: 'page_view', params: { path } }),
  reelView: (reelId: string) => push({ name: 'reel_view', params: { reelId } }),
  addToCart: (productId: string, price: number, qty: number) =>
    push({ name: 'add_to_cart', params: { productId, price, qty } }),
  purchase: (orderId: string, total: number) =>
    push({ name: 'purchase', params: { orderId, total } }),
};

// Flush al salir de la página
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
