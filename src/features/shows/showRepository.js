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

function toShowStatus(hspStatus) {
  if (hspStatus === "open") return "active";
  if (hspStatus === "closed") return "completed";
  return hspStatus || "draft";
}

function toHspShowStatus(ssStatus) {
  if (ssStatus === "active") return "open";
  if (ssStatus === "completed") return "closed";
  return ssStatus || "draft";
}

function toShow(row) {
  return {
    id: row.id,
    associationId: row.organization_id || row.association_id,
    name: row.name || "",
    venue: row.venue || "",
    location: row.location || "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    status: toShowStatus(row.status),
    livestreamUrl: row.livestream_url || "",
    isLivestreamPublic: Boolean(row.is_livestream_public),
    isSchedulePublic: Boolean(
      row.is_public || row.show_schedule_public || row.is_schedule_public
    ),
  };
}

function toShowRow(show, options = {}) {
  const includePublicSchedule = options.includePublicSchedule !== false;
  const row = {
    id: show.id,
    organization_id: show.associationId,
    name: show.name || "",
    venue: show.venue || "",
    location: show.location || "",
    start_date: show.startDate || null,
    end_date: show.endDate || null,
    status: toHspShowStatus(show.status),
    livestream_url: show.livestreamUrl || "",
    is_livestream_public: Boolean(show.isLivestreamPublic),
  };

  if (includePublicSchedule) {
    row.is_public = Boolean(show.isSchedulePublic);
    row.show_schedule_public = Boolean(show.isSchedulePublic);
  }

  return row;
}

function toLegacyShowRow(show) {
  const row = toShowRow(show, { includePublicSchedule: false });
  delete row.livestream_url;
  delete row.is_livestream_public;
  return row;
}

function getSupabaseErrorText(error) {
  return [error?.message, error?.details, error?.hint]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function isLivestreamSchemaMissing(error) {
  const message = getSupabaseErrorText(error);

  return /livestream_url|is_livestream_public/i.test(message);
}

function isScheduleSchemaMissing(error) {
  return /is_schedule_public|show_schedule_public|is_public/i.test(
    getSupabaseErrorText(error)
  );
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
    const result = await supabase
      .from("shows")
      .select("*")
      .eq("organization_id", associationId)
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (result.error) throw result.error;

    const shows = Array.isArray(result.data) ? result.data.map(toShow) : [];

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
      if (isLivestreamSchemaMissing(error) || isScheduleSchemaMissing(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("shows")
            .upsert(
              isLivestreamSchemaMissing(error)
                ? toLegacyShowRow(show)
                : toShowRow(show, { includePublicSchedule: false })
            );

          if (legacyError) {
            throw legacyError;
          } else {
            syncStatus = LOCAL_FIRST_SYNC_STATUSES.ERROR;
            syncError =
              "Certaines colonnes publiques du show ne sont pas disponibles dans Supabase. Le show est sauvegardé localement, mais ces réglages publics ne seront visibles qu'après la migration.";
          }
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

export async function activateShowForScoringRepository({ classId, showId } = {}) {
  const supabase = getSupabaseClient();
  const existingShow = showId ? getShowById(showId) : null;

  if (existingShow?.status === "active") {
    return existingShow;
  }

  if (supabase && classId) {
    try {
      const { error } = await supabase.rpc("activate_show_for_scoring", {
        target_class_id: classId,
      });

      if (error) throw error;
    } catch (error) {
      console.error("Erreur activation show Supabase:", error);

      if (showId) {
        try {
          const { error: updateError } = await supabase
            .from("shows")
            .update({ status: "open" })
            .eq("id", showId);

          if (updateError) throw updateError;
        } catch (updateError) {
          console.error("Erreur activation directe show Supabase:", updateError);
        }
      }
    }
  }

  if (existingShow) {
    return saveShowLocally({ ...existingShow, status: "active" });
  }

  return null;
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
