// apps/web/app/live/page.tsx
'use client';

// Página Live Shopping — lista de transmisiones activas + vista de stream

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LivePlayer } from '@/components/live/LivePlayer';
import { LiveChat } from '@/components/live/LiveChat';
import { LiveGame } from '@/components/live/LiveGame';
import { PinnedProductCard, type PinnedProduct } from '@/components/live/PinnedProductCard';
import { useLiveRoom } from '@/lib/realtime';
import { formatCount, emojiTile } from '@/lib/format';
import { useAuth } from '@/lib/auth-context';
import { useLiveWebRTC } from '@/lib/webrtc';
import { useLiveKitViewer } from '@/lib/livekit';

interface LiveStreamView {
  id: string;
  title: string;
  hostName: string;
  hostAvatar: string;
  viewers: number;
  thumb: string;
  category: string;
  productName?: string | null;
  productPrice?: number | null;
  roomName?: string | null;
  streamUrl?: string | null;
  transport: 'hls' | 'webrtc' | 'livekit';
}

// Datos demo — reemplazados por lives reales cuando existe una URL publicada.
// Thumbs y avatares: tiles SVG data-URI (cero peticiones externas, cero 404)
const STREAMS: LiveStreamView[] = [
  {
    id: 'live-1',
    title: 'Ofertas Flash de Tecnología ⚡ Iphone, Samsung y más',
    hostName: 'TechPerú Store',
    hostAvatar: emojiTile('⚡', '#0e1a2e'),
    viewers: 1243,
    thumb: emojiTile('📱', '#0e1a2e'),
    category: 'Tecnología',
    transport: 'hls',
  },
  {
    id: 'live-2',
    title: 'Moda Verano 2026 — Tienda Glitter 🌴',
    hostName: 'Glitter Fashion',
    hostAvatar: emojiTile('✨', '#2a0f22'),
    viewers: 876,
    thumb: emojiTile('👗', '#2a0f22'),
    category: 'Moda',
    transport: 'hls',
  },
  {
    id: 'live-3',
    title: 'Cocina peruana con sartenes antiadherentes 🍳',
    hostName: 'Hogar Total',
    hostAvatar: emojiTile('🏠', '#0f2418'),
    viewers: 432,
    thumb: emojiTile('🍳', '#0f2418'),
    category: 'Hogar',
    transport: 'hls',
  },
];

// Productos que el host puede fijar (demo)
const HOST_PRODUCTS: PinnedProduct[] = [
  {
    id: 'p-1',
    title: 'Auriculares Bluetooth Pro con cancelación de ruido',
    price: 129.9,
    compareAtPrice: 199.9,
    image: emojiTile('🎧', '#141428'),
    stockLabel: '⏳ Oferta por tiempo limitado',
  },
  {
    id: 'p-2',
    title: 'Smartwatch Deportivo AMOLED 1.43"',
    price: 189.0,
    compareAtPrice: 259.0,
    image: emojiTile('⌚', '#141428'),
  },
];

