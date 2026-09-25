// apps/web/components/live/LivePlayer.tsx
'use client';

// Reproductor de transmisión en vivo con contador de espectadores y likes

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { formatCount, emojiTile } from '@/lib/format';

interface LivePlayerProps {
  streamId: string;
  title: string;
  hostName: string;
  hostAvatar: string;
  viewers: number;
  likes: number;
  onLike: () => void;
  ended?: boolean;
  streamUrl?: string | null;
  transport?: 'hls' | 'webrtc' | 'livekit';
  remoteStream?: MediaStream | null;
}

// Demo de streaming fluido (vídeo real en loop, silenciado por autoplay).
// Producción: HLS.js/Webrtc publica la URL del vendedor en src.
const DEMO_STREAM_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export function LivePlayer({
  title, hostName, hostAvatar, viewers, likes, onLike, ended, streamUrl,
  transport = 'hls', remoteStream = null,
}: LivePlayerProps) {
  const likeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [muted, setMuted] = useState(true);

  // Corazones flotantes al hacer like (partículas ligeras)
  useEffect(() => {
    const btn = likeRef.current;
    if (!btn) return;
    const heart = document.createElement('span');
    heart.textContent = '❤️';
    heart.className =
      'pointer-events-none absolute -top-1 left-1/2 text-lg transition-all duration-1000';
    btn.appendChild(heart);

    const drift = (Math.random() * 60 - 30) | 0;
    requestAnimationFrame(() => {
      heart.style.transform = `translate(${drift}px, -80px)`;
      heart.style.opacity = '0';
    });
    const t = setTimeout(() => heart.remove(), 1000);
    return () => clearTimeout(t);
  }, [likes]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!muted) void video.play().catch(() => undefined);
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    if (transport !== 'hls') {
      if (remoteStream) {
        video.srcObject = remoteStream;
        video.muted = muted;
        void video.play().catch(() => undefined);
      } else {
        video.srcObject = null;
        video.removeAttribute('src');
      }
      return () => {
        video.srcObject = null;
        video.removeAttribute('src');
      };
    }

    const source = streamUrl || DEMO_STREAM_URL;
    const attach = async () => {
      if (source.toLowerCase().includes('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl')) {
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
          hlsRef.current = hls;
          hls.loadSource(source);
          hls.attachMedia(video);
          return;
        }
      }
      video.srcObject = null;
      video.src = source;
      video.load();
    };

    void attach();
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.srcObject = null;
    };
  }, [remoteStream, streamUrl, transport]);

  return (
    <div className="relative aspect-[9/16] max-h-[70vh] w-full overflow-hidden rounded-3xl border border-white/10 bg-black">
      {/* Stream: demo fluido en loop (silenciado) → HLS/WebRTC en producción */}
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        autoPlay
        muted={muted}
        loop={transport === 'hls' && !streamUrl}
        playsInline
        preload="metadata"
        poster={emojiTile('📡', '#0b0b14')}
        aria-label={transport === 'livekit' ? 'Transmisión en vivo por LiveKit' : transport === 'webrtc' ? 'Transmisión en vivo por WebRTC' : streamUrl ? 'Transmisión en vivo del vendedor' : 'Transmisión en vivo (demo)'}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      {transport !== 'hls' && !remoteStream && (
        <div className="absolute inset-0 grid place-items-center bg-black/65 text-center text-sm text-white/75">
          <div>
            <span className="text-3xl">📡</span>
            <p className="mt-2 font-semibold">Esperando la señal del vendedor…</p>
          </div>
        </div>
      )}

      {/* Badge EN VIVO + espectadores */}
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          EN VIVO
        </span>
        <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
          👁 {formatCount(viewers)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setMuted((value) => !value)}
        aria-label={muted ? 'Activar sonido del live' : 'Silenciar live'}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-sm text-white backdrop-blur transition hover:bg-black/80"
      >
        {muted ? '🔇' : '🔊'}
      </button>

      {ended && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-sm">
          <div className="text-center">
            <p className="text-3xl">🎬</p>
            <p className="mt-2 font-bold text-white">Transmisión finalizada</p>
            <p className="text-sm text-white/50">Gracias por ver X-STORE Live</p>
          </div>
        </div>
      )}

      {/* Host + título */}
      <div className="absolute bottom-4 left-3 right-16">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hostAvatar} alt={hostName} className="h-9 w-9 rounded-full border-2 border-[#FF2D75] object-cover" />
          <div>
            <p className="text-sm font-bold text-white">{hostName}</p>
            <p className="line-clamp-1 text-xs text-white/60">{title}</p>
          </div>
        </div>
      </div>

      {/* Botón de like flotante */}
      <motion.button
        ref={likeRef}
        whileTap={{ scale: 0.8 }}
        onClick={onLike}
        aria-label="Me gusta"
        className="absolute bottom-4 right-3 grid h-14 w-14 place-items-center rounded-full bg-white/10 text-2xl backdrop-blur transition hover:bg-white/20"
      >
        ❤️
      </motion.button>

      {/* Contador de likes */}
      <span className="absolute bottom-1 right-4 text-[10px] font-bold text-white/70">
        {formatCount(likes)}
      </span>
    </div>
  );
}
