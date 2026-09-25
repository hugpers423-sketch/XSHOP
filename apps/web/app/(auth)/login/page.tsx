"use client";

// Puerta de entrada de sesión — ORDEN DE LA APP:
//  - ANTES (invitado): puedes explorar Reels, Live, Cerca y Catálogo sin cuenta;
//    el panel izquierdo muestra qué desbloquea la cuenta.
//  - DESPUÉS: el login redirige a /profile (hub de perfil, pedidos y X-Coins),
//    o a la ruta "next" desde la que se intentó entrar.

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { authLogin } from "@/lib/api";
import { track } from "@/lib/analytics";

// Beneficios post-login (qué gana el usuario al iniciar sesión)
const BENEFITS = [
  { icon: "🪙", title: "X-Coins", desc: "Gana monedas comprando y jugando." },
  { icon: "📦", title: "Mis pedidos", desc: "Sigue cada compra en tiempo real." },
  { icon: "🛡️", title: "Pago por WhatsApp", desc: "Yape/Plin con validación de soporte." },
  { icon: "❤️", title: "Favoritos y ofertas", desc: "Guarda productos y recibe alertas." },
  { icon: "🏪", title: "Vende fácil", desc: "Abre tu tienda y transmite en vivo." },
] as const;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/profile";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authLogin({ email, password });
      if (!res.ok) throw new Error(res.error || "No se pudo iniciar sesión");
      track("login", { method: "email" });
      // Orden post-login: al hub del perfil (o a la ruta origen protegida)
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field
        label="Correo electrónico"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Field
        label="Contraseña"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Validando…" : "Entrar"}
      </button>

      {params.get('reason') && (
        <p className="rounded-xl border border-violet-300/25 bg-violet-400/10 px-3 py-2 text-center text-xs text-violet-100">
          {params.get('reason') === 'follow'
            ? 'Crea tu cuenta o inicia sesión para seguir a más vendedores.'
            : params.get('reason') === 'like'
              ? 'Inicia sesión para dar like y recibir recomendaciones.'
              : 'Inicia sesión para interactuar con la comunidad.'}
        </p>
      )}

      <div className="relative my-1 flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
        <span className="h-px flex-1 bg-white/10" />
        o
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <a
        href={`/api/auth/google?next=${encodeURIComponent(nextPath)}`}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-sm font-black text-[#4285F4]">G</span>
        Continuar con Google
      </a>
      {params.get('error') === 'google_not_configured' && (
        <p className="text-center text-[11px] text-amber-300">Google OAuth está disponible; falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.</p>
      )}
      {params.get('error') && params.get('error') !== 'google_not_configured' && (
        <p className="text-center text-[11px] text-red-300">No se pudo iniciar sesión con Google. Intenta nuevamente.</p>
      )}

      <p className="text-center text-xs text-white/50">
        ¿Sin cuenta?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(nextPath)}${params.get('reason') ? `&reason=${encodeURIComponent(params.get('reason') as string)}` : ''}`}
          className="font-semibold text-[#FF2D75] hover:underline"
        >
          Regístrate gratis
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
      />
    </label>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-16">
      <div className="grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        {/* ===== ANTES del login: qué puedes hacer sin cuenta y qué desbloqueas ===== */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="hidden md:block"
        >
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold text-cyan-300">
            🎬 Reels · 📡 Live · 📍 Cerca — sin cuenta
          </span>
          <h2 className="mt-4 text-2xl font-black leading-tight text-white">
            Entra y <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">desbloquea tu cuenta</span>
          </h2>
          <p className="mt-2 text-sm text-white/55">
            Puedes explorar toda la plataforma como invitado; con tu cuenta guardas
            pedidos, ganas recompensas y vendes con pagos coordinados por WhatsApp.
          </p>

          <ul className="mt-5 space-y-3">
            {BENEFITS.map((b, i) => (
              <motion.li
                key={b.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.08 }}
                className="flex gap-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg">
                  {b.icon}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{b.title}</p>
                  <p className="text-xs leading-snug text-white/55">{b.desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <Link
            href="/"
            className="mt-6 inline-block text-xs font-semibold text-white/45 transition hover:text-white/80"
          >
            ← Seguir explorando sin cuenta
          </Link>
        </motion.div>

        {/* ===== Formulario ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl md:ml-auto"
        >
          <div className="mb-6 text-center">
            <span className="bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] bg-clip-text text-3xl font-black text-transparent">
              X-STORE
            </span>
            <h1 className="mt-2 text-lg font-bold text-white">Bienvenido de vuelta</h1>
            <p className="text-sm text-white/50">Tu marketplace social en un solo lugar</p>
          </div>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white/5" />}>
            <LoginForm />
          </Suspense>
        </motion.div>
      </div>
    </main>
  );
}
