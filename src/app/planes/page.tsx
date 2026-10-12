
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Download,
  Eye,
  Heart,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PlanStatus = "pendiente" | "hecho" | "cancelado";
type PlanFilter = "todos" | PlanStatus;

type Plan = {
  id: string;
  couple_id: string;
  title: string;
  category: string;
  description: string | null;
  planned_at: string | null;
  location: string | null;
  map_url: string | null;
  budget: number | null;
  status: string;
  created_by: string;
  created_at: string;
};

type PlanPhoto = {
  id: string;
  plan_id: string;
  couple_id: string;
  storage_path: string;
  signedUrl: string;
};

type NewPhoto = {
  file: File;
  preview: string;
};

type PlanForm = {
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  map_url: string;
  budget: string;
  description: string;
  status: PlanStatus;
};

const emptyForm: PlanForm = {
  title: "",
  category: "Cita romántica",
  date: "",
  time: "",
  location: "",
  map_url: "",
  budget: "",
  description: "",
  status: "pendiente",
};

const categories = [
  "Cita romántica",
  "Comida",
  "Paseo",
  "Viaje",
  "Película",
  "Actividad",
  "Celebración",
  "Otro",
];

const statusLabels: Record<PlanStatus, string> = {
  pendiente: "Pendiente",
  hecho: "Realizado",
  cancelado: "Cancelado",
};

const statusStyles: Record<PlanStatus, string> = {
  pendiente: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  hecho: "border-green-400/20 bg-green-400/10 text-green-200",
  cancelado: "border-red-400/20 bg-red-400/10 text-red-200",
};

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatDate(value: string | null) {
  if (!value) return "Fecha por definir";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
  }).format(new Date(value));
}

