import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { getClassById } from "../classes/classSelectors";
import {
  deletePublicationState,
  getDefaultPublicationState,
  getPublicationState,
  loadAllPublicationStates,
  PUBLICATION_STATUSES,
  saveAllPublicationStates,
  savePublicationState,
} from "./publicationRepository";

function toPublicationState(row) {
  return {
    classId: row.class_id,
    status: row.status || PUBLICATION_STATUSES.HIDDEN,
    publishedAt: row.published_at || null,
    publishedBy: row.published_by || null,
    publicUrl: row.public_url || null,
    visibleFields: Array.isArray(row.visible_fields)
      ? row.visible_fields
      : getDefaultPublicationState(row.class_id).visibleFields,
  };
}

function toPublicationRow(classId, publication) {
  const state = {
    ...getDefaultPublicationState(classId),
    ...publication,
    classId,
  };

  return {
    class_id: classId,
    status: state.status,
    published_at: state.publishedAt || null,
    published_by: state.publishedBy || null,
    public_url: state.publicUrl || null,
    visible_fields: state.visibleFields,
  };
}

export async function getPublicationStateRepository(classId) {
  const localState = getPublicationState(classId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localState;
  }

  try {
    const { data, error } = await supabase
      .from("publication_states")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localState;

    const state = toPublicationState(data);
    savePublicationState(classId, state);
    return state;
  } catch (error) {
    console.error("Erreur chargement publication Supabase:", error);
    return localState;
  }
}

export async function getPublicationStatesForClassesRepository(classIds) {
  const uniqueIds = [...new Set(classIds.filter(Boolean))];
  const localStates = loadAllPublicationStates();
  const supabase = getSupabaseClient();

  if (!supabase || uniqueIds.length === 0) {
    return uniqueIds.reduce((states, classId) => {
      states[classId] = getPublicationState(classId);
      return states;
    }, {});
  }

  try {
    const { data, error } = await supabase
      .from("publication_states")
      .select("*")
      .in("class_id", uniqueIds);

    if (error) throw error;

    const nextStates = { ...localStates };
    const result = {};

    uniqueIds.forEach((classId) => {
      result[classId] = getPublicationState(classId);
    });

    (data || []).forEach((row) => {
      const state = toPublicationState(row);
      nextStates[state.classId] = state;
      result[state.classId] = state;
    });

    saveAllPublicationStates(nextStates);
    return result;
  } catch (error) {
    console.error("Erreur chargement publications Supabase:", error);
    return uniqueIds.reduce((states, classId) => {
      states[classId] = getPublicationState(classId);
      return states;
    }, {});
  }
}

export async function savePublicationStateRepository(classId, updates) {
  const previousState = getPublicationState(classId);
  const nextState = savePublicationState(classId, updates);
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("publication_states")
        .upsert(toPublicationRow(classId, nextState));

      if (error) throw error;
    } catch (error) {
      console.error("Erreur sauvegarde publication Supabase:", error);
    }
  }

  if (previousState.status !== nextState.status) {
    const classItem = getClassById(classId);
    const eventName =
      nextState.status === PUBLICATION_STATUSES.PUBLISHED
        ? "scoresheet_published"
        : nextState.status === PUBLICATION_STATUSES.HIDDEN
          ? "scoresheet_hidden"
          : "publication_status_changed";

    trackEvent({
      eventName,
      eventType: APP_EVENT_TYPES.AUDIT,
      associationId: classItem?.associationId,
      showId: classItem?.showId,
      dayId: classItem?.dayId,
      classId,
      metadata: {
        previousStatus: previousState.status,
        nextStatus: nextState.status,
        className: classItem?.name || "",
      },
    });
  }

  return nextState;
}

export function publishClassRepository(classId, publishedBy = null) {
  return savePublicationStateRepository(classId, {
    status: PUBLICATION_STATUSES.PUBLISHED,
    publishedAt: new Date().toISOString(),
    publishedBy,
  });
}

export function unpublishClassRepository(classId) {
  return savePublicationStateRepository(classId, {
    status: PUBLICATION_STATUSES.HIDDEN,
    publishedAt: null,
    publishedBy: null,
  });
}

export async function deletePublicationStateRepository(classId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("publication_states")
        .delete()
        .eq("class_id", classId);

      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression publication Supabase:", error);
    }
  }

  deletePublicationState(classId);
}
