"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft, BookOpen, Check, ChevronDown, Clapperboard, Film,
  LoaderCircle, Pencil, Plus, Search, Star, Trash2, Tv, X, Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ItemType = "pelicula" | "serie" | "anime" | "dorama";
type CatalogResult = {
  id: string; title: string; description: string; posterUrl: string | null;
  year: number | null; itemType: ItemType;
};
type LibraryItem = {
  id: string; couple_id: string; title: string; item_type: ItemType;
  description: string | null; poster_url: string | null; release_year: number | null;
  created_by: string; created_at: string;
};
type ViewingProgress = {
  id: string; library_item_id: string; user_id: string; season_number: number;
  episode_number: number; watched_minutes: number; rating: number | null;
  is_completed: boolean; updated_at: string;
};
type WatchedEpisode = {
  id: string; library_item_id: string; user_id: string; season_number: number;
  episode_number: number; watched_at: string;
};
type SeasonEpisodeCount = {
  id: string; library_item_id: string; user_id: string; season_number: number;
  total_episodes: number; updated_at: string;
};
type ItemForm = {
  title: string; item_type: ItemType; description: string;
  poster_url: string; release_year: string;
};
type ProgressForm = {
  season_number: string; episode_number: string; watched_minutes: string;
  rating: string; is_completed: boolean;
};

const emptyItemForm: ItemForm = {
  title: "", item_type: "pelicula", description: "", poster_url: "", release_year: "",
};
const emptyProgressForm: ProgressForm = {
  season_number: "1", episode_number: "1", watched_minutes: "0", rating: "", is_completed: false,
};
const typeLabels: Record<ItemType, string> = {
  pelicula: "Película", serie: "Serie", anime: "Anime", dorama: "Dorama",
};
const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#111118] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-400/50";

function progressKey(itemId: string, userId: string) {
  return `${itemId}:${userId}`;
}

function displayMember(memberId: string, currentUserId: string) {
  if (memberId === "e0ed1b3f-faca-4de2-8823-e8f4abea07c5") {
    return "Nando";
  }

  if (memberId === "e4038101-c225-492e-9380-023f653af5a5") {
    return "Mari";
  }

  return memberId === currentUserId ? "Tú" : "Integrante";
}

