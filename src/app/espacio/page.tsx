
"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Users,
  LogOut,
  LoaderCircle,
  Plus,
  Sparkles,
  Copy,
  MessageCircle,
  Link2,
  BookOpen,
  CalendarHeart,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Couple = {
  id: string;
  name: string;
  created_at: string;
};

export default function EspacioPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadCouple = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        router.replace("/");
        return;
      }

      setUser(currentUser);

      const { data: membership, error: membershipError } =
        await supabase
          .from("couple_members")
          .select("couple_id")
          .eq("user_id", currentUser.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership) {
        const { data: createdCouple, error: createdError } =
          await supabase
            .from("couples")
            .select("id, name, created_at")
            .eq("created_by", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (createdError) throw createdError;

        if (createdCouple) {
          setCouple(createdCouple);
          setErrorMessage(
            "Tu espacio existe, pero tu membresía no aparece registrada. No crees otro espacio; debemos reparar la membresía."
          );
        } else {
          setCouple(null);
        }

        return;
      }

      const { data: coupleData, error: coupleError } =
        await supabase
          .from("couples")
          .select("id, name, created_at")
          .eq("id", membership.couple_id)
          .single();

      if (coupleError) throw coupleError;

      setCouple(coupleData);
    } catch (error) {
      console.error("Error al cargar el espacio:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar Nuestro Universo."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadCouple();
  }, [loadCouple]);

  async function createCouple() {
    if (!user || creating) return;

    setCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const coupleId = crypto.randomUUID();

      const { error: coupleError } = await supabase
        .from("couples")
        .insert({
          id: coupleId,
          name: "Nuestro Universo",
          created_by: user.id,
        });

      if (coupleError) throw coupleError;

      const { error: memberError } = await supabase
        .from("couple_members")
        .insert({
          couple_id: coupleId,
          user_id: user.id,
        });

      if (memberError) {
        setErrorMessage(
          "El espacio se creó, pero no pudimos registrar al miembro. No vuelvas a crear otro espacio. Detalle: " +
            memberError.message
        );
        return;
      }

      setSuccessMessage("¡Nuestro Universo ya está creado! ❤️");
      await loadCouple();
    } catch (error) {
      console.error("Error al crear el espacio:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo crear el espacio."
      );
    } finally {
      setCreating(false);
    }
  }

  async function createInvitation() {
    if (!couple || inviteLoading) return;

    setInviteLoading(true);
    setInviteError("");
    setInviteMessage("");
    setInviteUrl("");

    try {
      const { data, error } = await supabase.rpc(
        "create_couple_invitation",
        {
          target_couple: couple.id,
        }
      );

      if (error) throw error;

      if (typeof data !== "string" || !data) {
        throw new Error(
          "Supabase no devolvió un token válido para la invitación."
        );
      }

      const url = new URL(
        `/invitacion/${encodeURIComponent(data)}`,
        window.location.origin
      ).toString();

      setInviteUrl(url);
      setInviteMessage(
        "¡Enlace creado! Caduca en siete días y solo se puede utilizar una vez."
      );
    } catch (error) {
      console.error("Error al crear la invitación:", error);

      setInviteError(
        error instanceof Error
          ? error.message
          : "No se pudo generar el enlace privado."
      );
    } finally {
      setInviteLoading(false);
    }
  }

  async function copyInvitation() {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteMessage("¡Enlace copiado! Ya puedes enviárselo a Mari. ❤️");
    } catch {
      setInviteError(
        "No se pudo copiar automáticamente. Selecciona y copia el enlace manualmente."
      );
    }
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(error.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f0f14] text-white">
        <div className="flex flex-col items-center gap-4">
          <LoaderCircle className="h-9 w-9 animate-spin text-pink-400" />
          <p className="text-sm text-gray-400">
            Preparando Nuestro Universo...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0f14] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10">
              <Heart className="h-6 w-6 fill-pink-400 text-pink-400" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-pink-300">
                Nuestro espacio privado
              </p>
              <h1 className="text-xl font-bold sm:text-2xl">
                Nuestro Universo
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            {loggingOut ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </header>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300"
          >
            {successMessage}
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-300" />
            </div>

            <div className="min-w-0">
              <p className="text-sm text-gray-400">Tu cuenta</p>
              <p className="break-all font-medium">
                {user?.email ?? "Usuario autenticado"}
              </p>
            </div>
          </div>
        </section>

        {couple ? (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent p-6 sm:p-8">
              <div className="absolute -right-8 -top-8 opacity-10">
                <Heart className="h-40 w-40 fill-pink-400" />
              </div>

              <div className="relative">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1 text-xs text-green-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Espacio creado
                </div>

                <h2 className="text-3xl font-bold sm:text-4xl">
                  {couple.name}
                </h2>

                <p className="mt-3 max-w-xl leading-7 text-gray-300">
                  ¡Ya tienes vuestro espacio! Invita a Mari y comiencen a
                  guardar películas, planes y recuerdos en un mismo lugar.
                </p>

                <p className="mt-5 text-sm text-gray-500">
                  ID del espacio:{" "}
                  <span className="break-all font-mono text-gray-400">
                    {couple.id}
                  </span>
                </p>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-pink-500/20 bg-white/[0.03] p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-500/10">
                  <Heart className="h-6 w-6 text-pink-400" />
                </div>

                <div>
                  <h2 className="text-xl font-bold">Invita a Mari ❤️</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    Genera un enlace privado para que Mari pueda registrarse
                    o iniciar sesión y unirse a este mismo espacio.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={createInvitation}
                disabled={inviteLoading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 font-semibold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {inviteLoading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Link2 className="h-5 w-5" />
                )}

                {inviteLoading
                  ? "Generando invitación..."
                  : "Generar enlace privado"}
              </button>

              {inviteUrl && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <label
                    htmlFor="invitation-url"
                    className="mb-2 block text-sm font-medium text-gray-300"
                  >
                    Enlace privado para Mari
                  </label>

                  <input
                    id="invitation-url"
                    type="text"
                    readOnly
                    value={inviteUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] p-3 text-sm text-pink-200 outline-none"
                  />

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={copyInvitation}
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/5"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar enlace
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `https://wa.me/?text=${encodeURIComponent(
                            `Mari ❤️ quiero invitarte a Nuestro Universo. Entra aquí para unirte: ${inviteUrl}`
                          )}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-500"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Compartir por WhatsApp
                    </button>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-gray-500">
                    La invitación caduca en siete días y solo puede
                    utilizarse una vez. Compártela únicamente con Mari.
                  </p>
                </div>
              )}

              {inviteMessage && (
                <p role="status" className="mt-4 text-sm text-green-300">
                  {inviteMessage}
                </p>
              )}

              {inviteError && (
                <p role="alert" className="mt-4 break-words text-sm text-red-300">
                  {inviteError}
                </p>
              )}
            </section>

            {/* Accesos a las funcionalidades */}
            <section className="mt-8">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-300">
                  Su pequeño mundo
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  ¿Qué hacemos hoy?
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                  Todo lo que quieren compartir, reunido en un solo lugar.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Link
                  href="/biblioteca"
                  className="group rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-500/[0.09] to-purple-500/[0.04] p-6 transition hover:-translate-y-1 hover:border-pink-300/40 hover:bg-pink-500/[0.12]"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-400/10 text-pink-300">
                      <BookOpen size={24} />
                    </div>
                    <ArrowRight
                      size={20}
                      className="text-white/30 transition group-hover:translate-x-1 group-hover:text-pink-300"
                    />
                  </div>

                  <h3 className="text-lg font-bold transition group-hover:text-pink-200">
                    Nuestra biblioteca
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-400">
                    Películas, series, anime y doramas para ver juntos y
                    guardar el progreso de cada uno.
                  </p>

                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-pink-300">
                    Entrar a la biblioteca
                    <ArrowRight size={15} />
                  </span>
                </Link>

                
<Link
  href="/planes"
  className="group rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-500/[0.09] to-pink-500/[0.04] p-6 transition hover:-translate-y-1 hover:border-purple-300/40 hover:bg-purple-500/[0.12]"
>
  <div className="mb-5 flex items-center justify-between">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-400/10 text-purple-300">
      <CalendarHeart size={24} />
    </div>

    <ArrowRight
      size={20}
      className="text-white/30 transition group-hover:translate-x-1 group-hover:text-purple-300"
    />
  </div>

  <h3 className="text-lg font-bold transition group-hover:text-purple-200">
    Planes y recuerdos
  </h3>

  <p className="mt-2 text-sm leading-6 text-gray-400">
    Organicen sus próximas salidas, guarden momentos especiales y creen
    recuerdos juntos.
  </p>

  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-purple-300">
    Explorar nuestros planes
    <ArrowRight size={15} />
  </span>
</Link>

              </div>
            </section>
          </>
        ) : (
          <section className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 to-purple-500/5 p-8 text-center sm:p-12">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/10">
              <Heart className="h-8 w-8 fill-pink-400 text-pink-400" />
            </div>

            <h2 className="text-2xl font-bold">Crea Nuestro Universo</h2>

            <p className="mx-auto mt-3 max-w-md leading-7 text-gray-400">
              Un espacio privado para compartir películas, planes, recuerdos
              y momentos especiales con Mari.
            </p>

            <button
              type="button"
              onClick={createCouple}
              disabled={creating}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-6 py-3 font-semibold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}

              {creating ? "Creando espacio..." : "Crear Nuestro Universo"}
            </button>
          </section>
        )}

        <footer className="mt-10 pb-4 text-center text-xs text-gray-600">
          Hecho con cariño para Nuestro Universo ❤️
        </footer>
      </div>
    </main>
  );
}
