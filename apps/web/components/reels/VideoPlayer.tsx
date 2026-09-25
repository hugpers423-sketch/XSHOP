// apps/web/components/reels/VideoPlayer.tsx
'use client';

import { memo, useEffect, useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  poster: string;
  isActive: boolean;
  isMounted: boolean;
  muted: boolean;
  onPlay: () => void;
  onPause: () => void;
  onEnded?: () => void;
}

/**
 * ESTRATEGIA DE CARGA:
 * - Fuera de ventana  → sin src (cero peticiones de red).
 * - En ventana        → src con preload="metadata".
 * - Activo            → autoplay + play() + preload="auto".
 */
function VideoPlayerBase({
  src, poster, isActive, isMounted, muted, onPlay, onPause, onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = muted;
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => {});
      onPlay();
    } else {
      video.pause();
      video.currentTime = 0;
      onPause();
    }
  }, [isActive, muted, onPlay, onPause]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && !isMounted) video.removeAttribute('src');
  }, [isMounted]);

  if (!isMounted) return <div className="absolute inset-0 bg-black" aria-hidden />;

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      poster={poster}
      muted={muted}
      loop
      playsInline
      preload={isActive ? 'auto' : 'metadata'}
      src={src}
      onEnded={onEnded}
      aria-label="Video de producto"
    />
  );
}

export const VideoPlayer = memo(VideoPlayerBase);
