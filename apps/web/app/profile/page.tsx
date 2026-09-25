"use client";

// Perfil de usuario — datos, pedidos recientes, X-Coins y logout

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { api, authLogout, type AuthUser } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { openWhatsAppSupport } from "@/lib/whatsapp";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/15 text-yellow-300",
  PAID: "bg-blue-500/15 text-blue-300",
  SHIPPED: "bg-violet-500/15 text-violet-300",
  DELIVERED: "bg-[#00E7A5]/15 text-[#00E7A5]",
  CANCELLED: "bg-red-500/15 text-red-300",
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  // Cargar usuario + pedidos al montar (reintentable sin bucles de redirección)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.get<{ user: AuthUser | null }>("/api/auth/me");
        if (!alive) return;
        setUser(me.user);
        if (me.user) {
          // Pedidos opcionales: el perfil se muestra aunque fallen
          try {
            const res = await api.get<{ data: Order[] }>(
              `/api/orders?buyerId=${me.user.id}&perPage=5`
            );
            if (alive) setOrders(res.data ?? []);
          } catch {
            // Sin pedidos seguimos mostrando el perfil
          }
        }
      } catch {
        // Error de red/servidor: mostrar estado de reintento (sin redirect en bucle)
        if (alive) setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await authLogout();
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl animate-pulse px-4 py-8">
        <div className="h-28 rounded-3xl bg-white/5" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/5" />
          ))}
        </div>
      </main>
    );
  }

  // Fallo de conexión: estado de reintento (evita bucles de redirección)
  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-4xl">📡</p>
        <h1 className="mt-3 text-xl font-black text-white">No pudimos cargar tu perfil</h1>
        <p className="mt-1 text-sm text-white/50">Revisa tu conexión e inténtalo de nuevo.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setLoadError(false);
              setAttempt((a) => a + 1);
              setLoading(true);
            }}
            className="rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] px-5 py-3 text-sm font-bold text-white transition active:scale-95"
          >
            Reintentar
          </button>
          <Link
            href="/login?next=/profile"
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white/80 transition hover:border-white/30"
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  // Sesión expirada o inválida: orden claro antes/después del login
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-4xl">🔐</p>
        <h1 className="mt-3 text-xl font-black text-white">Tu sesión terminó</h1>
        <p className="mt-1 text-sm text-white/50">
          Inicia sesión para ver tu perfil, tus pedidos y tus X-Coins.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/login?next=/profile"
            className="rounded-xl bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] px-5 py-3 text-sm font-bold text-white transition active:scale-95"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white/80 transition hover:border-white/30"
          >
            Crear cuenta
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-24">
      {/* Encabezado */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#FF2D75]/15 via-white/5 to-[#7B5CFF]/15 p-6"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FF2D75] to-[#7B5CFF] text-2xl font-black text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-white">{user.name}</h1>
            <p className="truncate text-sm text-white/50">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/70">
              {user.role === "SELLER" ? "🏪 Vendedor" : user.role === "ADMIN" ? "🛡️ Admin" : "🛍️ Comprador"}
            </span>
          </div>
        </div>

        {/* X-Coins gamificación */}
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#FFD166]/25 bg-[#FFD166]/10 px-4 py-3">
          <span className="text-sm font-semibold text-[#FFD166]">🪙 X-Coins</span>
          <span className="font-black text-[#FFD166]">
            {((user as AuthUser & { xCoins?: number }).xCoins ?? 0).toLocaleString("es-PE")}
          </span>
        </div>
      </motion.section>

      {/* Acciones */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/orders", label: "📦 Mis pedidos", },
          { href: "/compra", label: "🛡️ Compra segura" },
          { href: "/seller", label: "🏪 Mi tienda" },
          { href: "/reels", label: "🎬 Reels" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-sm font-semibold text-white/80 transition hover:border-[#FF2D75]/40 hover:bg-white/10"
          >
            {a.label}
          </Link>
        ))}
      </section>

      {/* Pedidos recientes */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Pedidos recientes</h2>
          <Link href="/orders" className="text-sm text-[#FF2D75] hover:underline">
            Ver todos
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">
            Aún no tienes pedidos.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-white/25"
                >
                  <div>
                    <p className="font-mono text-sm font-bold text-white">{o.orderNumber}</p>
                    <p className="text-xs text-white/40">
                      {new Date(o.createdAt).toLocaleDateString("es-PE")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        STATUS_COLORS[o.status] ?? "bg-white/10 text-white/70"
                      }`}
                    >
                      {o.status}
                    </span>
                    <p className="mt-1 font-black text-white">{formatPrice(o.total)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Soporte + logout */}
      <section className="mt-8 space-y-3">
        <button
          onClick={openWhatsAppSupport}
          className="w-full rounded-2xl border border-[#00E7A5]/30 bg-[#00E7A5]/10 px-4 py-4 text-sm font-semibold text-[#00E7A5] transition hover:bg-[#00E7A5]/15"
        >
          🆘 Ayuda vía WhatsApp
        </button>
        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm font-semibold text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
        >
          {loggingOut ? "Cerrando sesión…" : "🚪 Cerrar sesión"}
        </button>
      </section>
    </main>
  );
}
