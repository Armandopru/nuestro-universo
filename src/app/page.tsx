
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Heart, Mail, Lock, Sparkles } from "lucide-react";

export default function Home() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          setMessage("¡Cuenta creada! Entrando a Nuestro Universo...");

          const nextPath = new URLSearchParams(
  window.location.search
).get("next");

const destination =
  nextPath?.startsWith("/") &&
  !nextPath.startsWith("//") &&
  !nextPath.includes("\\")
    ? nextPath
    : "/espacio";

router.replace(destination);
router.refresh();
        } else {
          setMessage(
            "Cuenta creada. Revisa tu correo para confirmar el registro antes de iniciar sesión."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        setMessage("¡Sesión iniciada! Entrando a Nuestro Universo...");

        router.replace("/espacio");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No pudimos completar la solicitud."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0b12] px-5 py-10 text-white">
      <div className="pointer-events-none fixed -left-32 -top-32 h-96 w-96 rounded-full bg-pink-500/10 blur-[100px]" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-500/10 blur-[100px]" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-400 to-violet-500 shadow-xl shadow-pink-500/20">
            <Heart size={30} fill="white" />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">
            Nuestro Universo
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/45">
            Un pequeño lugar para dos grandes historias.
          </p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <div className="mb-7 flex items-center gap-2 text-xs text-pink-200/80">
            <Sparkles size={15} />
            Un espacio privado para Armando y Mari
          </div>

          <h2 className="text-xl font-semibold">
            {mode === "login"
              ? "Qué bonito tenerte aquí"
              : "Creemos tu cuenta"}
          </h2>

          <p className="mt-2 text-sm text-white/45">
            {mode === "login"
              ? "Inicia sesión para volver a vuestro universo."
              : "Registra tu correo para empezar a construir vuestro espacio."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm text-white/70"
              >
                Correo electrónico
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 focus-within:border-pink-300/40">
                <Mail size={18} className="text-white/30" />

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-white/25"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm text-white/70"
              >
                Contraseña
              </label>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 focus-within:border-pink-300/40">
                <Lock size={18} className="text-white/30" />

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-white/25"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 to-rose-300 py-3.5 text-sm font-semibold text-[#281322] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Heart size={16} />

              {loading
                ? "Un momento..."
                : mode === "login"
                  ? "Entrar a nuestro universo"
                  : "Crear mi cuenta"}
            </button>
          </form>

          {message && (
            <p
              aria-live="polite"
              className="mt-5 break-words rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-white/75"
            >
              {message}
            </p>
          )}

          <div className="mt-6 border-t border-white/[0.08] pt-5 text-center">
            <p className="text-sm text-white/45">
              {mode === "login"
                ? "¿Todavía no tienes cuenta?"
                : "¿Ya tienes una cuenta?"}
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setMessage("");
              }}
              className="mt-2 text-sm font-medium text-pink-300 hover:text-pink-200 disabled:opacity-50"
            >
              {mode === "login"
                ? "Crear una cuenta"
                : "Volver al inicio de sesión"}
            </button>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-white/25">
          Hecho con cariño para Armando y Mari ♥
        </p>
      </div>
    </main>
  );
}
