'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useLiveWebRTC } from '@/lib/webrtc';
import { useLiveKitPublisher } from '@/lib/livekit';
import { useLiveRoom } from '@/lib/realtime';
import { LiveChat } from '@/components/live/LiveChat';
import { formatCount } from '@/lib/format';
import { toast } from '@/components/ui/Toast';

interface LiveResponse {
  data: { id: string; title: string };
}

const CATEGORIES = ['Tecnología', 'Moda', 'Hogar', 'Belleza', 'Deportes', 'Gastronomía'];

export function CameraStudio() {
  const { user, requireAuth } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Tecnología');
  const [product, setProduct] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [cameraState, setCameraState] = useState<'idle' | 'requesting' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [liveId, setLiveId] = useState<string | null>(null);
  const liveIdRef = useRef<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [invitingIdentity, setInvitingIdentity] = useState<string | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const broadcast = useLiveWebRTC({
    streamId: liveId ?? '',
    mode: 'publisher',
    enabled: Boolean(liveId),
  });
  const liveKit = useLiveKitPublisher();
  const interaction = useLiveRoom({
    streamId: liveId ?? '',
    userId: user?.id ?? 'seller',
    demo: false,
  });
  const liveKitConfigured = Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
  const stopPublishingRef = useRef(broadcast.stopPublishing);

  useEffect(() => {
    stopPublishingRef.current = broadcast.stopPublishing;
  }, [broadcast.stopPublishing]);

  useEffect(() => {
    liveIdRef.current = liveId;
  }, [liveId]);

  useEffect(() => {
    const element = remoteAudioRef.current;
    if (!element) return;
    if (!liveKit.remoteAudioStream) {
      element.srcObject = null;
      return;
    }
    element.srcObject = liveKit.remoteAudioStream;
    void element.play().catch(() => undefined);
    return () => {
      element.srcObject = null;
    };
  }, [liveKit.remoteAudioStream]);

  useEffect(() => {
    if (!liveId) return;
    const heartbeat = () => {
      void fetch('/api/lives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: liveId, action: 'heartbeat' }),
      }).catch(() => undefined);
    };
    void heartbeat();
    const timer = window.setInterval(heartbeat, 30_000);
    return () => window.clearInterval(timer);
  }, [liveId]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
  }, []);

  const requestCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      const message = 'La cámara requiere una conexión segura. Abre la app en http://localhost:3200 o en HTTPS.';
      setCameraError(message);
      setCameraState('error');
      return null;
    }

    setCameraState('requesting');
    setCameraError('');

    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    };

    let request: Promise<MediaStream> | null = null;
    let expired = false;
    let timeoutId: number | undefined;
    try {
      request = navigator.mediaDevices.getUserMedia(constraints);
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          expired = true;
          reject(new DOMException('La solicitud de cámara expiró', 'TimeoutError'));
        }, 12000);
      });
      let stream: MediaStream;
      try {
        stream = await Promise.race([request, timeout]);
      } catch (err) {
        // Algunos navegadores no aceptan frameRate/facingModeExact; reintenta
        // con una solicitud básica antes de mostrar el error al vendedor.
        if (err instanceof DOMException && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
          request = navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream = await request;
        } else {
          throw err;
        }
      }
      if (expired) stream.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setMicEnabled(stream.getAudioTracks().some((track) => track.enabled));
      setCameraState('ready');
      return stream;
    } catch (err) {
      const message = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Permiso denegado. Haz clic en el icono de cámara/bloqueo de la barra de direcciones y habilita cámara y micrófono para transmitir.'
        : err instanceof DOMException && err.name === 'TimeoutError'
          ? 'El navegador no respondió. Revisa que la cámara no esté bloqueada por otra aplicación y vuelve a intentar.'
          : 'No se pudo abrir la cámara o el micrófono. Revisa los permisos del dispositivo.';
      setCameraError(message);
      setCameraState('error');
      return null;
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  }, []);

  const startLive = useCallback(async () => {
    if (!user) {
      requireAuth();
      return;
    }
    if (user.role !== 'SELLER' && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
      setError('Necesitas una cuenta de vendedor para iniciar una transmisión.');
      return;
    }
    if (title.trim().length < 5) {
      setError('Escribe un título de al menos 5 caracteres.');
      return;
    }
    if (product.trim() && (!Number.isFinite(Number(productPrice)) || Number(productPrice) <= 0)) {
      setError('Escribe el precio del producto destacado para que los compradores puedan comprarlo.');
      return;
    }

    setStarting(true);
    setError('');
    const stream = streamRef.current ?? await requestCamera();
    if (!stream) {
      setStarting(false);
      return;
    }

    let createdId: string | null = null;
    try {
      const response = await api.post<LiveResponse>('/api/lives', {
        title: title.trim(),
        category,
        product: product.trim() || null,
        productPrice: product.trim() ? Number(productPrice) : null,
        transport: liveKitConfigured ? 'livekit' : 'webrtc',
        streamUrl: null,
      });
      const nextLiveId = response.data.id;
      createdId = nextLiveId;
      setLiveId(nextLiveId);
      if (liveKitConfigured) {
        await liveKit.startPublishing(`xshop-${nextLiveId}`, stream);
      } else {
        broadcast.startPublishing(nextLiveId, stream);
      }
      toast.success('Live iniciado 📡 — tu cámara ya está en el estudio');
    } catch (err) {
      if (createdId) await api.delete(`/api/lives?id=${encodeURIComponent(createdId)}`).catch(() => undefined);
      setLiveId(null);
      stopCamera();
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el live.');
    } finally {
      setStarting(false);
    }
  }, [broadcast, category, liveKit, liveKitConfigured, product, requestCamera, requireAuth, stopCamera, title, user]);

  const stopLive = useCallback(async () => {
    const currentId = liveId;
    await liveKit.stopPublishing();
    broadcast.stopPublishing();
    if (currentId) {
      await api.delete(`/api/lives?id=${encodeURIComponent(currentId)}`).catch(() => undefined);
    }
    setLiveId(null);
    stopCamera();
    toast.info('Live detenido');
  }, [broadcast, liveId, liveKit, stopCamera]);

  const toggleMic = useCallback(() => {
    const next = !micEnabled;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicEnabled(next);
  }, [micEnabled]);

  const inviteViewer = useCallback(async (viewerIdentity: string) => {
    setInvitingIdentity(viewerIdentity);
    setError('');
    try {
      await liveKit.inviteToSpeak(viewerIdentity);
      toast.success('Invitación enviada al comprador 🎙️');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la invitación.');
    } finally {
      setInvitingIdentity(null);
    }
  }, [liveKit.inviteToSpeak]);

  const endConversation = useCallback(async (viewerIdentity: string) => {
    setError('');
    try {
      await liveKit.endAudioConversation(viewerIdentity);
      toast.info('Conversación de audio finalizada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar la conversación.');
    }
  }, [liveKit.endAudioConversation]);

  useEffect(() => () => {
    stopPublishingRef.current();
    const id = liveIdRef.current;
    if (id) {
      void fetch(`/api/lives?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
        keepalive: true,
      }).catch(() => undefined);
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  if (!user) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
        <span className="text-4xl">📡</span>
        <h2 className="mt-3 text-xl font-black text-white">El estudio es para vendedores</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/55">Inicia sesión para activar tu cámara y transmitir en tiempo real a tus compradores.</p>
        <button
          type="button"
          onClick={() => requireAuth()}
          className="mt-5 rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] px-5 py-3 text-sm font-bold text-white"
        >
          Iniciar sesión para transmitir
        </button>
      </section>
    );
  }

  if (user.role !== 'SELLER' && user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
    return (
      <section className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6 text-center">
        <span className="text-4xl">🛍️</span>
        <h2 className="mt-3 text-xl font-black text-white">Cambia a una cuenta de vendedor</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/55">Tu cuenta actual puede ver lives y comprar. Para publicar desde la cámara necesitas una cuenta vendedora.</p>
        <Link href="/register?role=SELLER" className="mt-5 inline-block rounded-xl bg-white px-5 py-3 text-sm font-bold text-black">
          Crear cuenta de vendedor
        </Link>
      </section>
    );
  }

  const isLive = Boolean(liveId);

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b14] shadow-2xl shadow-black/30">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative aspect-video bg-black lg:aspect-[9/16] lg:max-h-[720px]">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`h-full w-full object-cover ${cameraState === 'ready' ? '' : 'hidden'}`}
            aria-label="Vista previa de la cámara del vendedor"
          />
          <audio ref={remoteAudioRef} autoPlay className="hidden" aria-label="Audio de comprador invitado" />
          {cameraState !== 'ready' && (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#17152a] to-black text-center">
              <div className="max-w-xs px-6">
                <span className="text-5xl">🎥</span>
                <h2 className="mt-4 text-xl font-black text-white">Tu cámara, tu live</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/55">Activa cámara y micrófono para mostrar productos a tus compradores en tiempo real.</p>
                <button
                  type="button"
                  onClick={() => void requestCamera()}
                  disabled={cameraState === 'requesting'}
                  className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-black text-black disabled:opacity-50"
                >
                  {cameraState === 'requesting' ? 'Pidiendo permiso…' : 'Activar cámara y micrófono'}
                </button>
                {cameraError && <p className="mt-3 text-xs text-rose-300">{cameraError}</p>}
              </div>
            </div>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-black text-white ${isLive ? 'bg-red-600' : 'bg-black/60'}`}>
              {isLive ? '● EN VIVO' : '● ESTUDIO'}
            </span>
            {cameraState === 'ready' && (
              <>
                <span className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                  {liveKitConfigured ? 'LiveKit' : 'WebRTC local'}
                </span>
                <span className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                  {(liveKitConfigured ? liveKit.viewerCount : broadcast.viewerCount)} espectador{(liveKitConfigured ? liveKit.viewerCount : broadcast.viewerCount) === 1 ? '' : 'es'}
                </span>
              </>
            )}
          </div>
          {cameraState === 'ready' && (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={micEnabled ? 'Silenciar micrófono' : 'Activar micrófono'}
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-lg text-white backdrop-blur"
            >
              {micEnabled ? '🎙️' : '🔇'}
            </button>
          )}
        </div>

        <div className="border-t border-white/10 p-5 lg:border-l lg:border-t-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF2D75]">Estudio de transmisión</p>
          <h1 className="mt-2 text-2xl font-black text-white">Vende en vivo por cámara</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/50">Prepara la oferta, activa tu cámara y pulsa iniciar. Los compradores podrán ver el stream y comprar desde la ficha del producto.</p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/60">Título del live</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={100}
                placeholder="Ej. Zapatillas LED — oferta en vivo"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#FF2D75]/60"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/60">Categoría</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#151522] px-3 py-3 text-sm text-white outline-none focus:border-[#FF2D75]/60"
              >
                {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/60">Producto destacado (opcional)</span>
              <input
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                placeholder="Ej. Zapatillas LED Pro"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#FF2D75]/60"
              />
            </label>
            {product.trim() && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/60">Precio del producto (S/)</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={productPrice}
                  onChange={(event) => setProductPrice(event.target.value)}
                  placeholder="129.90"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#FF2D75]/60"
                />
              </label>
            )}
          </div>

          {error && <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

          <div className="mt-5 space-y-2">
            {!isLive ? (
              <button
                type="button"
                onClick={() => void startLive()}
                disabled={starting || cameraState !== 'ready' || title.trim().length < 5}
                className="w-full rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] py-3.5 font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {starting ? 'Iniciando live…' : '🔴 Iniciar live de ventas'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopLive()}
                className="w-full rounded-xl border border-red-400/40 bg-red-500/10 py-3.5 font-black text-red-300 transition hover:bg-red-500/20"
              >
                ■ Detener live
              </button>
            )}
            {cameraState !== 'ready' && <p className="text-center text-[11px] text-white/35">Activa la cámara antes de iniciar.</p>}
            {isLive && <p className="text-center text-[11px] text-emerald-300/80">ID del live: {liveId}</p>}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/40">
            <p>
              <strong className="text-white/65">Cómo funciona:</strong>{' '}
              {liveKitConfigured
                ? 'la cámara y el micrófono se transmiten por LiveKit en tiempo real. La ruta está lista para redes públicas.'
                : 'la cámara y el micrófono se transmiten por WebRTC en tiempo real. Para redes públicas, configura TURN o un proveedor HLS como Mux/LiveKit.'}
            </p>
            {isLive && <Link href="/live" className="mt-3 inline-block font-bold text-[#FF2D75] hover:underline">Ver el live como comprador →</Link>}
          </div>
        </div>
      </div>
            {isLive && (
              <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">Interacción con compradores</p>
                    <p className="mt-1 text-[11px] text-white/45">Lee lo que escriben y decide quién puede hablar.</p>
                  </div>
                  <div className="flex shrink-0 gap-2 text-right text-[11px] font-bold">
                    <span className="rounded-full bg-white/10 px-2.5 py-1.5 text-white/65">👁 {formatCount(liveKit.viewerCount)}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1.5 text-white/65">❤️ {formatCount(interaction.likes)}</span>
                  </div>
                </div>

                <div className="h-64 min-h-0">
                  <LiveChat
                    comments={interaction.comments}
                    onSend={interaction.comment}
                    connected={interaction.connected}
                  />
                </div>

                {liveKitConfigured ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-white">🎙️ Invitar a hablar</p>
                      <span className="text-[10px] text-white/35">Consentimiento del comprador</span>
                    </div>
                    {liveKit.participants.filter((participant) => participant.identity.startsWith('viewer-')).length === 0 ? (
                      <p className="mt-3 text-xs leading-relaxed text-white/40">
                        Los compradores conectados aparecerán aquí cuando entren al live.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {liveKit.participants
                          .filter((participant) => participant.identity.startsWith('viewer-'))
                          .map((participant) => {
                            const isInviting = invitingIdentity === participant.identity;
                            const isPending = participant.inviteState === 'pending';
                            const isActive = participant.inviteState === 'active' || participant.audioEnabled;
                            return (
                              <div key={participant.identity} className="flex items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-white/85">
                                    {participant.name}
                                    {participant.isSpeaking && <span className="ml-2 text-emerald-300">hablando</span>}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-white/35">
                                    {isActive ? 'Micrófono activo' : isPending ? 'Invitación pendiente' : 'Conectado al live'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void (isActive || isPending ? endConversation(participant.identity) : inviteViewer(participant.identity))}
                                  disabled={isInviting}
                                  className={`shrink-0 rounded-lg px-2.5 py-2 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${isActive || isPending ? 'border border-red-400/30 bg-red-500/10 text-red-300' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                >
                                  {isInviting ? 'Enviando…' : isPending ? 'Cancelar' : isActive ? 'Terminar' : 'Invitar'}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    )}
                    {liveKit.audioError && <p role="alert" className="mt-3 text-xs text-rose-300">{liveKit.audioError}</p>}
                    <p className="mt-3 text-[10px] leading-relaxed text-white/30">
                      El comprador recibe una solicitud y decide si activa su micrófono. No se graba esta conversación.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/70">
                    La invitación de audio está disponible cuando el live usa LiveKit. El chat y los likes ya funcionan con Socket.IO.
                  </p>
                )}
              </div>
            )}
    </section>
  );
}