function formatTime(value: string | null) {
  if (!value) return "Hora por definir";

  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Por definir";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function toLocalDateTime(value: string | null) {
  if (!value) return { date: "", time: "" };

  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");

  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function normalizeStatus(value: string): PlanStatus {
  if (value === "hecho" || value === "realizado") return "hecho";
  if (value === "cancelado") return "cancelado";
  return "pendiente";
}

export default function PlanesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [coupleId, setCoupleId] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanFilter>("todos");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PLANS_PER_PAGE = 10;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [photosByPlan, setPhotosByPlan] = useState<
    Record<string, PlanPhoto[]>
  >({});
  const [activePhotoByPlan, setActivePhotoByPlan] = useState<
    Record<string, number>
  >({});
  const [selectedPhotos, setSelectedPhotos] = useState<NewPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<PlanPhoto[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);

  const clearSelectedPhotos = useCallback(() => {
    setSelectedPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.preview));
      return [];
    });
  }, []);

  const loadPlanPhotos = useCallback(
    async (planIds: string[], currentCoupleId: string) => {
      if (planIds.length === 0) {
        setPhotosByPlan({});
        setActivePhotoByPlan({});
        return;
      }

      const { data, error } = await supabase
        .from("plan_photos")
        .select("id, plan_id, couple_id, storage_path, created_at")
        .eq("couple_id", currentCoupleId)
        .in("plan_id", planIds)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error cargando las fotos:", error);
        throw error;
      }

      const results = await Promise.all(
        (data ?? []).map(async (photo) => {
          const { data: signed, error: signedError } = await supabase.storage
            .from("plan-photos")
            .createSignedUrl(photo.storage_path, 3600);

          if (signedError) {
            console.error("Error creando URL de foto:", signedError);
          }

          return {
            id: photo.id,
            plan_id: photo.plan_id,
            couple_id: photo.couple_id,
            storage_path: photo.storage_path,
            signedUrl: signed?.signedUrl ?? "",
          } satisfies PlanPhoto;
        })
      );

      const grouped: Record<string, PlanPhoto[]> = {};

      for (const photo of results) {
        if (!photo.signedUrl) continue;

        if (!grouped[photo.plan_id]) {
          grouped[photo.plan_id] = [];
        }

        grouped[photo.plan_id].push(photo);
      }

      setPhotosByPlan(grouped);
      setActivePhotoByPlan({});
    },
    []
  );

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/");
        return;
      }

      setUserId(user.id);

      const { data: membership, error: membershipError } = await supabase
        .from("couple_members")
        .select("couple_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership) {
        setCoupleId("");
        setPlans([]);
        setPhotosByPlan({});
        setErrorMessage(
          "No encontramos tu membresía en Nuestro Universo. Revisa tu espacio antes de crear planes."
        );
        return;
      }

      setCoupleId(membership.couple_id);

      const { data, error } = await supabase
        .from("plans")
        .select(
          "id, couple_id, title, category, description, planned_at, location, map_url, budget, status, created_by, created_at"
        )
        .eq("couple_id", membership.couple_id)
        .order("planned_at", {
          ascending: true,
          nullsFirst: false,
        });

      if (error) throw error;

      const loadedPlans = (data ?? []) as Plan[];
      setPlans(loadedPlans);

      await loadPlanPhotos(
        loadedPlans.map((plan) => plan.id),
        membership.couple_id
      );
    } catch (error) {
      console.error("Error al cargar los planes:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los planes."
      );
    } finally {
      setLoading(false);
    }
  }, [router, loadPlanPhotos]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  function openNewForm() {
    clearSelectedPhotos();
    setEditingId(null);
    setForm(emptyForm);
    setExistingPhotos([]);
    setPhotosToDelete([]);
    setErrorMessage("");
    setSuccessMessage("");
    setFormOpen(true);
  }

  function openEditForm(plan: Plan) {
    clearSelectedPhotos();

    const dateTime = toLocalDateTime(plan.planned_at);

    setEditingId(plan.id);
    setForm({
      title: plan.title,
      category: plan.category || "Otro",
      date: dateTime.date,
      time: dateTime.time,
      location: plan.location ?? "",
      map_url: plan.map_url ?? "",
      budget:
        plan.budget === null || plan.budget === undefined
          ? ""
          : String(plan.budget),
      description: plan.description ?? "",
      status: normalizeStatus(plan.status),
    });

    setExistingPhotos(photosByPlan[plan.id] ?? []);
    setPhotosToDelete([]);
    setErrorMessage("");
    setSuccessMessage("");
    setFormOpen(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    if (saving) return;

    clearSelectedPhotos();
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setExistingPhotos([]);
    setPhotosToDelete([]);
  }

  function handlePhotoSelection(files: FileList | null) {
    if (!files) return;

    const incoming = Array.from(files);
    const remainingExisting =
      existingPhotos.length - photosToDelete.length;
    const availableSlots =
      MAX_PHOTOS - remainingExisting - selectedPhotos.length;

    if (availableSlots <= 0) {
      setErrorMessage("Este plan ya tiene el máximo de 10 imágenes.");
      return;
    }

    const accepted: NewPhoto[] = [];
    let validationMessage = "";

    for (const file of incoming) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        validationMessage = "Solo puedes subir imágenes JPG, PNG o WebP.";
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        validationMessage = `La imagen "${file.name}" supera el límite de 10 MB.`;
        continue;
      }

      if (selectedPhotos.length + accepted.length >= availableSlots) {
        validationMessage = "Cada plan puede tener un máximo de 10 imágenes.";
        break;
      }

      accepted.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (accepted.length > 0) {
      setSelectedPhotos((current) => [...current, ...accepted]);
    }

    setErrorMessage(validationMessage);
  }

  function removeSelectedPhoto(index: number) {
    setSelectedPhotos((current) => {
      const photo = current[index];

      if (photo) URL.revokeObjectURL(photo.preview);

      return current.filter((_, i) => i !== index);
    });
  }

  function toggleExistingPhotoDeletion(photoId: string) {
    setPhotosToDelete((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId]
    );
  }

  async function savePhotos(planId: string) {
    const deletingPhotos = existingPhotos.filter((photo) =>
      photosToDelete.includes(photo.id)
    );

    const uploadedPaths: string[] = [];
    const insertedPhotoIds: string[] = [];

    try {
      for (const photo of deletingPhotos) {
        const { error: dbError } = await supabase
          .from("plan_photos")
          .delete()
          .eq("id", photo.id)
          .eq("plan_id", planId)
          .eq("couple_id", coupleId);

        if (dbError) throw dbError;

        const { error: storageError } = await supabase.storage
          .from("plan-photos")
          .remove([photo.storage_path]);

        if (storageError) {
          console.error(
            "No se pudo eliminar el archivo del almacenamiento:",
            storageError
          );
        }
      }

      for (const photo of selectedPhotos) {
        const extension =
          photo.file.name.split(".").pop()?.toLowerCase() || "jpg";

        const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(
          extension
        )
          ? extension
          : "jpg";

        const storagePath =
          `${coupleId}/${planId}/${crypto.randomUUID()}.${safeExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("plan-photos")
          .upload(storagePath, photo.file, {
            contentType: photo.file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        uploadedPaths.push(storagePath);

       const { data: insertedPhoto, error: insertError } = await supabase
  .from("plan_photos")
  .insert({
    plan_id: planId,
    couple_id: coupleId,
    created_by: userId,
    storage_path: storagePath,
    caption: "",
  })
  .select("id")
  .single();

        if (insertError) throw insertError;

        insertedPhotoIds.push(insertedPhoto.id);
      }
    } catch (error) {
      // Si falla una subida, intentamos limpiar los archivos nuevos
      // para evitar imágenes huérfanas en Storage.
      if (insertedPhotoIds.length > 0) {
        await supabase
          .from("plan_photos")
          .delete()
          .in("id", insertedPhotoIds)
          .eq("couple_id", coupleId);
      }

      if (uploadedPaths.length > 0) {
        await supabase.storage.from("plan-photos").remove(uploadedPaths);
      }

      throw error;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    if (!userId || !coupleId) {
      setErrorMessage("No se ha identificado tu espacio compartido.");
      return;
    }

    if (!form.title.trim()) {
      setErrorMessage("Escribe un título para el plan.");
      return;
    }

    if (form.map_url.trim()) {
      try {
        const url = new URL(form.map_url.trim());

        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("URL no válida");
        }
      } catch {
        setErrorMessage("Introduce un enlace válido de Google Maps.");
        return;
      }
    }

    const parsedBudget =
      form.budget.trim() === "" ? null : Number(form.budget);

    if (
      parsedBudget !== null &&
      (!Number.isFinite(parsedBudget) || parsedBudget < 0)
    ) {
      setErrorMessage(
        "El presupuesto debe ser un número igual o mayor que cero."
      );
      return;
    }

    const remainingExisting =
      existingPhotos.length - photosToDelete.length;

    if (remainingExisting + selectedPhotos.length > MAX_PHOTOS) {
      setErrorMessage("Cada plan puede tener un máximo de 10 imágenes.");
      return;
    }

    let plannedAt: string | null = null;

    if (form.date) {
      const localDateTime = form.time
        ? `${form.date}T${form.time}:00`
        : `${form.date}T00:00:00`;

      const date = new Date(localDateTime);

      if (Number.isNaN(date.getTime())) {
        setErrorMessage("La fecha u hora no es válida.");
        return;
      }

      plannedAt = date.toISOString();
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    let savedPlanId = editingId;

    try {
      const payload = {
        couple_id: coupleId,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || null,
        planned_at: plannedAt,
        location: form.location.trim() || null,
        map_url: form.map_url.trim() || null,
        budget: parsedBudget,
        status: form.status,
      };

      if (editingId) {
        const { error } = await supabase
          .from("plans")
          .update(payload)
          .eq("id", editingId)
          .eq("couple_id", coupleId);

        if (error) throw error;
      } else {
        const { data: createdPlan, error } = await supabase
          .from("plans")
          .insert({
            ...payload,
            created_by: userId,
          })
          .select("id")
          .single();

        if (error) throw error;

        savedPlanId = createdPlan.id;
      }

      if (!savedPlanId) {
        throw new Error("No se pudo identificar el plan guardado.");
      }

      try {
        await savePhotos(savedPlanId);
      } catch (photoError) {
        console.error("Error al guardar las fotos:", photoError);

        // Si el plan se acaba de crear, cambiamos a edición para que
        // un nuevo intento no cree un plan duplicado.
        setEditingId(savedPlanId);
        setSuccessMessage("El plan se guardó, pero las fotos no se completaron.");
        setErrorMessage(
          `No se pudieron guardar todas las fotos. El plan sí está guardado. ${
            photoError instanceof Error
              ? photoError.message
              : "Comprueba las políticas de Supabase Storage."
          }`
        );

        await loadPlans();
        return;
      }

      setSuccessMessage(
        editingId
          ? "¡Plan actualizado correctamente! ❤️"
          : "¡Nuevo plan guardado para ustedes! ❤️"
      );

      clearSelectedPhotos();
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setExistingPhotos([]);
      setPhotosToDelete([]);

      await loadPlans();
    } catch (error) {
      console.error("Error al guardar el plan:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el plan."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(plan: Plan) {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar el plan "${plan.title}"? Esta acción no se puede deshacer.`
    );

    if (!confirmed || deletingId) return;

    setDeletingId(plan.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Eliminamos primero los archivos del bucket privado.
      const planPhotos = photosByPlan[plan.id] ?? [];
      const paths = planPhotos.map((photo) => photo.storage_path);

      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("plan-photos")
          .remove(paths);

        if (storageError) throw storageError;
      }

      const { error: photosError } = await supabase
        .from("plan_photos")
        .delete()
        .eq("plan_id", plan.id)
        .eq("couple_id", coupleId);

      if (photosError) throw photosError;

      const { error } = await supabase
        .from("plans")
        .delete()
        .eq("id", plan.id)
        .eq("couple_id", coupleId);

      if (error) throw error;

      setPlans((current) => current.filter((item) => item.id !== plan.id));

      setPhotosByPlan((current) => {
        const updated = { ...current };
        delete updated[plan.id];
        return updated;
      });

      setSuccessMessage("El plan se eliminó correctamente.");

      if (editingId === plan.id) {
        clearSelectedPhotos();
        setFormOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        setExistingPhotos([]);
        setPhotosToDelete([]);
      }
    } catch (error) {
      console.error("Error al eliminar el plan:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el plan."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const filteredPlans =
    filter === "todos"
      ? plans
      : plans.filter((plan) => normalizeStatus(plan.status) === filter);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / PLANS_PER_PAGE));
  const paginatedPlans = filteredPlans.slice(
    (currentPage - 1) * PLANS_PER_PAGE,
    currentPage * PLANS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  function downloadPlanAsPng(plan: Plan) {
    try {
      const canvas = document.createElement("canvas");
      const width = 1200;
      const padding = 80;
      const contentWidth = width - padding * 2;
      const lineHeight = 38;
      const titleFont = "bold 48px Arial";
      const bodyFont = "28px Arial";
      const lines: string[] = [];
      const addWrapped = (label: string, value: string) => {
        const text = `${label}: ${value}`;
        const words = text.split(/\s+/);
        let line = "";
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (candidate.length > 55 && line) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        }
        if (line) lines.push(line);
        lines.push("");
      };

      addWrapped("Categoría", plan.category || "Otro");
      addWrapped("Estado", statusLabels[normalizeStatus(plan.status)]);
      addWrapped("Fecha", formatDate(plan.planned_at));
      if (plan.planned_at) addWrapped("Hora", formatTime(plan.planned_at));
      if (plan.location) addWrapped("Lugar", plan.location);
      addWrapped("Presupuesto", formatMoney(plan.budget));
      if (plan.map_url) addWrapped("Mapa", plan.map_url);
      addWrapped("Descripción", plan.description || "Sin descripción");

      canvas.width = width;
      canvas.height = Math.max(620, 330 + lines.length * lineHeight);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar la imagen.");

      const gradient = ctx.createLinearGradient(0, 0, width, canvas.height);
      gradient.addColorStop(0, "#17101f");
      gradient.addColorStop(1, "#25112b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, canvas.height);

      ctx.strokeStyle = "rgba(244,114,182,0.65)";
      ctx.lineWidth = 3;
      ctx.strokeRect(28, 28, width - 56, canvas.height - 56);

      ctx.fillStyle = "#f9a8d4";
      ctx.font = "bold 22px Arial";
      ctx.fillText("NUESTRO UNIVERSO ♥", padding, 90);

      ctx.fillStyle = "#ffffff";
      ctx.font = titleFont;
      const titleWords = plan.title.split(/\s+/);
      let titleLine = "";
      let titleY = 165;
      for (const word of titleWords) {
        const candidate = titleLine ? `${titleLine} ${word}` : word;
        if (ctx.measureText(candidate).width > contentWidth && titleLine) {
          ctx.fillText(titleLine, padding, titleY);
          titleY += 58;
          titleLine = word;
        } else {
          titleLine = candidate;
        }
      }
      if (titleLine) ctx.fillText(titleLine, padding, titleY);

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(padding, titleY + 35);
      ctx.lineTo(width - padding, titleY + 35);
      ctx.stroke();

      ctx.font = bodyFont;
      ctx.fillStyle = "#f3e8ff";
      let y = titleY + 95;
      for (const line of lines) {
        if (!line) {
          y += 10;
          continue;
        }
        ctx.fillText(line, padding, y, contentWidth);
        y += lineHeight;
      }

      ctx.fillStyle = "#f9a8d4";
      ctx.font = "italic 22px Arial";
      ctx.fillText("Una historia más para escribir juntos ❤️", padding, canvas.height - 55);

      canvas.toBlob((blob) => {
        if (!blob) {
          setErrorMessage("No se pudo crear la imagen descargable.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${plan.title.trim().replace(/[^a-z0-9áéíóúñ_-]+/gi, "-") || "plan"}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (error) {
      console.error("Error generando imagen del plan:", error);
      setErrorMessage("No fue posible generar la imagen del plan.");
    }
  }

  const counts: Record<PlanFilter, number> = {
    todos: plans.length,
    pendiente: plans.filter(
      (plan) => normalizeStatus(plan.status) === "pendiente"
    ).length,
    hecho: plans.filter(
      (plan) => normalizeStatus(plan.status) === "hecho"
    ).length,
    cancelado: plans.filter(
      (plan) => normalizeStatus(plan.status) === "cancelado"
    ).length,
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f0f14] text-white">
        <div className="flex flex-col items-center gap-4">
          <LoaderCircle className="h-9 w-9 animate-spin text-pink-400" />
          <p className="text-sm text-gray-400">Preparando sus planes...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0f14] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/espacio"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Nuestro Universo
          </Link>

          <div className="flex items-center gap-2 text-sm text-pink-300">
            <Heart className="h-4 w-4 fill-pink-400" />
            Un mundo para los dos
          </div>
        </header>

        <section className="relative mb-8 overflow-hidden rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-500/[0.06] to-transparent p-6 sm:p-9">
          <div className="absolute -right-8 -top-8 opacity-[0.07]">
            <CalendarDays className="h-48 w-48" />
          </div>

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-pink-400/20 bg-pink-400/10 px-3 py-1.5 text-xs text-pink-200">
              <Sparkles className="h-3.5 w-3.5" />
              Su próxima aventura comienza aquí
            </div>

            <h1 className="text-3xl font-bold sm:text-4xl">
              Planes para nosotros <span className="text-pink-300">❤️</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-300 sm:text-base">
              Guarden esas pequeñas ideas que algún día se convertirán en
              historias que recordarán con una sonrisa. Cada cita, paseo y
              aventura tiene un lugar aquí.
            </p>

            <button
              type="button"
              onClick={openNewForm}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 font-semibold text-white transition hover:bg-pink-400"
            >
              <Plus className="h-5 w-5" />
              Crear un plan
            </button>
          </div>
        </section>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 break-words rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
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

        {formOpen && (
          <section className="mb-8 rounded-3xl border border-pink-500/20 bg-white/[0.035] p-5 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-pink-300">
                  Un plan especial
                </p>
                <h2 className="mt-2 text-xl font-bold sm:text-2xl">
                  {editingId ? "Editar plan" : "Crear un nuevo plan"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                aria-label="Cerrar formulario"
                className="rounded-xl border border-white/10 p-2.5 text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="plan-title" className="mb-2 block text-sm text-gray-300">
                    Nombre del plan *
                  </label>
                  <input
                    id="plan-title"
                    required
                    maxLength={150}
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    placeholder="Ej. Una tarde de helado con Mari"
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 outline-none transition placeholder:text-gray-600 focus:border-pink-400/60"
                  />
                </div>

                <div>
                  <label htmlFor="plan-category" className="mb-2 block text-sm text-gray-300">
                    Categoría
                  </label>
                  <select
                    id="plan-category"
                    value={form.category}
                    onChange={(event) =>
                      setForm({ ...form, category: event.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 outline-none focus:border-pink-400/60"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="plan-status" className="mb-2 block text-sm text-gray-300">
                    Estado
                  </label>
                  <select
                    id="plan-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as PlanStatus,
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 outline-none focus:border-pink-400/60"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="hecho">Realizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="plan-date" className="mb-2 block text-sm text-gray-300">
                    Fecha
                  </label>
                  <input
                    id="plan-date"
                    type="date"
                    value={form.date}
                    onChange={(event) =>
                      setForm({ ...form, date: event.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 text-white outline-none focus:border-pink-400/60"
                  />
                </div>

                <div>
                  <label htmlFor="plan-time" className="mb-2 block text-sm text-gray-300">
                    Hora
                  </label>
                  <input
                    id="plan-time"
                    type="time"
                    value={form.time}
                    onChange={(event) =>
                      setForm({ ...form, time: event.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 text-white outline-none focus:border-pink-400/60"
                  />
                </div>

                <div>
                  <label htmlFor="plan-location" className="mb-2 block text-sm text-gray-300">
                    Lugar
                  </label>
                  <input
                    id="plan-location"
                    value={form.location}
                    onChange={(event) =>
                      setForm({ ...form, location: event.target.value })
                    }
                    placeholder="Ej. Un café bonito"
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 outline-none placeholder:text-gray-600 focus:border-pink-400/60"
                  />
                </div>

                <div>
                  <label htmlFor="plan-map" className="mb-2 block text-sm text-gray-300">
                    Enlace de Google Maps
                  </label>
                  <input
                    id="plan-map"
                    type="url"
                    value={form.map_url}
                    onChange={(event) =>
                      setForm({ ...form, map_url: event.target.value })
                    }
                    placeholder="https://maps.google.com/..."
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 outline-none placeholder:text-gray-600 focus:border-pink-400/60"
                  />
                </div>

                <div>
                  <label htmlFor="plan-budget" className="mb-2 block text-sm text-gray-300">
                    Presupuesto aproximado (COP)
                  </label>
                  <input
                    id="plan-budget"
                    type="number"
                    min="0"
                    step="1000"
                    value={form.budget}
                    onChange={(event) =>
                      setForm({ ...form, budget: event.target.value })
                    }
                    placeholder="Ej. 80000"
                    className="w-full rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 outline-none placeholder:text-gray-600 focus:border-pink-400/60"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="plan-description" className="mb-2 block text-sm text-gray-300">
                    Descripción y detalles
                  </label>
                  <textarea
                    id="plan-description"
                    rows={4}
                    maxLength={5000}
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    placeholder="Qué quieren hacer, qué deben llevar, alguna idea especial..."
                    className="w-full resize-y rounded-xl border border-white/10 bg-[#0f0f14] px-4 py-3 outline-none placeholder:text-gray-600 focus:border-pink-400/60"
                  />
                </div>

                {/* Selector de múltiples imágenes */}
                <div className="sm:col-span-2 rounded-2xl border border-pink-400/15 bg-pink-500/[0.04] p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="flex items-center gap-2 font-semibold text-white">
                      <ImagePlus className="h-5 w-5 text-pink-300" />
                      Fotos y portada del plan
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-gray-400">
                      Añade hasta 10 imágenes JPG, PNG o WebP. Cada archivo
                      puede pesar hasta 10 MB.
                    </p>
                  </div>

                  <label
                    htmlFor="plan-photos"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-pink-400/30 bg-[#0f0f14] px-4 py-7 text-center transition hover:border-pink-400/60 hover:bg-pink-500/[0.04]"
                  >
                    <ImagePlus className="mb-2 h-8 w-8 text-pink-300" />
                    <span className="font-medium">
                      Seleccionar varias imágenes
                    </span>
                    <span className="mt-1 text-xs text-gray-500">
                      Puedes elegir varias desde tu computador
                    </span>
                    <input
                      id="plan-photos"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={saving}
                      onChange={(event) => {
                        handlePhotoSelection(event.target.files);
                        event.currentTarget.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>

                  {existingPhotos.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-3 text-sm font-medium text-gray-300">
                        Imágenes guardadas
                      </p>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {existingPhotos.map((photo) => {
                          const marked = photosToDelete.includes(photo.id);

                          return (
                            <div
                              key={photo.id}
                              className={`relative overflow-hidden rounded-xl border ${
                                marked
                                  ? "border-red-400/50 opacity-40"
                                  : "border-white/10"
                              }`}
                            >
                              {photo.signedUrl ? (
                                <img
                                  src={photo.signedUrl}
                                  alt="Foto guardada del plan"
                                  className="h-28 w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-28 items-center justify-center bg-white/5 text-xs text-gray-500">
                                  Imagen no disponible
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  toggleExistingPhotoDeletion(photo.id)
                                }
                                className="absolute right-2 top-2 rounded-lg bg-black/70 p-2 text-white hover:bg-red-500"
                                aria-label={
                                  marked ? "Conservar imagen" : "Eliminar imagen"
                                }
                                title={
                                  marked ? "Conservar imagen" : "Eliminar imagen"
                                }
                              >
                                {marked ? (
                                  <Plus className="h-4 w-4" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </button>

                              {marked && (
                                <span className="absolute inset-x-0 bottom-0 bg-red-500/90 px-2 py-1 text-center text-xs">
                                  Se eliminará al guardar
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedPhotos.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-3 text-sm font-medium text-gray-300">
                        Nuevas imágenes ({selectedPhotos.length})
                      </p>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {selectedPhotos.map((photo, index) => (
                          <div
                            key={`${photo.file.name}-${index}`}
                            className="relative overflow-hidden rounded-xl border border-pink-400/20"
                          >
                            <img
                              src={photo.preview}
                              alt={`Vista previa ${index + 1}`}
                              className="h-28 w-full object-cover"
                            />

                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => removeSelectedPhoto(index)}
                              className="absolute right-2 top-2 rounded-lg bg-black/70 p-2 text-white hover:bg-red-500"
                              aria-label="Quitar imagen seleccionada"
                            >
                              <X className="h-4 w-4" />
                            </button>

                            <p className="truncate px-2 py-1 text-xs text-gray-400">
                              {photo.file.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="mt-3 text-xs text-gray-500">
                    Seleccionadas:{" "}
                    {existingPhotos.length -
                      photosToDelete.length +
                      selectedPhotos.length}{" "}
                    de {MAX_PHOTOS}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-500 px-5 py-3 font-semibold text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}

                  {saving
                    ? "Guardando plan y fotos..."
                    : editingId
                      ? "Guardar cambios"
                      : "Guardar plan"}
                </button>

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-xl border border-white/10 px-5 py-3 text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-purple-300">
                Su agenda
              </p>
              <h2 className="mt-2 text-2xl font-bold">Nuestros planes</h2>
              <p className="mt-1 text-sm text-gray-400">
                {plans.length}{" "}
                {plans.length === 1 ? "plan guardado" : "planes guardados"}
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {(
              [
                ["todos", "Todos"],
                ["pendiente", "Pendientes"],
                ["hecho", "Realizados"],
                ["cancelado", "Cancelados"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setFilter(value); setCurrentPage(1); }}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  filter === value
                    ? "border-pink-400/40 bg-pink-500/15 text-pink-200"
                    : "border-white/10 text-gray-400 hover:bg-white/5"
                }`}
              >
                {label} ({counts[value]})
              </button>
            ))}
          </div>

          {filteredPlans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500/10">
                <CalendarDays className="h-8 w-8 text-pink-300" />
              </div>

              <h3 className="mt-5 text-lg font-semibold">
                {plans.length === 0
                  ? "Todavía no hay planes guardados"
                  : "No hay planes en esta categoría"}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
                {plans.length === 0
                  ? "Guarden esa salida que llevan tiempo pensando, una cita especial o una aventura que quieran vivir juntos."
                  : "Prueba con otro filtro para ver los demás planes."}
              </p>

              {plans.length === 0 && (
                <button
                  type="button"
                  onClick={openNewForm}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-pink-500 px-5 py-3 font-semibold transition hover:bg-pink-400"
                >
                  <Plus className="h-5 w-5" />
                  Crear nuestro primer plan
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {paginatedPlans.map((plan) => {
                const status = normalizeStatus(plan.status);
                const planPhotos = photosByPlan[plan.id] ?? [];
                const activePhotoIndex = activePhotoByPlan[plan.id] ?? 0;
                const activePhoto = planPhotos[activePhotoIndex];

                return (
                  <article
                    key={plan.id}
                    className="overflow-hidden rounded-3xl border border-white/[0.09] bg-white/[0.025] transition hover:border-pink-400/20"
                  >
                    {/* Banner / galería de fotografías */}
                    {planPhotos.length > 0 && (
                      <div className="overflow-hidden">
                        <div className="group relative h-48 bg-gradient-to-br from-pink-500/20 to-purple-500/20 sm:h-56">
                          {activePhoto?.signedUrl && (
                            <img
                              src={activePhoto.signedUrl}
                              alt={`Fotografía de ${plan.title}`}
                              className="h-full w-full object-cover"
                            />
                          )}

                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

                          {planPhotos.length > 1 && (
                            <>
                              <button
                                type="button"
                                aria-label="Foto anterior"
                                onClick={() =>
                                  setActivePhotoByPlan((current) => ({
                                    ...current,
                                    [plan.id]:
                                      (activePhotoIndex -
                                        1 +
                                        planPhotos.length) %
                                      planPhotos.length,
                                  }))
                                }
                                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/80"
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </button>

                              <button
                                type="button"
                                aria-label="Foto siguiente"
                                onClick={() =>
                                  setActivePhotoByPlan((current) => ({
                                    ...current,
                                    [plan.id]:
                                      (activePhotoIndex + 1) %
                                      planPhotos.length,
                                  }))
                                }
                                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white transition hover:bg-black/80"
                              >
                                <ChevronRight className="h-5 w-5" />
                              </button>

                              <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white">
                                {activePhotoIndex + 1} / {planPhotos.length}
                              </span>
                            </>
                          )}
                        </div>

                        {planPhotos.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto bg-black/20 p-3">
                            {planPhotos.map((photo, index) => (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() =>
                                  setActivePhotoByPlan((current) => ({
                                    ...current,
                                    [plan.id]: index,
                                  }))
                                }
                                aria-label={`Mostrar foto ${index + 1}`}
                                className={`shrink-0 overflow-hidden rounded-lg border-2 transition ${
                                  activePhotoIndex === index
                                    ? "border-pink-400"
                                    : "border-transparent opacity-60 hover:opacity-100"
                                }`}
                              >
                                <img
                                  src={photo.signedUrl}
                                  alt=""
                                  className="h-14 w-20 object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="inline-flex rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-200">
                            {plan.category || "Otro"}
                          </span>

                          <h3 className="mt-3 break-words text-xl font-bold">
                            {plan.title}
                          </h3>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusStyles[status]}`}
                        >
                          {statusLabels[status]}
                        </span>
                      </div>

                      {plan.description && (
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-400">
                          {plan.description}
                        </p>
                      )}

                      <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-4 text-sm text-gray-300">
                        <div className="flex items-center gap-3">
                          <CalendarDays className="h-4 w-4 shrink-0 text-pink-300" />
                          <span>{formatDate(plan.planned_at)}</span>
                        </div>

                        {plan.planned_at && (
                          <div className="flex items-center gap-3">
                            <Clock3 className="h-4 w-4 shrink-0 text-pink-300" />
                            <span>{formatTime(plan.planned_at)}</span>
                          </div>
                        )}

                        {plan.location && (
                          <div className="flex items-start gap-3">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
                            <span className="break-words">{plan.location}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <Wallet className="h-4 w-4 shrink-0 text-pink-300" />
                          <span>{formatMoney(plan.budget)}</span>
                        </div>

                        {plan.map_url && (
                          <a
                            href={plan.map_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-pink-300 transition hover:text-pink-200"
                          >
                            <MapPin className="h-4 w-4" />
                            Ver ubicación en Google Maps
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                        <button
                          type="button"
                          onClick={() => setSelectedPlan(plan)}
                          className="inline-flex items-center gap-2 rounded-xl border border-pink-400/20 bg-pink-500/10 px-3 py-2 text-sm text-pink-200 transition hover:bg-pink-500/20"
                        >
                          <Eye className="h-4 w-4" />
                          Ver plan
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(plan)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => void deletePlan(plan)}
                          disabled={deletingId === plan.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-400/15 px-3 py-2 text-sm text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                        >
                          {deletingId === plan.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {filteredPlans.length > 0 && (
            <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:flex-row">
              <p className="text-sm text-gray-400">
                Mostrando {(currentPage - 1) * PLANS_PER_PAGE + 1}–{Math.min(currentPage * PLANS_PER_PAGE, filteredPlans.length)} de {filteredPlans.length} planes
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </button>
                <span className="min-w-24 text-center text-sm text-gray-300">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {selectedPlan && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedPlan(null);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="plan-detail-title"
              className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-pink-400/20 bg-[#15121b] shadow-2xl shadow-black/50"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#15121b]/95 px-5 py-4 backdrop-blur sm:px-7">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-pink-300">Nuestro universo</p>
                  <h2 id="plan-detail-title" className="mt-1 text-lg font-bold sm:text-xl">Detalles del plan</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  aria-label="Cerrar detalles"
                  className="rounded-xl border border-white/10 p-2 text-gray-300 transition hover:bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-200">
                      {selectedPlan.category || "Otro"}
                    </span>
                    <h3 className="mt-3 break-words text-2xl font-bold sm:text-3xl">{selectedPlan.title}</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-sm ${statusStyles[normalizeStatus(selectedPlan.status)]}`}>
                    {statusLabels[normalizeStatus(selectedPlan.status)]}
                  </span>
                </div>

                {photosByPlan[selectedPlan.id]?.length > 0 && (
                  <div>
                    <h4 className="mb-3 font-semibold text-white">Fotografías del plan</h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(photosByPlan[selectedPlan.id] ?? []).map((photo, index) => (
                        <div key={photo.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                          <img src={photo.signedUrl} alt={`Fotografía ${index + 1} de ${selectedPlan.title}`} className="max-h-80 w-full object-contain" />
                          <div className="p-3">
                            <a
                              href={photo.signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={`foto-${index + 1}-${selectedPlan.title.replace(/[^a-z0-9áéíóúñ_-]+/gi, "-")}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-pink-200 transition hover:bg-white/5"
                            >
                              <Download className="h-4 w-4" />
                              Abrir / descargar foto
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Fecha</p>
                    <p className="flex items-center gap-2 text-gray-200"><CalendarDays className="h-4 w-4 text-pink-300" />{formatDate(selectedPlan.planned_at)}</p>
                  </div>
                  {selectedPlan.planned_at && (
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                      <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Hora</p>
                      <p className="flex items-center gap-2 text-gray-200"><Clock3 className="h-4 w-4 text-pink-300" />{formatTime(selectedPlan.planned_at)}</p>
                    </div>
                  )}
                  {selectedPlan.location && (
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                      <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Lugar</p>
                      <p className="flex items-start gap-2 break-words text-gray-200"><MapPin className="mt-1 h-4 w-4 shrink-0 text-pink-300" />{selectedPlan.location}</p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">Presupuesto</p>
                    <p className="flex items-center gap-2 text-gray-200"><Wallet className="h-4 w-4 text-pink-300" />{formatMoney(selectedPlan.budget)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
                  <h4 className="mb-2 font-semibold">Descripción y detalles</h4>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">
                    {selectedPlan.description || "Este plan todavía no tiene una descripción."}
                  </p>
                </div>

                {selectedPlan.map_url && (
                  <a href={selectedPlan.map_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-pink-300 transition hover:text-pink-200">
                    <MapPin className="h-4 w-4" />Ver ubicación en Google Maps<ExternalLink className="h-4 w-4" />
                  </a>
                )}

                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-5">
                  <button
                    type="button"
                    onClick={() => downloadPlanAsPng(selectedPlan)}
                    className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-400"
                  >
                    <Download className="h-4 w-4" />Descargar plan como PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const plan = selectedPlan;
                      setSelectedPlan(null);
                      openEditForm(plan);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition hover:bg-white/5"
                  >
                    <Pencil className="h-4 w-4" />Editar plan
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        <footer className="mt-12 pb-4 text-center text-xs text-gray-600">
          Hecho con cariño para ustedes dos ❤️
        </footer>
      </div>
    </main>
  );
}
