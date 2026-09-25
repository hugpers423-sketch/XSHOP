// app/products/[id]/page.tsx
import { ProductGallery } from '@/components/product/ProductGallery';
import { VariantSelector } from '@/components/product/VariantSelector';
import { SellerReputation } from '@/components/product/SellerReputation';
import { BuyPanel } from '@/components/product/BuyPanel';

// Demo: en producción reemplazar por fetch a /api/products/[id]
const PRODUCT = {
  id: 'p1',
  title: 'Zapatillas Urbanas LED Pro - Edición Limitada',
  price: 129.99,
  compareAtPrice: 209.99,
  description:
    'Zapatillas con iluminación LED integrada, suela antideslizante y batería recargable de 8 horas. Diseño urbano premium con materiales transpirables.',
  images: [
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800',
    'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800',
  ],
  videoUrl: undefined as string | undefined,
  stock: 24,
  rating: 4.8,
  reviewsCount: 342,
  shippingEstimate: 'Llega mañana (Lima Metropolitana)',
  variants: [
    { id: 'v1', name: 'Talla 38', price: 129.99, stock: 6 },
    { id: 'v2', name: 'Talla 39', price: 129.99, stock: 3 },
    { id: 'v3', name: 'Talla 40', price: 129.99, stock: 10 },
    { id: 'v4', name: 'Talla 41', price: 129.99, stock: 5 },
    { id: 'v5', name: 'Talla 42', price: 129.99, stock: 0 },
  ],
  seller: {
    id: 's1',
    username: 'TechStore Lima',
    avatar: '',
    level: 'gold' as const,
    totalSales: 487,
    responseTime: '5 min',
  },
};

// Next 15: params asíncrono (Promise) — se resuelve con await
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params; // usado para tracking/debug en el contenedor raíz
  return (
    <div className="min-h-screen bg-zinc-950 pb-32 text-white" data-product-id={productId}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-6 lg:grid-cols-2 lg:px-8">
        {/* Columna izquierda: Galería */}
        <div className="space-y-4">
          <ProductGallery
            images={PRODUCT.images}
            videoUrl={PRODUCT.videoUrl}
            title={PRODUCT.title}
          />
        </div>

        {/* Columna derecha: Info + compra */}
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-400">
                🔥 Oferta del día
              </span>
              <span className="text-xs text-white/40">
                {PRODUCT.reviewsCount} reseñas · ★ {PRODUCT.rating}
              </span>
            </div>

            <h1 className="text-2xl font-black leading-tight lg:text-3xl">{PRODUCT.title}</h1>

            <div className="mt-3 flex items-end gap-3">
              <span className="text-4xl font-black text-emerald-400">
                S/ {PRODUCT.price.toFixed(2)}
              </span>
              <span className="text-lg text-white/35 line-through">
                S/ {PRODUCT.compareAtPrice.toFixed(2)}
              </span>
              <span className="mb-1 rounded-lg bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-400">
                -{Math.round((1 - PRODUCT.price / PRODUCT.compareAtPrice) * 100)}%
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-white/60">{PRODUCT.description}</p>

            <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400">
              🚚 {PRODUCT.shippingEstimate}
            </p>
          </div>

          <VariantSelector
            variants={PRODUCT.variants}
            selectedId={null}
            onSelect={(id) => console.log('Variante:', id)}
          />

          <SellerReputation
            username={PRODUCT.seller.username}
            avatar={PRODUCT.seller.avatar}
            level={PRODUCT.seller.level}
            rating={PRODUCT.rating}
            totalSales={PRODUCT.seller.totalSales}
            responseTime={PRODUCT.seller.responseTime}
            onMessage={() => console.log('Abrir chat con vendedor')}
          />
        </div>
      </div>

      {/* Panel de compra flotante (sticky bottom en móvil) */}
      <BuyPanel
        price={PRODUCT.price}
        compareAtPrice={PRODUCT.compareAtPrice}
        stock={PRODUCT.stock}
        onBuyNow={() => console.log('Compra 1-clic')}
        onAddToCart={() => console.log('Añadir al carrito')}
        onWhatsApp={() =>
          window.open(
            `https://wa.me/51904918121?text=${encodeURIComponent(
              `Hola, me interesa: ${PRODUCT.title} (S/ ${PRODUCT.price.toFixed(2)})`
            )}`,
            '_blank'
          )
        }
      />
    </div>
  );
}
