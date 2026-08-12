import {
  LOCAL_FIRST_SYNC_STATUSES,
  withLocalFirstSyncState,
} from "../cloud/localFirstSync";
import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { createId } from "../../utils/createId";
import {
  ensureChampionshipOccurrenceResults,
  stripChampionshipMoneyData,
} from "./championshipStandings";

const STORAGE_KEY = "showscore_championship_seasons_v1";
const PRIVATE_TABLE = "show_score_championship_seasons";
const PUBLIC_TABLE = "show_score_public_championship_seasons";

export async function getChampionshipSeasonsRepository(associationId) {
  const localSeasons = getLocalChampionshipSeasons(associationId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localSeasons;
  }

  try {
    const { data, error } = await supabase
      .from(PRIVATE_TABLE)
      .select("*")
      .eq("organization_id", associationId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const remoteSeasons = Array.isArray(data) ? data.map(toPrivateSeason) : [];
    mergeLocalSeasons(remoteSeasons);
    return remoteSeasons;
  } catch (error) {
    console.error("Erreur chargement championnat Supabase:", error);
    return localSeasons;
  }
}

export async function getLatestChampionshipSeasonRepository(associationId) {
  return (
    (await getChampionshipSeasonsRepository(associationId)).sort(compareSeasons)[0] ||
    null
  );
}

export async function getPublicChampionshipSeasonRepository(associationId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(PUBLIC_TABLE)
        .select("*")
        .eq("organization_id", associationId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) return toPublicSeason(data);
    } catch (error) {
      console.error("Erreur chargement championnat public Supabase:", error);
    }
  }

  const season =
    getLocalChampionshipSeasons(associationId)
      .filter((item) => item.status === "published" || item.status === "final")
      .sort(compareSeasons)[0] || null;

  return season ? toPublicChampionshipSeason(season) : null;
}

export async function saveChampionshipSeasonRepository(season) {
  const now = new Date().toISOString();
  const supabase = getSupabaseClient();
  const normalizedSeason = stripChampionshipMoneyData(
    ensureChampionshipOccurrenceResults(season)
  );
  const existingSeasonId =
    normalizedSeason.id ||
    (supabase
      ? await findExistingPublicSeasonId(supabase, normalizedSeason)
      : "");
  const nextSeason = {
    ...normalizedSeason,
    id: existingSeasonId || createId("championship"),
    updatedAt: now,
    createdAt: normalizedSeason.createdAt || now,
  };
  // Supabase is authoritative when configured. Keeping imports and derived
  // standings in localStorage duplicates a potentially very large payload.
  // Local persistence is therefore only a lightweight cache in that mode.
  saveChampionshipSeasonLocally(nextSeason, { compact: Boolean(supabase) });
  const savedLocal = nextSeason;
  let syncStatus = supabase
    ? LOCAL_FIRST_SYNC_STATUSES.SYNCED
    : LOCAL_FIRST_SYNC_STATUSES.LOCAL;
  let syncError = null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(PRIVATE_TABLE)
        .upsert(toPrivateRow(savedLocal), { onConflict: "id" })
        .select("*")
        .maybeSingle();

      if (error) throw error;

      const remoteSeason = data ? toPrivateSeason(data) : savedLocal;

      if (isPublicChampionshipStatus(remoteSeason.status)) {
        const { error: publicError } = await supabase
          .from(PUBLIC_TABLE)
          .upsert(toPublicRow(remoteSeason), { onConflict: "season_id" });

        if (publicError) throw publicError;
      } else {
        const { error: deletePublicError } = await supabase
          .from(PUBLIC_TABLE)
          .delete()
          .eq("season_id", remoteSeason.id);

        if (deletePublicError) throw deletePublicError;
      }

      saveChampionshipSeasonLocally(remoteSeason, { compact: true });
      trackChampionshipSave(remoteSeason);

      return withLocalFirstSyncState(remoteSeason, {
        status: syncStatus,
      });
    } catch (error) {
      console.error("Erreur sauvegarde championnat Supabase:", error);
      syncStatus = LOCAL_FIRST_SYNC_STATUSES.ERROR;
      syncError = error;
    }
  }

  trackChampionshipSave(savedLocal);

  return withLocalFirstSyncState(savedLocal, {
    status: syncStatus,
    error: syncError,
  });
}

