"use client";

// apps/web/app/seller/reels/new/page.tsx
// Subida de un Reel de producto: arrastre de archivo → preview → POST /api/videos.
// El upload usa XMLHttpRequest (nativo, sin librerías) para mostrar progreso real.
// Requiere sesión de vendedor: el middleware protege /seller*.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from '@/components/ui/Toast';
import { api, type AuthUser } from '@/lib/api';
import { ALLOWED_VIDEO_TYPES, MAX_UPLOAD_BYTES } from '@/lib/uploads-constants';

interface ProductOption {
  id: string;
  title: string;
  price: number;
}

const ACCEPTED = Object.keys(ALLOWED_VIDEO_TYPES).join(',');
const MAX_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

export default function NewReelPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [productId, setProductId] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.get<{ user: AuthUser | null }>('/api/auth/me');
        if (alive) setUser(me.user);
      } catch {
        // Sesión inválida o BD caída: el formulario queda deshabilitado.
      } finally {
        if (alive) setUserLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/products?perPage=50', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { data?: Array<{ id: string; title: string; price: number }> };
        if (alive && Array.isArray(body.data)) setProducts(body.data);
      } catch {
        // Sin catálogo: se muestra el aviso para crear un producto primero.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Libera el object URL del preview para no filtrar memoria.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isSeller = user?.role === 'SELLER' || user?.role === 'ADMIN' || user?.role === 'MODERATOR';
  const canSubmit =
    isSeller && Boolean(file) && caption.trim().length >= 3 && Boolean(productId) && !submitting;

  const acceptFile = useCallback((candidate: File | null | undefined) => {
    setError('');
    if (!candidate) return;

    const type = candidate.type.toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_VIDEO_TYPES, type)) {
      setError('Formato no permitido. Usa MP4, WebM, MOV o M4V.');
      return;
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      setError(`El video supera el límite de ${MAX_MB} MB.`);
      return;
    }

    setFile(candidate);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(candidate);
    });
  }, []);

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !canSubmit) return;

    setSubmitting(true);
    setProgress(0);
    setError('');

    const form = new FormData();
    form.append('file', file);
    form.append('caption', caption.trim());
    form.append('hashtags', hashtags.trim());
    form.append('productId', productId);
    form.append('durationSec', String(Math.max(1, Math.round(duration))));

    try {
      const result = await new Promise<{ ok: boolean; status: number; body: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/videos');
        xhr.withCredentials = true;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body: xhr.responseText });
        xhr.onerror = () => reject(new Error('No se pudo subir el video'));
        xhr.onabort = () => reject(new Error('Subida cancelada'));
        xhr.send(form);
      });

      if (!result.ok) {
        let message = 'No se pudo subir el video';
        try {
          const parsed = JSON.parse(result.body) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          // Respuesta no JSON: se conserva el mensaje genérico.
        }
        throw new Error(message);
      }

      toast.success('¡Reel publicado en el feed! 🎬');
      router.push('/reels');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">🎬 Subir Reel de producto</h1>
          <p className="mt-1 text-sm text-white/45">
            Publica un video vertical en el feed. El público lo ve sin cuenta; comprar y dar like sí requieren sesión.
          </p>
        </div>
        <Link
          href="/seller"
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          ← Portal del vendedor
        </Link>
      </div>

      {!userLoaded && <p className="mt-6 animate-pulse text-sm text-white/40">Verificando sesión…</p>}

      {userLoaded && !isSeller && (
        <p role="alert" className="mt-6 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">
          Necesitas una cuenta de vendedor para publicar Reels.{' '}
          <Link href="/login?next=/seller/reels/new" className="font-bold underline">
            Inicia sesión
          </Link>
        </p>
      )}

      {userLoaded && isSeller && (
        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          {/* Zona de arrastre */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`relative overflow-hidden rounded-3xl border-2 border-dashed p-4 transition ${
              dragging ? 'border-violet-400/70 bg-violet-500/10' : 'border-white/15 bg-white/5'
            }`}
          >
            {previewUrl ? (
              <div className="relative mx-auto aspect-[9/16] max-h-[420px] w-full overflow-hidden rounded-2xl bg-black">
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="h-full w-full object-contain"
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                    setDuration(0);
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs font-bold text-white"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <label
                htmlFor="reel-file"
                className="flex w-full cursor-pointer flex-col items-center gap-2 py-14 text-center"
              >
                <span className="text-4xl">📱</span>
                <span className="text-sm font-black text-white">Arrastra tu video vertical aquí</span>
                <span className="text-xs text-white/40">
                  o haz clic para buscar · MP4, WebM, MOV o M4V · máx. {MAX_MB} MB
                </span>
              </label>
            )}
            <input
              ref={inputRef}
              id="reel-file"
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              onChange={(event) => acceptFile(event.target.files?.[0])}
            />
          </div>

          {file && (
            <p className="text-xs text-white/40">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
              {duration > 0 ? ` · ${duration.toFixed(1)} s` : ''}
            </p>
          )}

          {/* Producto que se vende en el video */}
          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-white/50">Producto del video</span>
            {products.length === 0 ? (
              <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-200">
                Todavía no tienes productos publicados.{' '}
                <Link href="/seller/products/new" className="font-bold underline">
                  Crea uno primero
                </Link>{' '}
                para que el Reel sea comprable.
              </p>
            ) : (
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white"
              >
                <option value="">Selecciona un producto…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.title} — S/ {product.price.toFixed(2)}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-white/50">Texto del reel</span>
            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={220}
              rows={3}
              placeholder="Ej: El hoodie que se agota en cada live 🔥"
              className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25"
            />
            <span className="mt-1 block text-right text-[10px] text-white/30">{caption.length}/220</span>
          </label>

          <label className="block">
            <span className="text-xs font-black uppercase tracking-widest text-white/50">Hashtags</span>
            <input
              value={hashtags}
              onChange={(event) => setHashtags(event.target.value)}
              placeholder="moda oferta lima"
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25"
            />
          </label>

          {submitting && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-white/45">Subiendo… {progress}%</p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-5 py-3.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Publicando…' : 'Publicar en el feed'}
          </button>
        </form>
      )}
    </main>
  );
}
