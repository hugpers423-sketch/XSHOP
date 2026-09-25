// apps/web/components/product/ProductGallery.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductGalleryProps {
  images: string[];
  videoUrl?: string;
  title: string;
}

/**
 * Galería 360° con:
 * - Swiper horizontal con snap
 * - Indicadores de página
 * - Vista previa zoom al mantener presionado
 * - Soporte para video vertical en primera posición
 */
export function ProductGallery({ images, videoUrl, title }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const slides = videoUrl ? [videoUrl, ...images] : images;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setZoomPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div className="space-y-3">
      {/* Slide principal */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-900"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full"
            style={
              zoom
                ? {
                    transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    transform: 'scale(1.8)',
                    transition: 'transform 0.1s ease-out',
                  }
                : undefined
            }
          >
            {slides[active]?.endsWith('.mp4') ? (
              <video
                src={slides[active]}
                className="h-full w-full object-cover"
                controls
                playsInline
                loop
              />
            ) : (
              <img src={slides[active]} alt={title} className="h-full w-full object-cover" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Badge de descuento */}
        <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
          -38% OFF
        </span>

        {/* Indicadores */}
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`Imagen ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {slides.map((src, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
              i === active ? 'border-cyan-400' : 'border-transparent opacity-60'
            }`}
          >
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
