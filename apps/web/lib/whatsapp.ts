// apps/web/lib/whatsapp.ts
// Checkout vía WhatsApp para coordinar Yape/Plin con soporte.

export const SUPPORT_PHONE = (process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_PHONE || '51904918121').replace(/\D/g, '');

export interface CheckoutPayload {
  orderId: string;
  items: Array<{ title: string; qty: number; price: number }>;
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: 'yape' | 'plin' | 'transfer' | 'cash';
}

/**
 * Genera el mensaje de checkout y abre WhatsApp con el número de soporte.
 * Flujo de pago manual:
 * 1. El pedido queda guardado en X-STORE
 * 2. El comprador envía el pago al número de soporte
 * 3. Soporte valida el comprobante
 * 4. El vendedor recibe la orden para enviar
 */
export function openWhatsAppCheckout(payload: CheckoutPayload): void {
  const lines = [
    '🛍️ *NUEVO PEDIDO X-STORE*',
    `*Orden:* ${payload.orderId}`,
    '--------------------------------',
    ...payload.items.map((i, idx) => `${idx + 1}. ${i.title} x${i.qty} — S/ ${(i.price * i.qty).toFixed(2)}`),
    '--------------------------------',
    `*Subtotal:* S/ ${payload.subtotal.toFixed(2)}`,
    `*Envío:* S/ ${payload.shipping.toFixed(2)}`,
    `*TOTAL:* S/ ${payload.total.toFixed(2)}`,
    '',
    `*Método de pago:* ${payload.paymentMethod.toUpperCase()}`,
    '',
    '🧾 Pedido guardado. El pago se coordina por WhatsApp y queda pendiente de validación.',
  ];

  const text = encodeURIComponent(lines.join('\n'));
  window.open(`https://wa.me/${SUPPORT_PHONE}?text=${text}`, '_blank', 'noopener,noreferrer');
}

/** Contacto directo con un vendedor (flujo Marketplace) */
export function openWhatsAppSeller(sellerPhone: string, productTitle: string): void {
  const text = encodeURIComponent(
    `Hola 👋, vi tu producto "*${productTitle}*" en X-STORE y me interesa. ¿Sigue disponible?`
  );
  window.open(`https://wa.me/${sellerPhone}?text=${text}`, '_blank', 'noopener,noreferrer');
}

/** Soporte general */
export function openWhatsAppSupport(): void {
  const text = encodeURIComponent('Hola, necesito ayuda con mi pedido en X-STORE 🙋');
  window.open(`https://wa.me/${SUPPORT_PHONE}?text=${text}`, '_blank', 'noopener,noreferrer');
}
