import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  LOCAL_FIRST_SYNC_STATUSES,
  withLocalFirstSyncState,
} from "../cloud/localFirstSync";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import {
  getAllShows,
  getShowById,
  getShowsByAssociationId,
} from "./showSelectors";
import {
  createShow,
  deleteShow,
  saveShows,
  updateShow,
} from "./showStorage";

function toShow(row) {
  return {
    id: row.id,
    associationId: row.association_id,
    name: row.name || "",
    venue: row.venue || "",
    location: row.location || "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status: row.status || "draft",
    livestreamUrl: row.livestream_url || "",
    isLivestreamPublic: Boolean(row.is_livestream_public),
  };
}

function toShowRow(show) {
  return {
    id: show.id,
    association_id: show.associationId,
    name: show.name || "",
    venue: show.venue || "",
    location: show.location || "",
    start_date: show.startDate || null,
    end_date: show.endDate || null,
    status: show.status || "draft",
    livestream_url: show.livestreamUrl || "",
    is_livestream_public: Boolean(show.isLivestreamPublic),
  };
}

function toLegacyShowRow(show) {
  const row = toShowRow(show);
  delete row.livestream_url;
  delete row.is_livestream_public;
  return row;
}

function isLivestreamSchemaMissing(error) {
  const message = String(error?.message || "");

  return /livestream_url|is_livestream_public/i.test(message);
}

function saveShowLocally(show) {
  const current = getShowsByAssociationId(show.associationId);
  const exists = current.some((item) => item.id === show.id);

  if (exists) {
    updateShow(show.id, show);
  } else {
    createShow(show);
  }

  return show;
}

export async function getShowsByAssociationRepository(associationId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return getShowsByAssociationId(associationId);
  }

  try {
    const { data, error } = await supabase
      .from("shows")
      .select("*")
      .eq("association_id", associationId)
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error) throw error;

    const shows = Array.isArray(data) ? data.map(toShow) : [];

    const otherLocalShows = getAllShows().filter(
      (show) => show.associationId !== associationId
    );
    saveShows([...otherLocalShows, ...shows]);

    return shows;
  } catch (error) {
    console.error("Erreur chargement shows Supabase:", error);
    return getShowsByAssociationId(associationId);
  }
}

export async function getShowRepository(showId) {
  const localShow = getShowById(showId);

  if (!getSupabaseClient()) {
    return localShow;
  }

  try {
    const { data, error } = await getSupabaseClient()
      .from("shows")
      .select("*")
      .eq("id", showId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localShow;

    const show = toShow(data);
    saveShowLocally(show);
    return show;
  } catch (error) {
    console.error("Erreur chargement show Supabase:", error);
    return localShow;
  }
}

export async function saveShowRepository(show) {
  const supabase = getSupabaseClient();
  const isExistingShow = Boolean(getShowById(show.id));
  let syncStatus = supabase
    ? LOCAL_FIRST_SYNC_STATUSES.SYNCED
    : LOCAL_FIRST_SYNC_STATUSES.LOCAL;
  let syncError = null;

  if (supabase) {
    try {
      const { error } = await supabase.from("shows").upsert(toShowRow(show));
      if (error) throw error;
    } catch (error) {
      if (isLivestreamSchemaMissing(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("shows")
            .upsert(toLegacyShowRow(show));
          if (legacyError) throw legacyError;
          syncStatus = LOCAL_FIRST_SYNC_STATUSES.ERROR;
          syncError =
            "Les colonnes livestream ne sont pas disponibles dans Supabase. Le show est sauvegardé localement, mais le livestream public ne sera pas visible tant que la migration n'est pas appliquée.";
        } catch (legacyError) {
          console.error("Erreur sauvegarde show Supabase:", legacyError);
          syncStatus = LOCAL_FIRST_SYNC_STATUSES.ERROR;
          syncError = legacyError;
        }
      } else {
        console.error("Erreur sauvegarde show Supabase:", error);
        syncStatus = LOCAL_FIRST_SYNC_STATUSES.ERROR;
        syncError = error;
      }
    }
  }

  const savedShow = saveShowLocally(show);

  trackEvent({
    eventName: isExistingShow ? "show_updated" : "show_created",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: savedShow.associationId,
    showId: savedShow.id,
    metadata: {
      name: savedShow.name,
      status: savedShow.status,
    },
  });

  return withLocalFirstSyncState(savedShow, {
    status: syncStatus,
    error: syncError,
  });
}

export async function deleteShowRepository(showId) {
  const supabase = getSupabaseClient();
  const existingShow = getShowById(showId);

  if (supabase) {
    try {
      const { error } = await supabase.from("shows").delete().eq("id", showId);
      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression show Supabase:", error);
    }
  }

  deleteShow(showId);

  trackEvent({
    eventName: "show_deleted",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: existingShow?.associationId,
    showId,
    metadata: {
      name: existingShow?.name || "",
    },
  });
}