export default function LivePage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [productIdx, setProductIdx] = useState(0);
  // Señal del host: cada incremento lanza la siguiente pregunta del juego
  const [hostQuestionSignal, setHostQuestionSignal] = useState(0);
  const { user, requireAuth } = useAuth();
  const [remoteStreams, setRemoteStreams] = useState<LiveStreamView[]>([]);
  const [persistenceFailed, setPersistenceFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/lives', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo consultar la persistencia de lives');
        return response.json() as Promise<{ data?: Array<Record<string, unknown>>; persistence?: boolean }>;
      })
      .then((data) => {
        if (!active || !Array.isArray(data.data)) return;
        if (data.persistence === false) setPersistenceFailed(true);
        const mapped = data.data.map((item) => ({
          id: String(item.id),
          title: String(item.title),
          hostName: String(item.hostName || 'Vendedor X-STORE'),
          hostAvatar: emojiTile('📡', '#0e1a2e'),
          viewers: Number(item.viewers || 0),
          thumb: emojiTile('📡', '#0e1a2e'),
          category: String(item.category || 'General'),
          productName: typeof item.productName === 'string' ? item.productName : null,
          productPrice: typeof item.productPrice === 'number' ? item.productPrice : null,
          roomName: typeof item.roomName === 'string' ? item.roomName : null,
          streamUrl: typeof item.streamUrl === 'string' ? item.streamUrl : null,
          transport: item.transport === 'webrtc'
            ? 'webrtc' as const
            : item.transport === 'livekit'
              ? 'livekit' as const
              : 'hls' as const,
        })) satisfies LiveStreamView[];
        setRemoteStreams(mapped);
      })
      .catch(() => {
        if (active) setPersistenceFailed(true);
      });
    return () => { active = false; };
  }, []);

  const availableStreams = remoteStreams.length
    ? remoteStreams
    : persistenceFailed
      ? []
      : STREAMS;

  const active = useMemo(() => availableStreams.find((s) => s.id === activeId) ?? null, [activeId, availableStreams]);
  const webRtc = useLiveWebRTC({
    streamId: active?.id ?? '',
    mode: 'viewer',
    enabled: active?.transport === 'webrtc',
  });
  const liveKitViewer = useLiveKitViewer({
    roomName: active?.roomName ?? '',
    enabled: active?.transport === 'livekit',
  });

  // Hook de tiempo real (solo se activa al entrar a un stream)
  const { comments, likes, viewers, comment, like, connected } = useLiveRoom({
    streamId: activeId ?? '',
    userId: user?.id ?? 'guest',
  });

  const pinned: PinnedProduct | null = activeId
    ? active?.productName
      ? {
          id: `seller-product-${active.id}`,
          title: active.productName,
          price: active.productPrice ?? 0,
          image: emojiTile('🛍️', '#141428'),
          stockLabel: 'Producto destacado del vendedor',
        }
      : HOST_PRODUCTS[productIdx] ?? null
    : null;

  // ================= VISTA DE STREAM =================
  if (active) {
    return (
      <main className="mx-auto grid max-w-6xl gap-4 px-3 py-4 pb-24 lg:grid-cols-[1fr_360px]">
        {/* Player + chat en móvil se apilan */}
        <div className="relative">
          <LivePlayer
            streamId={active.id}
            title={active.title}
            hostName={active.hostName}
            hostAvatar={active.hostAvatar}
            viewers={viewers || active.viewers}
            likes={likes}
            streamUrl={active.streamUrl}
            transport={active.transport}
            remoteStream={active.transport === 'livekit' ? liveKitViewer.remoteStream : webRtc.remoteStream}
            onLike={() => { if (requireAuth()) like(); }}
          />

          {active.transport === 'livekit' && (
            <div className="mt-3 space-y-2">
              {liveKitViewer.audioInvite && (
                <div role="status" className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3">
                  <p className="text-sm font-black text-white">🎙️ {liveKitViewer.audioInvite.fromName || 'El vendedor'} te invita a hablar</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/60">
                    Acepta si quieres que tu micrófono se escuche en el live. Puedes silenciarte o salir cuando quieras.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (requireAuth()) void liveKitViewer.acceptAudioInvite();
                      }}
                      disabled={liveKitViewer.connectingAudio}
                      className="rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-black disabled:opacity-50"
                    >
                      {liveKitViewer.connectingAudio ? 'Conectando…' : 'Aceptar y hablar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void liveKitViewer.declineAudioInvite()}
                      className="rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
                    >
                      Ahora no
                    </button>
                  </div>
                </div>
              )}
              {liveKitViewer.audioSessionActive && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3">
                  <span className="text-xs font-bold text-emerald-200">
                    🎙️ {liveKitViewer.audioEnabled ? 'Tu micrófono está abierto' : 'Tu micrófono está silenciado'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void liveKitViewer.toggleMicrophone()}
                    className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-bold text-white/75 hover:bg-white/10"
                  >
                    {liveKitViewer.audioEnabled ? 'Silenciar' : 'Activar micrófono'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void liveKitViewer.stopAudioConversation()}
                    className="rounded-lg border border-red-400/25 px-2.5 py-1.5 text-[11px] font-bold text-red-200 hover:bg-red-400/10"
                  >
                    Salir de la conversación
                  </button>
                </div>
              )}
              {liveKitViewer.audioError && <p role="alert" className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{liveKitViewer.audioError}</p>}
            </div>
          )}

          {/* Producto fijado superpuesto */}
          <div className="absolute bottom-24 left-3 z-10">
            <PinnedProductCard product={pinned} onRequireAuth={requireAuth} />
          </div>

          {/* Controles demo del host: ciclar producto fijado (en producción solo host) */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setProductIdx((i) => (i + 1) % HOST_PRODUCTS.length)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/30"
            >
              🔗 Siguiente producto fijado (demo host)
            </button>
            <button
              onClick={() => setHostQuestionSignal((n) => n + 1)}
              className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 hover:border-amber-400/60"
            >
              🎮 Lanzar pregunta (demo host)
            </button>
            <button
              onClick={() => setActiveId(null)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:border-white/30"
            >
              ← Volver al listado
            </button>
          </div>
        </div>

        {/* Juego en vivo + chat lateral (compradores juegan, el host lanza preguntas) */}
        <div className="flex flex-col gap-3 lg:h-[78vh] lg:overflow-hidden">
          <LiveGame hostQuestionSignal={hostQuestionSignal} />
          <div className="h-[52vh] min-h-[320px] lg:h-auto lg:min-h-0 lg:flex-1">
            <LiveChat comments={comments} onSend={comment} onRequireAuth={requireAuth} connected={connected} />
          </div>
        </div>
      </main>
    );
  }

  // ================= LISTADO DE STREAMS =================
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-white">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            Live Shopping
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Compra en vivo, comentarios en tiempo real y ofertas exclusivas.
          </p>
        </div>
        <Link
          href="/seller/live/studio"
          className="rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-4 py-2.5 text-sm font-bold text-white"
        >
          📡 Transmitir
        </Link>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {availableStreams.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            onClick={() => setActiveId(s.id)}
            className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-left transition hover:border-[#FF2D75]/50"
          >
            <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#12121a] to-[#1c1430]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.thumb}
                alt={s.title}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> EN VIVO
              </span>
              <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
                👁 {formatCount(s.viewers)}
              </span>
            </div>
            <div className="p-4">
              <p className="line-clamp-2 text-sm font-semibold text-white">{s.title}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-white/50">{s.hostName}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                  {s.category}
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </main>
  );
}
