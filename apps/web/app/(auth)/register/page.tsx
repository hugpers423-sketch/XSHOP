"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { authRegister } from "@/lib/api";
import { isValidEmail, passwordStrength } from "@/lib/validate";
import { track } from "@/lib/analytics";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"BUYER" | "SELLER">("BUYER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = passwordStrength(password);
  const canSubmit = name.trim().length >= 3 && isValidEmail(email) && strength.score >= 2;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await authRegister({ name, email, password, role });
      if (!res.ok) throw new Error(res.error || "No se pudo crear la cuenta");
      track("signup", { role });
      // Orden post-login: la cuenta nueva cae en su hub de perfil
      router.push("/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-16">
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
      >
        <div className="mb-2 text-center">
          <span className="bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] bg-clip-text text-3xl font-black text-transparent">
            X-STORE
          </span>
          <h1 className="mt-2 text-lg font-bold text-white">Crea tu cuenta</h1>
          <p className="text-sm text-white/50">Compra, vende y transmite en minutos</p>
        </div>

        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">Tipo de cuenta</legend>
          {(["BUYER", "SELLER"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                role === r
                  ? "border-[#FF2D75]/60 bg-[#FF2D75]/15 text-white"
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {r === "BUYER" ? "🛍️ Comprador" : "🏪 Vendedor"}
            </button>
          ))}
        </fieldset>

        <Input label="Nombre completo" value={name} onChange={setName} autoComplete="name" />
        <Input label="Correo electrónico" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Input label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="new-password" />

        {password && (
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full transition-all ${strength.color}`}
                style={{ width: `${(strength.score / 4) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-white/45">{strength.label}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full rounded-2xl bg-gradient-to-r from-[#FF2D75] to-[#7C3AED] py-3 font-bold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Creando cuenta…" : "Crear cuenta"}
        </button>

        <p className="text-center text-xs text-white/50">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-[#FF2D75] hover:underline">
            Inicia sesión
          </Link>
        </p>
      </motion.form>
    </main>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#FF2D75]/60 focus:bg-white/10"
      />
    </label>
  );
}
