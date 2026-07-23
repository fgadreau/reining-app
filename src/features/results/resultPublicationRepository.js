import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  LOCAL_FIRST_SYNC_STATUSES,
  withLocalFirstSyncState,
} from "../cloud/localFirstSync";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { getClassById } from "../classes/classSelectors";
import {
  buildClassResultGroups,
  isClassResultsSecretariatApproved,
  normalizeResultGroups,
} from "./classResults";

const STORAGE_KEY = "showscore_result_publications_v1";

export const RESULT_PUBLICATION_STATUSES = {
  HIDDEN: "hidden",
  PUBLISHED: "published",
};

export function getDefaultResultPublication(classId) {
  return {
    classId,
    status: RESULT_PUBLICATION_STATUSES.HIDDEN,
    publishedAt: null,
    publishedBy: null,
    resultGroups: [],
  };
}

export function loadAllResultPublications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture publications résultats:", error);
    return {};
  }
}

export function saveAllResultPublications(publications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(publications || {}));
  } catch (error) {
    console.error("Erreur sauvegarde publications résultats:", error);
  }
}

export function getClassResultPublication(classId) {
  const all = loadAllResultPublications();
  return normalizeResultPublication({
    ...getDefaultResultPublication(classId),
    ...(all[classId] || {}),
    classId,
  });
}

export function saveClassResultPublication(classId, updates) {
  const all = loadAllResultPublications();
  const current = getClassResultPublication(classId);
  const next = normalizeResultPublication({
    ...current,
    ...updates,
    classId,
    resultGroups: Array.isArray(updates?.resultGroups)
      ? updates.resultGroups
      : current.resultGroups,
  });

  saveAllResultPublications({
    ...all,
    [classId]: next,
  });

  return next;
}

export async function getClassResultPublicationRepository(classId) {
  const localPublication = getClassResultPublication(classId);
  const supabase = getSupabaseClient();

  if (!supabase) return localPublication;

  try {
    const { data, error } = await supabase
      .from("class_result_publications")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localPublication;

    const publication = toResultPublication(data);
    saveClassResultPublication(classId, publication);
    return publication;
  } catch (error) {
    console.error("Erreur chargement publication résultats Supabase:", error);
    return localPublication;
  }
}

export async function getResultPublicationsForClassesRepository(classIds) {
  const uniqueIds = [...new Set((classIds || []).filter(Boolean))];
  const localPublications = loadAllResultPublications();
  const supabase = getSupabaseClient();

  if (!supabase || uniqueIds.length === 0) {
    return uniqueIds.reduce((result, classId) => {
      result[classId] = getClassResultPublication(classId);
      return result;
    }, {});
  }

  try {
    const { data, error } = await supabase
      .from("class_result_publications")
      .select("*")
      .in("class_id", uniqueIds);

    if (error) throw error;

    const nextLocalPublications = { ...localPublications };
    const result = uniqueIds.reduce((items, classId) => {
      items[classId] = getClassResultPublication(classId);
      return items;
    }, {});

    (data || []).forEach((row) => {
      const publication = toResultPublication(row);
      nextLocalPublications[publication.classId] = publication;
      result[publication.classId] = publication;
    });

    saveAllResultPublications(nextLocalPublications);
    return result;
  } catch (error) {
    console.error("Erreur chargement publications résultats Supabase:", error);
    return uniqueIds.reduce((result, classId) => {
      result[classId] = getClassResultPublication(classId);
      return result;
    }, {});
  }
}

export async function publishClassResultsRepository({
  classData,
  publishedBy = null,
}) {
  const classId = classData?.classItem?.id;

  if (!classId) {
    throw new Error("Bloc introuvable.");
  }

  if (!isClassResultsSecretariatApproved(classData)) {
    throw new Error(
      "Les résultats doivent être validés au secrétariat avant publication."
    );
  }

  const resultGroups = buildClassResultGroups(classData);

  if (resultGroups.length === 0) {
    throw new Error("Aucun résultat à publier pour ce bloc.");
  }

  return saveClassResultPublicationRepository(classId, {
    status: RESULT_PUBLICATION_STATUSES.PUBLISHED,
    publishedAt: new Date().toISOString(),
    publishedBy,
    resultGroups,
  });
}

export function unpublishClassResultsRepository(classId) {
  return saveClassResultPublicationRepository(classId, {
    status: RESULT_PUBLICATION_STATUSES.HIDDEN,
    publishedAt: null,
    publishedBy: null,
  });
}

export async function saveClassResultPublicationRepository(classId, updates) {
  const previous = getClassResultPublication(classId);
  const next = saveClassResultPublication(classId, updates);
  const supabase = getSupabaseClient();
  let syncStatus = supabase
    ? LOCAL_FIRST_SYNC_STATUSES.SYNCED
    : LOCAL_FIRST_SYNC_STATUSES.LOCAL;
  let syncError = null;

  if (supabase) {
    try {
      const { error } = await supabase
        .from("class_result_publications")
        .upsert(toResultPublicationRow(classId, next));

      if (error) throw error;
    } catch (error) {
      console.error("Erreur sauvegarde publication résultats Supabase:", error);
      syncStatus = LOCAL_FIRST_SYNC_STATUSES.ERROR;
      syncError = error;
    }
  }

  if (previous.status !== next.status) {
    const classItem = getClassById(classId);
    trackEvent({
      eventName:
        next.status === RESULT_PUBLICATION_STATUSES.PUBLISHED
          ? "class_results_published"
          : "class_results_hidden",
      eventType: APP_EVENT_TYPES.AUDIT,
      associationId: classItem?.associationId,
      showId: classItem?.showId,
      dayId: classItem?.dayId,
      classId,
      metadata: {
        previousStatus: previous.status,
        nextStatus: next.status,
        className: classItem?.name || "",
        resultGroupCount: next.resultGroups.length,
      },
    });
  }

  return withLocalFirstSyncState(next, {
    status: syncStatus,
    error: syncError,
  });
}

function normalizeResultPublication(publication) {
  const classId = publication?.classId || publication?.class_id || "";

  return {
    ...getDefaultResultPublication(classId),
    classId,
    status:
      publication?.status === RESULT_PUBLICATION_STATUSES.PUBLISHED
        ? RESULT_PUBLICATION_STATUSES.PUBLISHED
        : RESULT_PUBLICATION_STATUSES.HIDDEN,
    publishedAt: publication?.publishedAt || publication?.published_at || null,
    publishedBy: publication?.publishedBy || publication?.published_by || null,
    resultGroups: normalizeResultGroups(
      publication?.resultGroups || publication?.result_groups
    ),
  };
}

function toResultPublication(row) {
  return normalizeResultPublication({
    classId: row.class_id,
    status: row.status,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    resultGroups: row.result_groups,
  });
}

function toResultPublicationRow(classId, publication) {
  const normalized = normalizeResultPublication({
    ...publication,
    classId,
  });

  return {
    class_id: classId,
    status: normalized.status,
    published_at: normalized.publishedAt || null,
    published_by: normalized.publishedBy || null,
    result_groups: normalized.resultGroups,
  };
}