export default function BibliotecaPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ViewingProgress>>({});
  const [watchedEpisodes, setWatchedEpisodes] = useState<Record<string, WatchedEpisode[]>>({});
  const [seasonCounts, setSeasonCounts] = useState<Record<string, SeasonEpisodeCount[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | ItemType>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendientes" | "terminados">("todos");
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogResult[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [progressItem, setProgressItem] = useState<LibraryItem | null>(null);
  const [progressForm, setProgressForm] = useState<ProgressForm>(emptyProgressForm);
  const [episodeCountInput, setEpisodeCountInput] = useState("12");

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { user: currentUser }, error: sessionError } = await supabase.auth.getUser();
      if (sessionError) throw sessionError;
      if (!currentUser) { router.replace("/"); return; }
      setUser(currentUser);

      const { data: membership, error: membershipError } = await supabase
        .from("couple_members").select("couple_id").eq("user_id", currentUser.id).limit(1).maybeSingle();
      if (membershipError) throw membershipError;

      if (!membership?.couple_id) {
        setCoupleId(null); setMemberIds([]); setItems([]);
        setProgressMap({}); setWatchedEpisodes({}); setSeasonCounts({});
        setError("Tu cuenta todavía no pertenece a un espacio compartido. Vuelve al panel principal para revisar tu espacio.");
        return;
      }

      const currentCoupleId = membership.couple_id as string;
      setCoupleId(currentCoupleId);
      const { data: libraryData, error: libraryError } = await supabase
        .from("library_items").select("*").eq("couple_id", currentCoupleId)
        .order("created_at", { ascending: false });
      if (libraryError) throw libraryError;

      const libraryItems = (libraryData ?? []) as LibraryItem[];
      setItems(libraryItems);
      if (libraryItems.length === 0) {
        setMemberIds([currentUser.id]);
        setProgressMap({}); setWatchedEpisodes({}); setSeasonCounts({});
        return;
      }

      const itemIds = libraryItems.map((item) => item.id);
      // Include the current user even if RLS hides the partner's membership row.
      const { data: members, error: membersError } = await supabase
        .from("couple_members").select("user_id").eq("couple_id", currentCoupleId);
      if (membersError) throw membersError;
      const ids = [...new Set([currentUser.id, ...(members ?? []).map((m) => m.user_id as string)])];
      setMemberIds(ids);

      const [
        { data: progressData, error: progressError },
        { data: watchedData, error: watchedError },
        { data: seasonCountData, error: seasonCountError },
      ] = await Promise.all([
        supabase.from("viewing_progress").select("*").in("user_id", ids).in("library_item_id", itemIds),
        supabase.from("watched_episodes").select("*").in("user_id", ids).in("library_item_id", itemIds)
          .order("season_number", { ascending: true }).order("episode_number", { ascending: true }),
        supabase.from("season_episode_counts").select("*").in("user_id", ids).in("library_item_id", itemIds),
      ]);
      if (progressError) throw progressError;
      if (watchedError) throw watchedError;
      if (seasonCountError) throw seasonCountError;

      const nextProgress: Record<string, ViewingProgress> = {};
      for (const p of (progressData ?? []) as ViewingProgress[]) nextProgress[progressKey(p.library_item_id, p.user_id)] = p;
      const nextWatched: Record<string, WatchedEpisode[]> = {};
      for (const ep of (watchedData ?? []) as WatchedEpisode[]) {
        const key = progressKey(ep.library_item_id, ep.user_id);
        if (!nextWatched[key]) nextWatched[key] = [];
        nextWatched[key].push(ep);
      }
      const nextCounts: Record<string, SeasonEpisodeCount[]> = {};
      for (const count of (seasonCountData ?? []) as SeasonEpisodeCount[]) {
        const key = progressKey(count.library_item_id, count.user_id);
        if (!nextCounts[key]) nextCounts[key] = [];
        nextCounts[key].push(count);
      }
      setProgressMap(nextProgress); setWatchedEpisodes(nextWatched); setSeasonCounts(nextCounts);
    } catch (err) {
      console.error("Error cargando la biblioteca:", err);
      setError(err instanceof Error ? err.message : "No se pudo cargar la biblioteca.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  async function searchCatalog() {
    const query = catalogSearch.trim();
    if (query.length < 2) { setCatalogError("Escribe al menos dos caracteres para buscar."); setCatalogResults([]); return; }
    setCatalogLoading(true); setCatalogError(""); setCatalogResults([]);
    try {
      const params = new URLSearchParams({ q: query, tipo: itemForm.item_type });
      const response = await fetch(`/api/catalogo?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudieron encontrar resultados.");
      const results = (data.results ?? []) as CatalogResult[];
      setCatalogResults(results);
      if (!results.length) setCatalogError(
        itemForm.item_type === "anime"
          ? "No encontramos ese anime. Prueba con su nombre en japonés, inglés o español."
          : itemForm.item_type === "dorama" ? "No encontramos ese dorama. Prueba con otro nombre." : "No encontramos resultados. Prueba con otro nombre."
      );
    } catch (err) {
      console.error("Error buscando en el catálogo:", err);
      setCatalogError(err instanceof Error ? err.message : "Ocurrió un error al buscar.");
    } finally { setCatalogLoading(false); }
  }

  function selectCatalogResult(result: CatalogResult) {
    setItemForm({ title: result.title, item_type: result.itemType, description: result.description, poster_url: result.posterUrl ?? "", release_year: result.year?.toString() ?? "" });
    setCatalogResults([]); setCatalogSearch(""); setCatalogError(""); setError(""); setSuccess("");
  }

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !normalizedSearch || item.title.toLowerCase().includes(normalizedSearch) || (item.description ?? "").toLowerCase().includes(normalizedSearch);
      const matchesType = filter === "todos" || item.item_type === filter;
      const progress = user ? progressMap[progressKey(item.id, user.id)] : undefined;
      const matchesStatus = statusFilter === "todos" ||
        (statusFilter === "terminados" && progress?.is_completed === true) ||
        (statusFilter === "pendientes" && progress?.is_completed !== true);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [items, search, filter, statusFilter, progressMap, user]);

  function resetCatalogSearch() { setCatalogSearch(""); setCatalogResults([]); setCatalogError(""); setCatalogLoading(false); }
  function openNewItemForm() { setEditingItem(null); setItemForm(emptyItemForm); resetCatalogSearch(); setError(""); setSuccess(""); setShowItemForm(true); }
  function openEditItemForm(item: LibraryItem) {
    setEditingItem(item);
    setItemForm({ title: item.title, item_type: item.item_type, description: item.description ?? "", poster_url: item.poster_url ?? "", release_year: item.release_year?.toString() ?? "" });
    resetCatalogSearch(); setError(""); setSuccess(""); setShowItemForm(true);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !coupleId) { setError("No encontramos tu sesión o tu espacio compartido."); return; }
    const title = itemForm.title.trim();
    if (!title) { setError("Escribe el título de la película o serie."); return; }
    const releaseYear = itemForm.release_year.trim() ? Number(itemForm.release_year) : null;
    if (releaseYear !== null && (!Number.isInteger(releaseYear) || releaseYear < 1888 || releaseYear > new Date().getFullYear() + 10)) {
      setError("Escribe un año válido."); return;
    }
    if (itemForm.poster_url.trim()) {
      try { const url = new URL(itemForm.poster_url.trim()); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
      catch { setError("La URL del póster debe ser una dirección HTTP o HTTPS válida."); return; }
    }
    setSaving(true); setError(""); setSuccess("");
    const payload = { title, item_type: itemForm.item_type, description: itemForm.description.trim() || null, poster_url: itemForm.poster_url.trim() || null, release_year: releaseYear };
    try {
      if (editingItem) {
        const { error: updateError } = await supabase.from("library_items").update(payload).eq("id", editingItem.id).eq("couple_id", coupleId);
        if (updateError) throw updateError;
        setSuccess("Los cambios se guardaron correctamente.");
      } else {
        const { error: insertError } = await supabase.from("library_items").insert({ ...payload, couple_id: coupleId, created_by: user.id });
        if (insertError) throw insertError;
        setSuccess("¡Título agregado a su biblioteca!");
      }
      setShowItemForm(false); setEditingItem(null); setItemForm(emptyItemForm); resetCatalogSearch();
      await loadLibrary();
    } catch (err) {
      console.error("Error guardando el título:", err);
      setError(err instanceof Error ? err.message : "No se pudo guardar el título.");
    } finally { setSaving(false); }
  }

  function openProgressForm(item: LibraryItem) {
    const key = user ? progressKey(item.id, user.id) : "";
    const existing = progressMap[key];
    setProgressItem(item);
    setProgressForm(existing ? {
      season_number: String(existing.season_number), episode_number: String(existing.episode_number),
      watched_minutes: String(existing.watched_minutes), rating: existing.rating === null ? "" : String(existing.rating),
      is_completed: existing.is_completed,
    } : emptyProgressForm);
    const savedCount = (seasonCounts[key] ?? []).find((entry) => entry.season_number === (existing?.season_number ?? 1));
    setEpisodeCountInput(savedCount ? String(savedCount.total_episodes) : "12");
    setError(""); setSuccess("");
  }

  async function saveProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !progressItem) return;
    const season = Number(progressForm.season_number), episode = Number(progressForm.episode_number), minutes = Number(progressForm.watched_minutes);
    const rating = progressForm.rating.trim() === "" ? null : Number(progressForm.rating);
    if (!Number.isInteger(season) || season < 1 || !Number.isInteger(episode) || episode < 1) { setError("La temporada y el episodio deben ser números enteros mayores que cero."); return; }
    if (!Number.isInteger(minutes) || minutes < 0) { setError("Los minutos vistos deben ser un número entero igual o mayor que cero."); return; }
    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10)) { setError("La calificación debe estar entre 0 y 10."); return; }
    setSaving(true); setError(""); setSuccess("");
    const key = progressKey(progressItem.id, user.id);
    const payload = { library_item_id: progressItem.id, user_id: user.id, season_number: season, episode_number: episode, watched_minutes: minutes, rating, is_completed: progressForm.is_completed, updated_at: new Date().toISOString() };
    try {
      const existing = progressMap[key];
      if (existing) {
        const { error: updateError } = await supabase.from("viewing_progress").update(payload).eq("id", existing.id).eq("user_id", user.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("viewing_progress").insert(payload);
        if (insertError) throw insertError;
      }
      setSuccess("Tu progreso se guardó correctamente."); setProgressItem(null); await loadLibrary();
    } catch (err) {
      console.error("Error guardando el progreso:", err);
      setError(err instanceof Error ? err.message : "No se pudo guardar tu progreso.");
    } finally { setSaving(false); }
  }

  async function toggleEpisodeWatched(seasonOverride?: number, episodeOverride?: number) {
    if (!user || !progressItem) { setError("No encontramos tu sesión o el título seleccionado."); return; }
    const season = seasonOverride ?? Number(progressForm.season_number);
    const episode = episodeOverride ?? Number(progressForm.episode_number);
    if (!Number.isInteger(season) || season < 1 || !Number.isInteger(episode) || episode < 1) { setError("La temporada y el episodio deben ser números válidos."); return; }
    const key = progressKey(progressItem.id, user.id);
    const currentEpisodes = watchedEpisodes[key] ?? [];
    const existingEpisode = currentEpisodes.find((entry) => entry.season_number === season && entry.episode_number === episode);
    setSaving(true); setError(""); setSuccess("");
    try {
      if (existingEpisode) {
        const { error: deleteError } = await supabase.from("watched_episodes").delete().eq("id", existingEpisode.id).eq("user_id", user.id);
        if (deleteError) throw deleteError;
        setWatchedEpisodes((previous) => ({ ...previous, [key]: (previous[key] ?? []).filter((entry) => entry.id !== existingEpisode.id) }));
        setProgressForm((previous) => ({ ...previous, season_number: String(season), episode_number: String(episode) }));
        setSuccess(`Episodio ${episode} desmarcado.`);
        return;
      }
      const { data, error: insertError } = await supabase.from("watched_episodes").insert({ library_item_id: progressItem.id, user_id: user.id, season_number: season, episode_number: episode }).select("*").single();
      if (insertError) throw insertError;
      setWatchedEpisodes((previous) => ({
        ...previous,
        [key]: [...(previous[key] ?? []), data as WatchedEpisode].sort((a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number),
      }));
      setProgressForm((previous) => ({ ...previous, season_number: String(season), episode_number: String(episode) }));
      const currentProgress = progressMap[key];
      const progressPayload = {
        library_item_id: progressItem.id, user_id: user.id, season_number: season, episode_number: episode,
        watched_minutes: currentProgress?.watched_minutes ?? 0, rating: currentProgress?.rating ?? null,
        is_completed: currentProgress?.is_completed ?? false, updated_at: new Date().toISOString(),
      };
      if (currentProgress) {
        const { data: updated, error: progressError } = await supabase.from("viewing_progress").update(progressPayload).eq("id", currentProgress.id).eq("user_id", user.id).select("*").single();
        if (progressError) throw progressError;
        setProgressMap((previous) => ({ ...previous, [key]: updated as ViewingProgress }));
      } else {
        const { data: created, error: progressError } = await supabase.from("viewing_progress").insert(progressPayload).select("*").single();
        if (progressError) throw progressError;
        setProgressMap((previous) => ({ ...previous, [key]: created as ViewingProgress }));
      }
      setSuccess(`¡Episodio ${episode} marcado como visto!`);
    } catch (err) {
      console.error("Error actualizando el episodio:", err);
      setError(err instanceof Error ? err.message : "No se pudo actualizar el episodio.");
      await loadLibrary();
    } finally { setSaving(false); }
  }

  async function saveSeasonEpisodeCount() {
    if (!user || !progressItem) return;
    const season = Number(progressForm.season_number), totalEpisodes = Number(episodeCountInput);
    if (!Number.isInteger(season) || season < 1) { setError("Selecciona una temporada válida."); return; }
    if (!Number.isInteger(totalEpisodes) || totalEpisodes < 1 || totalEpisodes > 200) { setError("La cantidad de episodios debe ser un entero entre 1 y 200."); return; }
    const key = progressKey(progressItem.id, user.id);
    const watchedInSeason = (watchedEpisodes[key] ?? []).filter((entry) => entry.season_number === season).length;
    if (totalEpisodes < watchedInSeason) { setError(`Ya marcaste ${watchedInSeason} episodios como vistos. La temporada debe tener al menos esa cantidad.`); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const { data, error: upsertError } = await supabase.from("season_episode_counts").upsert({
        library_item_id: progressItem.id, user_id: user.id, season_number: season, total_episodes: totalEpisodes, updated_at: new Date().toISOString(),
      }, { onConflict: "library_item_id,user_id,season_number" }).select("*").single();
      if (upsertError) throw upsertError;
      setSeasonCounts((previous) => {
        const withoutSeason = (previous[key] ?? []).filter((entry) => entry.season_number !== season);
        return { ...previous, [key]: [...withoutSeason, data as SeasonEpisodeCount].sort((a, b) => a.season_number - b.season_number) };
      });
      setSuccess(`Guardamos los ${totalEpisodes} episodios de la temporada ${season}.`);
    } catch (err) {
      console.error("Error guardando la cantidad de episodios:", err);
      setError(err instanceof Error ? err.message : "No se pudo guardar la cantidad de episodios.");
    } finally { setSaving(false); }
  }

  async function deleteItem(item: LibraryItem) {
    if (!coupleId) { setError("No encontramos tu espacio compartido."); return; }
    if (!window.confirm(`¿Quieres eliminar "${item.title}" de la biblioteca compartida? Esta acción también afectará a Mari.`)) return;
    setDeletingId(item.id); setError(""); setSuccess("");
    try {
      const { data, error: deleteError } = await supabase.from("library_items").delete().eq("id", item.id).eq("couple_id", coupleId).select("id");
      if (deleteError) throw deleteError;
      if (!data || data.length === 0) throw new Error("No se pudo eliminar el título. Comprueba los permisos de la biblioteca compartida en Supabase.");
      setItems((previous) => previous.filter((entry) => entry.id !== item.id));
      const belongsToItem = (key: string) => key.startsWith(`${item.id}:`);
      setProgressMap((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !belongsToItem(key))));
      setWatchedEpisodes((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !belongsToItem(key))));
      setSeasonCounts((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !belongsToItem(key))));
      if (progressItem?.id === item.id) setProgressItem(null);
      setSuccess("El título se eliminó de la biblioteca compartida.");
    } catch (err) {
      console.error("Error eliminando el título:", err);
      setError(err instanceof Error ? err.message : "No se pudo eliminar el título.");
    } finally { setDeletingId(null); }
  }

  const completedCount = items.filter((item) => user && progressMap[progressKey(item.id, user.id)]?.is_completed).length;
  const inProgressCount = items.filter((item) => {
    const progress = user ? progressMap[progressKey(item.id, user.id)] : undefined;
    return !!progress && !progress.is_completed;
  }).length;

  return (
    <main className="min-h-screen bg-[#0f0f14] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <Link href="/espacio" className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-pink-300">
          <ArrowLeft size={18} /> Volver a Nuestro Universo
        </Link>

        <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-pink-300"><BookOpen size={20} /><span className="text-xs font-semibold uppercase tracking-[0.25em]">Nuestro rincón de historias</span></div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">Nuestra <span className="bg-gradient-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent">biblioteca</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/55 sm:text-base">Películas, series, anime y doramas para descubrir juntos, recordar historias y guardar cada momento compartido.</p>
          </div>
          <button onClick={openNewItemForm} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 px-5 py-3 font-semibold shadow-lg shadow-pink-950/30 transition hover:brightness-110"><Plus size={19} />Agregar título</button>
        </header>

        {error && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><span className="flex-1">{error}</span><button onClick={() => setError("")} aria-label="Cerrar error"><X size={18} /></button></div>}
        {success && <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200"><Check size={18} /><span className="flex-1">{success}</span><button onClick={() => setSuccess("")} aria-label="Cerrar mensaje"><X size={18} /></button></div>}

        <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard icon={<Clapperboard size={20} />} label="En la biblioteca" value={items.length} accent="pink" />
          <StatCard icon={<Tv size={20} />} label="En tu progreso" value={inProgressCount} accent="purple" />
          <StatCard icon={<Check size={20} />} label="Terminados por ti" value={completedCount} accent="green" />
        </section>

        <section className="mb-7 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1"><Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en tu biblioteca..." className="w-full rounded-2xl border border-white/10 bg-[#15151d] py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-white/30 focus:border-pink-400/50" /></div>
            <div className="relative">
              <select value={filter} onChange={(event) => setFilter(event.target.value as "todos" | ItemType)} className="w-full appearance-none rounded-2xl border border-white/10 bg-[#15151d] py-3 pl-4 pr-10 text-sm outline-none focus:border-pink-400/50 sm:min-w-44">
                <option value="todos">Todos los tipos</option><option value="pelicula">Películas</option><option value="serie">Series</option><option value="anime">Anime</option><option value="dorama">Doramas</option>
              </select><ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
            </div>
            <div className="relative">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "todos" | "pendientes" | "terminados")} className="w-full appearance-none rounded-2xl border border-white/10 bg-[#15151d] py-3 pl-4 pr-10 text-sm outline-none focus:border-pink-400/50 sm:min-w-44">
                <option value="todos">Todos los estados</option><option value="pendientes">Por ver / en curso</option><option value="terminados">Terminados por mí</option>
              </select><ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
            </div>
          </div>
        </section>

        {loading ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-white/50"><LoaderCircle size={30} className="animate-spin text-pink-300" /><p className="text-sm">Preparando su biblioteca...</p></div>
        : !coupleId ? <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-8 text-center"><BookOpen size={36} className="mx-auto mb-4 text-pink-300" /><h2 className="text-xl font-semibold">Tu espacio aún no está listo</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">Regresa al panel principal para revisar la configuración de Nuestro Universo.</p></div>
        : filteredItems.length === 0 ? <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-400/10 text-pink-300"><Film size={30} /></div><h2 className="text-xl font-semibold">{items.length === 0 ? "Aquí comienza su próxima historia" : "No encontramos títulos"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">{items.length === 0 ? "Agreguen esa película que quieren ver, ese anime que les recomendaron o el dorama que les gustaría descubrir juntos." : "Prueba con otra búsqueda o cambia los filtros para encontrar lo que buscas."}</p>{items.length === 0 && <button onClick={openNewItemForm} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-3 text-sm font-semibold transition hover:bg-pink-400"><Plus size={18} />Agregar el primer título</button>}</div>
        : <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const myKey = user ? progressKey(item.id, user.id) : "";
            const progress = progressMap[myKey];
            const currentSeason = progress?.season_number ?? 1;
            const memberProgresses = memberIds.map((memberId) => {
              const key = progressKey(item.id, memberId);
              const memberProgress = progressMap[key];
              const episodes = watchedEpisodes[key] ?? [];
              const counts = seasonCounts[key] ?? [];
              const season = memberProgress?.season_number ?? 1;
              const seasonCount = counts.find((entry) => entry.season_number === season);
              const watchedInSeason = episodes.filter((entry) => entry.season_number === season).length;
              const percentage = seasonCount ? Math.min(100, Math.round(watchedInSeason / seasonCount.total_episodes * 100)) : null;
              return { memberId, label: displayMember(memberId, user?.id ?? ""), progress: memberProgress, episodes, counts, season, seasonCount, watchedInSeason, percentage };
            }).filter((member) => member.progress || member.episodes.length || member.counts.length);
            return <article key={item.id} className="group overflow-hidden rounded-3xl border border-white/[0.08] bg-[#15151d] transition duration-300 hover:-translate-y-1 hover:border-pink-300/25">
              <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-[#282033] via-[#1b1b27] to-[#15151d]">
                {item.poster_url ? <img src={item.poster_url} alt={`Póster de ${item.title}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="flex h-full flex-col items-center justify-center gap-4 text-white/20"><Film size={56} strokeWidth={1} /><span className="px-6 text-center text-sm">Su próxima historia comienza aquí</span></div>}
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#15151d] to-transparent" />
                <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-xs font-medium backdrop-blur-md">{typeLabels[item.item_type] ?? item.item_type}</div>
                {progress?.is_completed && <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white"><Check size={13} />Terminada por ti</div>}
                <div className="absolute inset-x-0 bottom-0 p-4"><h2 className="line-clamp-2 text-xl font-bold leading-snug">{item.title}</h2>{item.release_year && <p className="mt-1 text-sm text-white/60">{item.release_year}</p>}</div>
              </div>
              <div className="p-4">
                <p className="mb-4 min-h-10 text-sm leading-5 text-white/55">{item.description || "Una historia más para descubrir juntos."}</p>
                {memberProgresses.length > 0 && <div className="mb-4 space-y-3">
                  {memberProgresses.map((member) => <div key={member.memberId} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-pink-200">{member.label}</span>{member.progress?.is_completed && <span className="text-[11px] text-emerald-300">Terminada</span>}</div>
                    {member.progress && <div className="flex items-center justify-between gap-2 text-xs text-white/60">
                      <span>{item.item_type === "pelicula" ? `${member.progress.watched_minutes} minutos vistos` : `Temporada ${member.progress.season_number} · Episodio ${member.progress.episode_number}`}</span>
                      {member.progress.rating !== null && <span className="flex items-center gap-1 text-amber-300"><Star size={13} fill="currentColor" />{member.progress.rating}/10</span>}
                    </div>}
                    {item.item_type !== "pelicula" && member.percentage !== null && <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-white/45"><span>Temporada {member.season}</span><span>{member.percentage}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400" style={{ width: `${member.percentage}%` }} /></div><p className="mt-1 text-xs text-white/40">{member.watchedInSeason} de {member.seasonCount?.total_episodes} episodios vistos</p></div>}
                  </div>)}
                </div>}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => openProgressForm(item)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-300/20 bg-pink-300/[0.08] px-3 py-2.5 text-xs font-semibold text-pink-200 transition hover:bg-pink-300/15"><Check size={15} />Mi progreso</button>
                  <button onClick={() => openEditItemForm(item)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.06]"><Pencil size={14} />Editar</button>
                </div>
                <button onClick={() => void deleteItem(item)} disabled={deletingId === item.id} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-red-300/70 transition hover:bg-red-400/10 hover:text-red-300 disabled:opacity-50">{deletingId === item.id ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}Eliminar de la biblioteca</button>
              </div>
            </article>;
          })}
        </section>}
        <p className="mt-10 text-center text-xs text-white/30">Hecho para descubrir historias juntos · Nuestro Universo</p>
      </div>

      {showItemForm && <Modal title={editingItem ? "Editar título" : "Agregar a la biblioteca"} subtitle="Busquen una historia o completen sus datos manualmente." onClose={() => { if (!saving) { setShowItemForm(false); setEditingItem(null); resetCatalogSearch(); } }}>
        <form onSubmit={saveItem} className="space-y-4">
          {!editingItem && <div className="rounded-2xl border border-pink-300/15 bg-pink-300/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2"><Sparkles size={18} className="text-pink-300" /><h3 className="font-semibold text-pink-200">Buscar automáticamente</h3></div>
            <p className="mb-3 text-xs leading-5 text-white/45">Encuentra la portada, la sinopsis y el año de estreno. Selecciona primero el tipo de contenido.</p>
            <div className="mb-3"><Field label="Tipo de contenido para buscar"><select value={itemForm.item_type} onChange={(event) => { setItemForm((previous) => ({ ...previous, item_type: event.target.value as ItemType })); setCatalogResults([]); setCatalogError(""); }} className={inputClass}><option value="pelicula">Película</option><option value="serie">Serie</option><option value="anime">Anime</option><option value="dorama">Dorama</option></select></Field></div>
            <div className="flex flex-col gap-2 sm:flex-row"><input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchCatalog(); } }} placeholder="Ej. Interstellar, Naruto, Goblin..." className={`${inputClass} min-w-0 flex-1`} maxLength={150} /><button type="button" onClick={() => void searchCatalog()} disabled={catalogLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-semibold transition hover:bg-pink-400 disabled:opacity-50">{catalogLoading ? <LoaderCircle size={17} className="animate-spin" /> : <Search size={17} />}{catalogLoading ? "Buscando..." : "Buscar"}</button></div>
            {catalogError && <p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/10 p-3 text-sm text-red-200">{catalogError}</p>}
            {catalogResults.length > 0 && <div className="mt-4"><p className="mb-3 text-xs font-medium text-white/55">{catalogResults.length} resultados · Selecciona uno para completar el formulario</p><div className="max-h-80 space-y-3 overflow-y-auto pr-1">{catalogResults.map((result) => <button key={result.id} type="button" onClick={() => selectCatalogResult(result)} className="flex w-full gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-pink-300/40 hover:bg-white/[0.04]"><div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">{result.posterUrl ? <img src={result.posterUrl} alt={`Póster de ${result.title}`} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="flex h-full items-center justify-center text-white/25"><Film size={24} /></div>}</div><div className="min-w-0 flex-1"><h4 className="font-semibold text-white">{result.title}</h4><p className="mt-1 text-xs text-pink-300">{typeLabels[result.itemType]}{result.year ? ` · ${result.year}` : ""}</p><p className="mt-2 line-clamp-3 text-xs leading-5 text-white/50">{result.description || "Sin sinopsis disponible."}</p><span className="mt-2 inline-block text-xs font-semibold text-pink-200">Usar este título →</span></div></button>)}</div></div>}
          </div>}
          <Field label="Título *"><input required maxLength={200} value={itemForm.title} onChange={(event) => setItemForm({ ...itemForm, title: event.target.value })} placeholder="Ej. Yo antes de ti" className={inputClass} /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Tipo de contenido *"><select value={itemForm.item_type} onChange={(event) => setItemForm({ ...itemForm, item_type: event.target.value as ItemType })} className={inputClass}><option value="pelicula">Película</option><option value="serie">Serie</option><option value="anime">Anime</option><option value="dorama">Dorama</option></select></Field><Field label="Año de estreno"><input type="number" min="1888" max={new Date().getFullYear() + 10} value={itemForm.release_year} onChange={(event) => setItemForm({ ...itemForm, release_year: event.target.value })} placeholder="Ej. 2016" className={inputClass} /></Field></div>
          <Field label="URL del póster"><input type="url" value={itemForm.poster_url} onChange={(event) => setItemForm({ ...itemForm, poster_url: event.target.value })} placeholder="https://..." className={inputClass} /></Field>
          {itemForm.poster_url && <div className="rounded-2xl border border-white/10 bg-black/15 p-3"><p className="mb-2 text-xs text-white/45">Vista previa de la portada</p><img src={itemForm.poster_url} alt="Vista previa de la portada seleccionada" className="max-h-48 rounded-xl object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /></div>}
          <Field label="Descripción"><textarea rows={3} maxLength={2000} value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} placeholder="¿De qué trata? ¿Por qué quieren verla?" className={`${inputClass} resize-y`} /></Field>
          <div className="flex gap-3 pt-2"><button type="button" disabled={saving} onClick={() => { setShowItemForm(false); setEditingItem(null); resetCatalogSearch(); }} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 hover:bg-white/[0.05]">Cancelar</button><button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 text-sm font-semibold disabled:opacity-60">{saving ? <span className="flex items-center justify-center gap-2"><LoaderCircle size={17} className="animate-spin" />Guardando...</span> : editingItem ? "Guardar cambios" : "Agregar título"}</button></div>
        </form>
      </Modal>}

      {progressItem && <Modal title="Mi progreso" subtitle={progressItem.title} onClose={() => { if (!saving) setProgressItem(null); }}>
        <form onSubmit={saveProgress} className="space-y-4">
          {progressItem.item_type !== "pelicula" && <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4"><Field label="Temporada"><input type="number" min="1" step="1" required value={progressForm.season_number} onChange={(event) => { const nextSeason = event.target.value; setProgressForm((previous) => ({ ...previous, season_number: nextSeason })); const key = user ? progressKey(progressItem.id, user.id) : ""; const saved = (seasonCounts[key] ?? []).find((entry) => entry.season_number === Number(nextSeason)); setEpisodeCountInput(saved ? String(saved.total_episodes) : "12"); }} className={inputClass} /></Field><Field label="Episodio seleccionado"><input type="number" min="1" max="200" step="1" required value={progressForm.episode_number} onChange={(event) => setProgressForm((previous) => ({ ...previous, episode_number: event.target.value }))} className={inputClass} /></Field></div>
            {(() => {
              const season = Number(progressForm.season_number), episode = Number(progressForm.episode_number);
              const key = user ? progressKey(progressItem.id, user.id) : "";
              const episodes = watchedEpisodes[key] ?? [], counts = seasonCounts[key] ?? [];
              const watchedInSeason = episodes.filter((entry) => entry.season_number === season).length;
              const seasonCount = counts.find((entry) => entry.season_number === season);
              const total = seasonCount?.total_episodes ?? 0;
              const percentage = total > 0 ? Math.min(100, Math.round(watchedInSeason / total * 100)) : 0;
              const isWatched = episodes.some((entry) => entry.season_number === season && entry.episode_number === episode);
              return <div className="space-y-4 rounded-2xl border border-pink-300/15 bg-pink-300/[0.04] p-4">
                <div><div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-semibold text-pink-200">Temporada {season}</h3><span className="text-xs text-white/55">{watchedInSeason} vistos{total > 0 ? ` de ${total}` : ""}</span></div>
                  {total > 0 ? <><div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de la temporada ${season}`}><div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all" style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-right text-xs text-pink-200">{percentage}% completado</p></> : <p className="text-xs leading-5 text-white/45">Introduce el total de episodios para calcular tu progreso.</p>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row"><input type="number" min={Math.max(1, watchedInSeason)} max="200" step="1" value={episodeCountInput} onChange={(event) => setEpisodeCountInput(event.target.value)} aria-label="Cantidad total de episodios de la temporada" placeholder="Total de episodios" className={`${inputClass} min-w-0 flex-1`} /><button type="button" onClick={() => void saveSeasonEpisodeCount()} disabled={saving} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/[0.06] disabled:opacity-50">Guardar total</button></div>
                {total > 0 && <div><p className="mb-3 text-xs leading-5 text-white/50">Pulsa un episodio para marcarlo como visto o pendiente.</p><div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{Array.from({ length: Math.min(total, 200) }, (_, index) => { const n = index + 1; const watched = episodes.some((entry) => entry.season_number === season && entry.episode_number === n); return <button key={`${season}-${n}`} type="button" disabled={saving} onClick={() => void toggleEpisodeWatched(season, n)} title={watched ? `Episodio ${n}: visto` : `Episodio ${n}: pendiente`} className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${watched ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-red-400/10 hover:text-red-200" : "border-white/10 bg-white/[0.025] text-white/60 hover:border-pink-300/30 hover:bg-pink-300/10 hover:text-pink-200"}`}>{watched && <Check size={13} />}{n}</button>; })}</div><div className="mt-3 flex flex-wrap gap-3 text-xs text-white/45"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/70" />Visto</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-white/20" />Pendiente</span></div></div>}
                <button type="button" onClick={() => void toggleEpisodeWatched()} disabled={saving} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50 ${isWatched ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-red-400/10 hover:text-red-200" : "bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:brightness-110"}`}>{saving ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}{isWatched ? `Desmarcar episodio ${episode}` : `Marcar episodio ${episode} como visto`}</button>
                <p className="text-center text-xs leading-5 text-white/40">Este seguimiento es personal. El progreso de tu pareja se guarda por separado.</p>
              </div>;
            })()}
          </div>}
          <Field label="Minutos vistos"><input type="number" min="0" step="1" required value={progressForm.watched_minutes} onChange={(event) => setProgressForm({ ...progressForm, watched_minutes: event.target.value })} className={inputClass} /></Field>
          <Field label="Mi calificación (0 a 10)"><input type="number" min="0" max="10" step="0.1" value={progressForm.rating} onChange={(event) => setProgressForm({ ...progressForm, rating: event.target.value })} placeholder="Ej. 9.5" className={inputClass} /></Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><input type="checkbox" checked={progressForm.is_completed} onChange={(event) => setProgressForm({ ...progressForm, is_completed: event.target.checked })} className="mt-1 h-4 w-4 accent-pink-500" /><span><span className="block text-sm font-medium">Ya terminé de verla</span><span className="mt-1 block text-xs leading-5 text-white/45">Este estado corresponde a tu progreso personal, no al de tu pareja.</span></span></label>
          <div className="flex gap-3 pt-2"><button type="button" disabled={saving} onClick={() => setProgressItem(null)} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 hover:bg-white/[0.05]">Cancelar</button><button type="submit" disabled={saving} className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 text-sm font-semibold disabled:opacity-60">{saving ? <span className="flex items-center justify-center gap-2"><LoaderCircle size={17} className="animate-spin" />Guardando...</span> : "Guardar progreso"}</button></div>
        </form>
      </Modal>}
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2"><span className="block text-xs font-medium text-white/65">{label}</span>{children}</label>;
}
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#191820] p-5 shadow-2xl shadow-black/40 sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm leading-5 text-white/45">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Cerrar ventana" className="rounded-xl p-2 text-white/50 transition hover:bg-white/10 hover:text-white"><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}
function StatCard({ icon, label, value, accent }: { icon: ReactNode; label: string; value: number; accent: "pink" | "purple" | "green" }) {
  const colors = { pink: "bg-pink-400/10 text-pink-300", purple: "bg-purple-400/10 text-purple-300", green: "bg-emerald-400/10 text-emerald-300" };
  return <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5"><div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${colors[accent]}`}>{icon}</div><div><p className="text-sm text-white/45">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div></div></div>;
}
