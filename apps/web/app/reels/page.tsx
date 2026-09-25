// apps/web/app/reels/page.tsx
'use client';

// Página Reels — feed TikTok-style con compra rápida al carrito real

import { useEffect, useState } from 'react';
import { ReelsFeed } from '@/components/reels/ReelsFeed';
import { useCartStore } from '@/lib/cart';
import { track } from '@/lib/analytics';
import { toast } from '@/components/ui/Toast';
import { emojiTile } from '@/lib/format';
import type { Reel } from '@/components/reels/types';

// Vídeo demo real con pista de audio (bucket público Google — estable y con rango HTTP).
// En producción: URLs HLS/WebRTC del stream del vendedor.
const REELS: Reel[] = [
  {
    id: 'r1',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    videoPoster: emojiTile('🧥', '#241028'),
    duration: 15,
    caption: 'El hoodie que rompió TikTok 🔥',
    hashtags: ['moda', 'oferta', 'lima'],
    music: { name: 'Viral Sound', artist: 'X-STORE' },
    product: {
      id: 'p1', title: 'Hoodie Oversize Premium', price: 79.90,
      compareAtPrice: 129.90, currency: 'PEN',
      thumbnail: emojiTile('🧥', '#241028'), images: [emojiTile('🧥', '#241028')],
      variants: [
        { id: 'v1', name: 'Talla M', price: 79.90, stock: 12 },
        { id: 'v2', name: 'Talla L', price: 79.90, stock: 5 },
      ],
      stock: 17,
      seller: { id: 's1', username: 'urbanwear_pe', avatar: '', reputationLevel: 'gold', rating: 4.8 },
      shippingEstimate: 'Llega mañana', discountPercent: 38,
    },
    stats: { likes: 12400, comments: 342, shares: 890, purchases: 1200 },
  },
  {
    id: 'r2',
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    videoPoster: emojiTile('🎧', '#101a2e'),
    duration: 12,
    caption: 'Audífonos con cancelación de ruido 🎧',
    hashtags: ['tech', 'audio', 'oferta'],
    music: { name: 'Bass Drop', artist: 'X-STORE' },
    product: {
      id: 'p2', title: 'Audífonos Pro ANC', price: 149.90,
      compareAtPrice: 249.90, currency: 'PEN',
      thumbnail: emojiTile('🎧', '#101a2e'), images: [emojiTile('🎧', '#101a2e')],
      variants: [
        { id: 'v3', name: 'Negro', price: 149.90, stock: 30 },
        { id: 'v4', name: 'Blanco', price: 149.90, stock: 18 },
      ],
      stock: 48,
      seller: { id: 's2', username: 'tech_peru', avatar: '', reputationLevel: 'platinum', rating: 4.9 },
      shippingEstimate: 'Llega en 2 días', discountPercent: 40,
    },
    stats: { likes: 8300, comments: 210, shares: 540, purchases: 890 },
  },
];

export default function ReelsPage() {
  const addItem = useCartStore((s) => s.addItem);
  // Los Reels demo siguen siendo la base; los videos subidos por vendedores
  // se agregan al inicio cuando la API responde.
  const [reels, setReels] = useState<Reel[]>(REELS);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch('/api/videos?limit=24', { cache: 'no-store' });
        if (!response.ok) return;
        const body = (await response.json()) as { data?: unknown };
        if (!alive || !Array.isArray(body.data)) return;
        const uploaded = body.data.filter(isReel).slice(0, 24);
        if (uploaded.length > 0) setReels([...uploaded, ...REELS]);
      } catch {
        // Sin API o sin videos: el feed continúa con los Reels demo.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Agrega la variante seleccionada del reel al carrito global
  const handleAddToCart = (reelId: string, variantId: string, qty: number) => {
    const reel = reels.find((r) => r.id === reelId);
    if (!reel) return;
    const variant = reel.product.variants.find((v) => v.id === variantId);
    const price = variant?.price ?? reel.product.price;

    addItem(
      {
        productId: reel.product.id,
        variantId,
        title: reel.product.title,
        price,
        seller: reel.product.seller.username,
        image: reel.product.thumbnail,
      },
      qty
    );
    track('add_to_cart', { productId: reel.product.id, price, qty, source: 'reels' });
    toast.success(`"${reel.product.title}" añadido al carrito 🛒`);
  };

  return <ReelsFeed reels={reels} onAddToCart={handleAddToCart} />;
}

/** Validación defensiva: la API es red y no puede asumirse fiel. */
function isReel(value: unknown): value is Reel {
  if (!value || typeof value !== 'object') return false;
  const reel = value as Partial<Reel>;
  return (
    typeof reel.id === 'string' &&
    typeof reel.videoUrl === 'string' &&
    typeof reel.caption === 'string' &&
    Boolean(reel.product) &&
    typeof reel.product?.title === 'string'
  );
}