export async function findExistingPublicSeasonId(supabase, season) {
  const associationId = String(season?.associationId || "").trim();
  const year = String(season?.year || "").trim();

  if (!associationId) return "";

  try {
    let query = supabase
      .from(PUBLIC_TABLE)
      .select("season_id")
      .eq("organization_id", associationId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (year) {
      query = query.eq("season_year", year);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    return String(data?.season_id || "").trim();
  } catch (error) {
    console.error(
      "Erreur recherche saison championnat publique existante:",
      error
    );
    return "";
  }
}

function toPrivateRow(season) {
  const cleanSeason = stripChampionshipMoneyData(season);

  return {
    id: cleanSeason.id,
    organization_id: cleanSeason.associationId,
    title: cleanSeason.title || "",
    season_year: cleanSeason.year || "",
    status: cleanSeason.status || "draft",
    season_payload: sanitizeJsonPayload(cleanSeason),
    created_at: cleanSeason.createdAt || new Date().toISOString(),
    updated_at: cleanSeason.updatedAt || new Date().toISOString(),
  };
}

function toPublicRow(season) {
  const publicSeason = toPublicChampionshipSeason(season);

  return {
    season_id: season.id,
    organization_id: season.associationId,
    title: publicSeason.title || "",
    season_year: publicSeason.year || "",
    status: publicSeason.status || "published",
    public_payload: sanitizeJsonPayload(publicSeason),
    updated_at: season.updatedAt || new Date().toISOString(),
  };
}

function toPrivateSeason(row) {
  const payload =
    row.season_payload && typeof row.season_payload === "object"
      ? row.season_payload
      : {};

  return stripChampionshipMoneyData(ensureChampionshipOccurrenceResults({
    ...payload,
    id: row.id,
    associationId: row.organization_id || payload.associationId || "",
    title: row.title || payload.title || "",
    year: row.season_year || payload.year || "",
    status: row.status || payload.status || "draft",
    createdAt: row.created_at || payload.createdAt || null,
    updatedAt: row.updated_at || payload.updatedAt || null,
  }));
}

function toPublicSeason(row) {
  const payload =
    row.public_payload && typeof row.public_payload === "object"
      ? row.public_payload
      : {};

  return stripChampionshipMoneyData(
    ensureChampionshipOccurrenceResults({
      ...payload,
      id: row.season_id || payload.id || "",
      associationId: row.organization_id || payload.associationId || "",
      title: row.title || payload.title || "",
      year: row.season_year || payload.year || "",
      status: row.status || payload.status || "published",
      updatedAt: row.updated_at || payload.updatedAt || null,
    })
  );
}

function compareSeasons(a, b) {
  return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
}

function toPublicChampionshipSeason(season) {
  const normalizedSeason = ensureChampionshipOccurrenceResults(season);
  const {
    imports,
    validation,
    championshipClassMappings,
    _localFirstSync,
    ...publicSeason
  } =
    normalizedSeason;

  return stripChampionshipMoneyData(publicSeason);
}

function isPublicChampionshipStatus(status) {
  return status === "published" || status === "final";
}

function getLocalChampionshipSeasons(associationId) {
  return readSeasons()
    .filter((season) => season.associationId === associationId)
    .map((season) =>
      stripChampionshipMoneyData(ensureChampionshipOccurrenceResults(season))
    );
}

function saveChampionshipSeasonLocally(season, { compact = false } = {}) {
  const seasons = readSeasons();
  const index = seasons.findIndex((item) => item.id === season.id);
  const localSeason = compact ? toLocalSeasonMetadata(season) : season;

  if (index === -1) {
    seasons.push(localSeason);
  } else {
    seasons[index] = localSeason;
  }

  try {
    writeSeasons(seasons);
  } catch (error) {
    // localStorage is a best-effort cache. A quota failure must never prevent
    // the authoritative server write. Retry with metadata-only seasons so
    // useful season identity/preferences remain available offline.
    try {
      writeSeasons(seasons.map(toLocalSeasonMetadata));
    } catch (fallbackError) {
      console.warn("Cache local du championnat indisponible:", fallbackError);
    }
  }
  return season;
}

function mergeLocalSeasons(remoteSeasons) {
  if (!remoteSeasons.length) return;

  const seasonsById = new Map(readSeasons().map((season) => [season.id, season]));

  remoteSeasons.forEach((season) => {
    seasonsById.set(season.id, toLocalSeasonMetadata(season));
  });

  writeSeasons(Array.from(seasonsById.values()));
}

function toLocalSeasonMetadata(season) {
  return {
    id: season?.id || "",
    associationId: season?.associationId || "",
    title: season?.title || "",
    year: season?.year || "",
    status: season?.status || "draft",
    createdAt: season?.createdAt || null,
    updatedAt: season?.updatedAt || null,
    classCount: season?.classCount || 0,
    eventCount: season?.eventCount || 0,
    showCount: season?.showCount || 0,
    teamCount: season?.teamCount || 0,
    importCount: season?.importCount || 0,
    publicEventLabels: season?.publicEventLabels || {},
    publicEventOrder: season?.publicEventOrder || {},
    championshipClassMappings: season?.championshipClassMappings || {},
  };
}

function sanitizeJsonPayload(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function readSeasons() {
  try {
    const storage = getStorage();
    if (!storage) return [];

    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeSeasons(seasons) {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(STORAGE_KEY, JSON.stringify(seasons));
}

function trackChampionshipSave(season) {
  trackEvent({
    eventName: "championship_saved",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: season.associationId,
    metadata: {
      title: season.title,
      year: season.year,
      status: season.status,
      classCount: season.classCount || 0,
      importCount: season.importCount || 0,
    },
  });
}

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}
