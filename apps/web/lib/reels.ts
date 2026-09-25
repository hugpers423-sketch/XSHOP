// apps/web/lib/reels.ts
// Mapeo entre el modelo `Video` de Prisma y el tipo `Reel` que consume el feed.
// Vive fuera de la UI para que la API y el cliente compartan exactamente la
// misma forma de datos.

import type { Reel } from '@/components/reels/types';

/** Subconjunto del modelo Video (+ relaciones) que necesita el feed. */
export interface VideoForFeed {
  id: string;
  url: string;
  posterUrl: string | null;
  caption: string;
  hashtags: string[];
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  purchases: number;
  author: { id: string; name: string };
  product: {
    id: string;
    title: string;
    price: { toNumber: () => number };
    compareAtPrice: { toNumber: () => number } | null;
    stock: number;
    images: Array<{ url: string }>;
    variants: Array<{ id: string; name: string; price: { toNumber: () => number }; stock: number }>;
    seller: { id: string; name: string };
  } | null;
}

/** Convierte un nombre completo o correo en un identificador estilo TikTok. */
export function toUsername(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'vendedor';
}

const FALLBACK_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#1b1030"/><text x="50%" y="50%" font-size="170" text-anchor="middle" dominant-baseline="central">🎬</text></svg>'
  );

/**
 * Un Reel siempre lleva producto porque el video de compra sin producto no
 * tiene sentido comercial: si el vendedor sube sin producto, la UI lo bloquea
 * antes de llegar aquí. El fallback defensivo evita romper el feed entero.
 */
export function videoToReel(video: VideoForFeed): Reel {
  const price = video.product ? video.product.price.toNumber() : 0;
  const compareAt = video.product?.compareAtPrice?.toNumber() ?? undefined;
  const thumbnail = video.posterUrl || video.product?.images[0]?.url || FALLBACK_THUMB;

  return {
    id: video.id,
    videoUrl: video.url,
    videoPoster: thumbnail,
    duration: Math.max(1, video.durationSec || 15),
    caption: video.caption,
    hashtags: video.hashtags.length ? video.hashtags : ['xstore'],
    music: { name: 'Sonido original', artist: video.author.name },
    product: {
      id: video.product?.id ?? `video-${video.id}`,
      title: video.product?.title ?? video.caption.slice(0, 80),
      price,
      ...(compareAt && compareAt > price ? { compareAtPrice: compareAt } : {}),
      currency: 'PEN',
      thumbnail,
      images: video.product?.images.length ? video.product.images.map((image) => image.url) : [thumbnail],
      variants: video.product?.variants.length
        ? video.product.variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            price: variant.price.toNumber(),
            stock: Math.max(0, variant.stock),
          }))
        : [{ id: `default-${video.id}`, name: 'Única', price, stock: Math.max(1, video.product?.stock ?? 1) }],
      stock: Math.max(0, video.product?.stock ?? 0),
      seller: {
        id: video.product?.seller.id ?? video.author.id,
        username: toUsername(video.product?.seller.name ?? video.author.name),
        avatar: '',
        reputationLevel: 'gold',
        rating: 4.8,
      },
      shippingEstimate: 'Llega mañana',
      ...(compareAt && price > 0
        ? { discountPercent: Math.round(((compareAt - price) / compareAt) * 100) }
        : {}),
    },
    stats: {
      likes: video.likes,
      comments: video.comments,
      shares: video.shares,
      purchases: video.purchases,
    },
  };
}
