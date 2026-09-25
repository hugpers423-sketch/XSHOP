"use client";

// apps/web/app/seller/products/new/page.tsx
// Publicación de producto: formulario validado → POST /api/products (real).
// Requiere sesión (middleware protege /seller*): si la BD está caída o la
// cookie no resuelve usuario, se avisa y se deshabilita el envío.

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { api, type AuthUser } from "@/lib/api";
import { toast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { useRouter } from "next/navigation";

export default function NewProductPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [stock, setStock] = useState("1");
  const [location, setLocation] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Obtener el vendedor autenticado (sellerId del POST)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.get<{ user: AuthUser | null }>("/api/auth/me");
        if (alive) setUser(me.user);
      } catch {
        // BD caída o sesión inválida: se maneja con userLoaded + user null
      } finally {
        if (alive) setUserLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const priceNum = Number(price.replace(",", "."));
  const stockNum = Number(stock);
  const compareNum = compareAt ? Number(compareAt.replace(",", ".")) : undefined;
  const hasImage = image.trim().length > 0;

  const canSubmit =
    title.trim().length >= 5 &&
    description.trim().length >= 20 &&
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    Number.isInteger(stockNum) &&
    stockNum >= 1 &&
    (!hasImage || /^https?:\/\/\S+$/i.test(image.trim())) &&
    (compareNum === undefined || (Number.isFinite(compareNum) && compareNum > priceNum));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!user?.id) {
      setError("No se pudo identificar tu cuenta. Inicia sesión como vendedor.");
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        stock: stockNum,
        sellerId: user.id,
      };
      if (compareNum !== undefined) body.compareAtPrice = compareNum;
      if (location.trim()) body.location = location.trim();
      if (hasImage) body.images = [image.trim()];

      await api.post<{ data: { id: string } }>("/api/products", body);
      track("product_create", { hasImage, hasCompare: compareNum !== undefined });
      toast.success("Producto publicado 🏷️");
      router.push("/seller");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(
        /HTTP 500|Error al crear|Error interno/i.test(msg)
          ? "No se pudo publicar: ¿está la base de datos activa? Intenta de nuevo en unos segundos."
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-24">
      <Link href="/seller" className="text-xs text-white/50 transition hover:text-white">
        ← Mi portal
      </Link>
      <h1 className="mt-1 text-2xl font-black text-white">🏷️ Nuevo producto</h1>
      <p className="mt-1 text-sm text-white/45">
        Publica en tu tienda para venderlo en catálogo, Reels y lives.
      </p>

      {userLoaded && !user && (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
        >
          Necesitas una sesión de vendedor para publicar.{" "}
          <Link href="/login?next=/seller/products/new" className="font-bold underline">
            Inicia sesión
          </Link>
        </div>
      )}

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"
      >
        {/* Título */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-white/60">Título *</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            placeholder="Audífonos Bluetooth Pro ANC"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
          />
          <span className="mt-1 block text-[11px] text-white/40">
            {title.trim().length >= 5 ? "✓ Listo" : "Mínimo5 caracteres"}
          </span>
        </label>

        {/* Descripción */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-white/60">Descripción *</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={4}
            required
            placeholder="Describe materiales, medidas, garantía y por qué vale la pena…"
            className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
          />
          <span className="mt-1 block text-[11px] text-white/40">
            {description.trim().length >= 20 ? "✓ Listo" : "Mínimo20 caracteres"} ·{" "}
            {description.length}/5000
          </span>
        </label>

        {/* Precio / precio tachado / stock */}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Precio S/ *</span>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              placeholder="189.90"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">
              Precio tachado (opcional)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={compareAt}
              onChange={(e) => setCompareAt(e.target.value)}
              placeholder="299.90"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Stock *</span>
            <input
              type="number"
              min={1}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-[#FF2D75]/60 focus:bg-white/10"
            />
          </label>
        </div>

        {/* Ubicación + imagen */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">
              Ubicación (opcional)
            </span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder="Lima, Perú"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">
              Imagen (URL, opcional)
            </span>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://…/producto.jpg"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
            />
          </label>
        </div>

        {/* Vista previa de la imagen */}
        {hasImage && /^https?:\/\/\S+$/i.test(image.trim()) && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.trim()}
              alt="Vista previa del producto"
              className="max-h-52 w-full object-contain"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting || !user}
          className="w-full rounded-2xl bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {submitting ? "Publicando…" : "Publicar producto"}
        </button>
      </motion.form>
    </main>
  );
}
