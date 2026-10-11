
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Heart, LoaderCircle } from "lucide-react";

function InvitationContent() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(
    "Comprobando tu invitación..."
  );
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkInvitation() {
      try {
        if (!token) {
          setMessage("No encontramos el código de la invitación.");
          setLoading(false);
          return;
        }

        setMessage("Paso 1 de 2: comprobando tu sesión...");

        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (cancelled) return;

        if (sessionError) {
          throw new Error(
            `Error al comprobar la sesión: ${sessionError.message}`
          );
        }

        if (!data.session) {
          setMessage(
            "Inicia sesión o crea tu cuenta para aceptar la invitación."
          );
          setNeedsLogin(true);
          setLoading(false);
          return;
        }

        setMessage("Paso 2 de 2: validando el enlace con Supabase...");

        const { data: coupleId, error: inviteError } =
          await supabase.rpc("accept_couple_invitation", {
            supplied_token: token,
          });

        if (cancelled) return;

        if (inviteError) {
          throw new Error(
            `Error al aceptar la invitación: ${inviteError.message}`
          );
        }

        if (!coupleId) {
          throw new Error(
            "Supabase no devolvió el identificador del espacio."
          );
        }

        setMessage(
          "¡Invitación aceptada! Entrando a Nuestro Universo ❤️"
        );
        setLoading(false);

        router.replace("/espacio");
        router.refresh();
      } catch (err) {
        if (cancelled) return;

        const detail =
          err instanceof Error
            ? err.message
            : "Ocurrió un error inesperado.";

        console.error("Error en la invitación:", err);

        setMessage(detail);
        setError(true);
        setLoading(false);
      }
    }

    void checkInvitation();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const loginUrl =
    `/?next=${encodeURIComponent(`/invitacion/${token}`)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0f14] px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-pink-500/20 bg-white/[0.04] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/10">
          <Heart className="h-8 w-8 text-pink-400" />
        </div>

        <p className="mb-2 text-sm font-medium tracking-widest text-pink-300">
          UNA INVITACIÓN ESPECIAL
        </p>

        <h1 className="text-3xl font-bold">
          Nuestro Universo
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-300">
          Un pequeño espacio para compartir películas,
          series, planes, recuerdos y momentos especiales.
          Ahora tienes una invitación para formar parte de él.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-gray-200">
          {loading && (
            <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-pink-400" />
          )}

          <p>{message}</p>
        </div>

        {needsLogin && (
          <Link
            href={loginUrl}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-pink-500 px-6 py-3 font-semibold text-white transition hover:bg-pink-400"
          >
            Iniciar sesión o registrarme
          </Link>
        )}

        {error && (
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl border border-white/15 px-6 py-3 text-sm font-medium transition hover:bg-white/10"
          >
            Intentar de nuevo
          </button>
        )}

        {!loading && !needsLogin && !error && (
          <Link
            href="/espacio"
            className="mt-5 inline-block text-sm text-pink-300 hover:text-pink-200"
          >
            Ir a Nuestro Universo
          </Link>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Un espacio privado para compartir momentos juntos ♥
        </p>
      </section>
    </main>
  );
}

export default function InvitationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0f0f14] px-5 text-white">
          <div className="text-center">
            <LoaderCircle className="mx-auto mb-4 h-8 w-8 animate-spin text-pink-400" />
            <p className="text-sm text-gray-300">
              Preparando tu invitación...
            </p>
          </div>
        </main>
      }
    >
      <InvitationContent />
    </Suspense>
  );
}
