"use client";

// apps/web/app/seller/live/new/page.tsx
// Preparación de un nuevo live: formulario de programación + guía de tips.
// El estudio de cámara está en /seller/live/studio. Esta vista conserva la
// programación opcional y usa POST /api/lives cuando se proporciona una URL
// o se habilita NEXT_PUBLIC_LIVES_API=enabled.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LiveTips } from "@/components/seller/LiveTips";
import { api, searchProducts, type ProductSummary } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-context";

const CATEGORIES = [
  "Moda y accesorios",
  "Tecnología",
  "Hogar y vida",
  "Belleza y cuidado",
  "Deportes",
  "Gastronomía",
];

// Flag de backend: activar con NEXT_PUBLIC_LIVES_API=enabled para publicar
// también una transmisión HLS/MP4 preparada desde este formulario.
const LIVES_API_ENABLED = process.env.NEXT_PUBLIC_LIVES_API === "enabled";

interface LiveDraftPayload {
  title: string;
  category: string | null;
  startAt: string | null;
  promo: string | null;
  streamUrl: string | null;
  pinnedProductIds: string[];
}

export default function NewLivePage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [promo, setPromo] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [pinned, setPinned] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const { user, requireAuth } = useAuth();

  const canSubmit = title.trim().length >= 5;

  // Productos candidatos a fijar (catálogo disponible) — tolerante a BD caída
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const prods = await searchProducts({});
        if (alive) setProducts(prods.slice(0, 12));
      } catch {
        // Sin catálogo: el formulario sigue siendo usable sin productos fijados
      } finally {
        if (alive) setProductsLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function togglePin(id: string) {
    setPinned((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) {
        toast.info("Puedes fijar hasta3 productos en tu live");
        return prev;
      }
      return [...prev, id];
    });
  }

  // Guarda borrador local cuando el backend de lives no existe aún
  function saveLocalDraft(payload: LiveDraftPayload): boolean {
    try {
      const raw = localStorage.getItem("xstore_live_drafts");
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      list.push({ ...payload, createdAt: new Date().toISOString() });
      localStorage.setItem("xstore_live_drafts", JSON.stringify(list.slice(-20)));
      return true;
    } catch {
      // Almacenamiento no disponible (modo privado/cuota): no bloquea el éxito
      return false;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (title.trim().length < 5) {
      setError("El título debe tener al menos5 caracteres.");
      return;
    }

    // Fecha no puede ser en el pasado (fecha local)
    if (date) {
      const d = new Date();
      const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      if (date < todayISO) {
        setError("La fecha del live no puede estar en el pasado.");
        return;
      }
    }

    const wantsServer = LIVES_API_ENABLED || Boolean(streamUrl.trim());
    if (wantsServer) {
      if (!user) {
        requireAuth();
        return;
      }
      if (user.role !== "SELLER" && user.role !== "ADMIN" && user.role !== "MODERATOR") {
        setError("Necesitas una cuenta de vendedor para publicar un live.");
        return;
      }
    }

    const payload: LiveDraftPayload = {
      title: title.trim(),
      category: category || null,
      startAt: date ? `${date}T${time || "19:00"}` : null,
      promo: promo.trim() || null,
      streamUrl: streamUrl.trim() || null,
      pinnedProductIds: pinned,
    };

    setSubmitting(true);
    try {
      let persistedOnServer = false;
      if (wantsServer) {
        try {
          await api.post<{ data: { id: string } }>("/api/lives", payload);
          persistedOnServer = true;
        } catch {
          // Backend no disponible → borrador local (no pierde la preparación)
          saveLocalDraft(payload);
        }
      } else {
        // Backend de lives aún no existe: guardado local sin tráfico de red
        saveLocalDraft(payload);
      }

      track("live_create", {
        scheduled: Boolean(date),
        pinned: pinned.length,
        server: persistedOnServer,
      });
      toast.success(
        persistedOnServer
          ? "Live creado 📡 listo para salir al aire"
          : "Live preparado 📡 — guardado en este dispositivo"
      );
      setCreated(payload.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar el live.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setTitle("");
    setCategory("");
    setDate("");
    setTime("");
    setPromo("");
    setStreamUrl("");
    setPinned([]);
    setError("");
    setCreated(null);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-24">
      {/* Encabezado */}
      <div>
        <Link
          href="/seller"
          className="text-xs text-white/50 transition hover:text-white"
        >
          ← Mi portal
        </Link>
        <h1 className="mt-1 text-2xl font-black text-white">📡 Nuevo live</h1>
        <p className="mt-1 text-sm text-white/45">
          Prepara tu transmisión y revisa la guía para que venda más.
        </p>
        <Link
          href="/seller/live/studio"
          className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-black transition hover:bg-white/85"
        >
          🎥 Abrir estudio con cámara
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* ---------- Formulario / confirmación ---------- */}
        <div>
          {created ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              aria-live="polite"
              className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6"
            >
              <span className="text-4xl" aria-hidden>
                📡
              </span>
              <h2 className="mt-3 text-xl font-black text-white">
                Live preparado: “{created}”
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Antes de salir al aire, recuerda lo esencial:
              </p>
              <ul className="mt-3 space-y-2">
                {[
                  "Luz de frente y sonido probado — los primeros10 segundos enganchan.",
                  "Saluda por nombre y anuncia tu oferta de inmediato.",
                  "Fija2–3 productos y lanza la trivia con X-Coins para retener.",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 text-[#34D399]">
                      ✓
                    </span>
                    <span className="text-sm text-white/70">{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/live"
                  className="rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7B5CFF] px-4 py-2.5 text-sm font-bold text-white"
                >
                  Ver lives →
                </Link>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:border-[#FF2D75]/50"
                >
                  Programar otro
                </button>
                <Link
                  href="/seller"
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:text-white"
                >
                  Volver a mi portal
                </Link>
              </div>
            </motion.section>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={onSubmit}
              className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              {/* Título */}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/60">
                  Título del live *
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                  placeholder="Ofertas Flash de tecnología — solo hoy"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
                />
                <span className="mt-1 block text-[11px] text-white/40">
                  {title.trim().length >= 5 ? "✓ Listo" : "Mínimo5 caracteres"}
                </span>
              </label>

              {/* Categoría + fecha/hora */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-white/60">
                    Categoría
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#FF2D75]/60 [&>option]:bg-zinc-900"
                  >
                    <option value="">Sin categoría</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-white/60">
                      Fecha
                    </span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none transition [color-scheme:dark] focus:border-[#FF2D75]/60"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-white/60">
                      Hora
                    </span>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none transition [color-scheme:dark] focus:border-[#FF2D75]/60"
                    />
                  </label>
                </div>
              </div>

              {/* Oferta destacada */}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/60">
                  Oferta destacada (opcional)
                </span>
                <input
                  type="text"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  maxLength={80}
                  placeholder="40% solo en el live + envío mañana"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-white/60">
                  URL de transmisión (HLS/MP4, opcional)
                </span>
                <input
                  type="url"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="https://tu-proveedor.com/live/stream.m3u8"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
                />
                <span className="mt-1 block text-[11px] text-white/40">Sin URL se guarda un borrador local; con URL se publica en el listado Live.</span>
              </label>

              {/* Productos fijados */}
              <fieldset>
                <legend className="mb-2 block text-xs font-medium text-white/60">
                  Productos fijados (opcional, hasta3)
                </legend>
                {!productsLoaded ? (
                  <p className="animate-pulse text-sm text-white/40">
                    Cargando tu catálogo…
                  </p>
                ) : products.length === 0 ? (
                  <p className="text-sm text-white/50">
                    Aún no tienes productos en el catálogo —{" "}
                    <Link
                      href="/seller/products/new"
                      className="font-semibold text-[#FF2D75] hover:underline"
                    >
                      publica tu primer producto
                    </Link>{" "}
                    para fijarlo en tu live.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {products.map((p) => {
                      const isPinned = pinned.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePin(p.id)}
                          aria-pressed={isPinned}
                          className={`max-w-[220px] truncate rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                            isPinned
                              ? "border-[#FF2D75]/60 bg-[#FF2D75]/15 text-white"
                              : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {isPinned ? "📌 " : "＋ "}
                          {p.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>

              {/* Error */}
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="w-full rounded-2xl bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? "Preparando…" : "📡 Preparar mi live"}
              </button>
            </motion.form>
          )}
        </div>

        {/* ---------- Guía de tips (el núcleo de la petición) ---------- */}
        <div>
          <LiveTips variant="full" />
        </div>
      </div>
    </main>
  );
}
