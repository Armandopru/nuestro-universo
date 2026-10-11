
import { NextRequest, NextResponse } from "next/server";

type CatalogType = "pelicula" | "serie" | "anime" | "dorama";

type CatalogResult = {
  id: string;
  title: string;
  description: string;
  posterUrl: string | null;
  year: number | null;
  itemType: CatalogType;
};

type TMDBItem = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  origin_country?: string[];
  original_language?: string;
};

type TMDBResponse = {
  results?: TMDBItem[];
};

type AniListItem = {
  id: number;
  title?: {
    romaji?: string | null;
    english?: string | null;
  };
  description?: string | null;
  coverImage?: {
    large?: string | null;
  };
  startDate?: {
    year?: number | null;
  };
};

type AniListResponse = {
  data?: {
    Page?: {
      media?: AniListItem[];
    };
  };
  errors?: Array<{
    message?: string;
  }>;
};

const imageUrl = (path?: string | null): string | null =>
  path ? `https://image.tmdb.org/t/p/w500${path}` : null;

// Países de origen habituales de los doramas.
const doramaCountries = ["KR", "JP", "CN", "TH", "TW"];

// Idiomas utilizados como respaldo si TMDB no informa el país.
const doramaLanguages = ["ko", "ja", "zh", "th"];

const validTypes: CatalogType[] = [
  "pelicula",
  "serie",
  "anime",
  "dorama",
];

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("tipo");

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Escribe al menos dos caracteres." },
      { status: 400 }
    );
  }

  if (!type || !validTypes.includes(type as CatalogType)) {
    return NextResponse.json(
      { error: "El tipo de contenido no es válido." },
      { status: 400 }
    );
  }

  const catalogType = type as CatalogType;

  try {
    // ANIME: búsqueda mediante AniList.
    // No requiere API key.
    if (catalogType === "anime") {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query: `
            query ($search: String) {
              Page(page: 1, perPage: 12) {
                media(
                  search: $search
                  type: ANIME
                  sort: SEARCH_MATCH
                ) {
                  id
                  title {
                    romaji
                    english
                  }
                  description(asHtml: false)
                  coverImage {
                    large
                  }
                  startDate {
                    year
                  }
                }
              }
            }
          `,
          variables: {
            search: query,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error("AniList respondió con estado:", response.status);

        return NextResponse.json(
          {
            error: `AniList no pudo completar la búsqueda (HTTP ${response.status}). Inténtalo nuevamente.`,
          },
          { status: 502 }
        );
      }

      const json = (await response.json()) as AniListResponse;

      if (json.errors?.length) {
        console.error("Errores de AniList:", json.errors);

        return NextResponse.json(
          { error: "AniList devolvió un error al buscar el anime." },
          { status: 502 }
        );
      }

      const items = json.data?.Page?.media ?? [];

      const results: CatalogResult[] = items.map((item) => ({
        id: `anime-${item.id}`,
        title:
          item.title?.english ||
          item.title?.romaji ||
          "Anime sin título",
        description: item.description ?? "",
        posterUrl: item.coverImage?.large ?? null,
        year: item.startDate?.year ?? null,
        itemType: "anime",
      }));

      return NextResponse.json({ results });
    }

    // PELÍCULAS, SERIES Y DORAMAS: búsqueda mediante TMDB.
    const token = process.env.TMDB_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: "Falta configurar TMDB_ACCESS_TOKEN en .env.local." },
        { status: 500 }
      );
    }

    const endpoint = catalogType === "pelicula" ? "movie" : "tv";

    const url = new URL(
      `https://api.themoviedb.org/3/search/${endpoint}`
    );

    url.searchParams.set("query", query);
    url.searchParams.set("language", "es-ES");
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("page", "1");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(
        "TMDB no respondió correctamente. Revisa la configuración de la API."
      );
    }

    const json = (await response.json()) as TMDBResponse;
    const items = json.results ?? [];

    // Filtramos los resultados para el tipo dorama.
    const filteredItems =
      catalogType === "dorama"
        ? items.filter((item) => {
            const countries = item.origin_country ?? [];

            if (countries.length > 0) {
              return countries.some((country) =>
                doramaCountries.includes(country)
              );
            }

            return doramaLanguages.includes(
              item.original_language ?? ""
            );
          })
        : items;

    const results: CatalogResult[] = filteredItems.map((item) => {
      const date = item.release_date ?? item.first_air_date;

      return {
        id: `${endpoint}-${item.id}`,
        title: item.title ?? item.name ?? "Sin título",
        description: item.overview ?? "",
        posterUrl: imageUrl(item.poster_path),
        year: date ? Number(date.slice(0, 4)) || null : null,
        itemType: catalogType,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error en la búsqueda del catálogo:", error);

    return NextResponse.json(
      {
        error: "No se pudo conectar con el catálogo.",
        detalle:
          error instanceof Error ? error.message : String(error),
        causa:
          error instanceof Error && error.cause
            ? String(error.cause)
            : "No disponible",
      },
      { status: 502 }
    );
  }
}
