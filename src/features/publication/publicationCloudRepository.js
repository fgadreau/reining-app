import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { getAllClasses, getClassById } from "../classes/classSelectors";
import { getDaysByShowId } from "../days/daySelectors";
import {
  deletePublicationState,
  getDefaultPublicationState,
  getPublicationState,
  isLivePublicationStatus,
  LIVE_PUBLICATION_STATUSES,
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

function getArenaKey(arena) {
  return String(arena || "").trim().toLocaleLowerCase() || "__no_arena__";
}

function isSameArena(firstArena, secondArena) {
  return getArenaKey(firstArena) === getArenaKey(secondArena);
}

function sortClassesForLiveSchedule(classes, days) {
  const dayOrderById = new Map(
    (Array.isArray(days) ? days : []).map((day, index) => [
      day.id,
      {
        sortOrder: day.sortOrder || index + 1,
        date: day.date || "",
      },
    ])
  );

  return [...(Array.isArray(classes) ? classes : [])].sort((a, b) => {
    const firstDay = dayOrderById.get(a.dayId || a.day_id) || {};
    const secondDay = dayOrderById.get(b.dayId || b.day_id) || {};
    const daySort = (firstDay.sortOrder || 0) - (secondDay.sortOrder || 0);
    if (daySort !== 0) return daySort;

    const dateSort = String(firstDay.date || "").localeCompare(
      String(secondDay.date || "")
    );
    if (dateSort !== 0) return dateSort;

    const classSort = (a.sortOrder || a.sort_order || 0) - (b.sortOrder || b.sort_order || 0);
    if (classSort !== 0) return classSort;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getLocalArenaClasses(showId, arena) {
  return getAllClasses().filter(
    (classItem) =>
      classItem.showId === showId && isSameArena(classItem.arena, arena)
  );
}

async function getRemoteShowClassesAndDays(supabase, showId) {
  const [classesResult, daysResult] = await Promise.all([
    supabase
      .from("classes")
      .select("id, show_id, day_id, name, arena, sort_order")
      .eq("show_id", showId),
    supabase
      .from("days")
      .select("id, date, sort_order")
      .eq("show_id", showId),
  ]);

  if (classesResult.error) throw classesResult.error;
  if (daysResult.error) throw daysResult.error;

  return {
    classes: Array.isArray(classesResult.data) ? classesResult.data : [],
    days: Array.isArray(daysResult.data) ? daysResult.data : [],
  };
}

function findNextArenaClass(classes, days, completedClassId) {
  const sortedClasses = sortClassesForLiveSchedule(classes, days);
  const completedIndex = sortedClasses.findIndex(
    (classItem) => classItem.id === completedClassId
  );

  return completedIndex >= 0 ? sortedClasses[completedIndex + 1] || null : null;
}

export async function hideOtherArenaLiveClassesRepository({
  showId,
  arena,
  classId,
}) {
  const normalizedShowId = String(showId || "");
  const normalizedClassId = String(classId || "");

  if (!normalizedShowId || !normalizedClassId) {
    return;
  }

  const localClassIds = getAllClasses()
    .filter(
      (classItem) =>
        classItem.showId === normalizedShowId &&
        isSameArena(classItem.arena, arena)
    )
    .map((classItem) => classItem.id)
    .filter((id) => id && id !== normalizedClassId);

  localClassIds.forEach((otherClassId) => {
    const currentState = getPublicationState(otherClassId);

    if (!isLivePublicationStatus(currentState.status)) return;

    savePublicationState(otherClassId, {
      status: PUBLICATION_STATUSES.HIDDEN,
      publishedAt: null,
      publishedBy: null,
    });
  });

  const supabase = getSupabaseClient();

  if (!supabase) {
    return;
  }

  try {
    const { classes } = await getRemoteShowClassesAndDays(
      supabase,
      normalizedShowId
    );

    const remoteClassIds = classes
      .filter((classItem) => isSameArena(classItem.arena, arena))
      .map((row) => row.id)
      .filter((id) => id && id !== normalizedClassId);

    if (remoteClassIds.length === 0) return;

    const { error: updateError } = await supabase
      .from("publication_states")
      .update({
        status: PUBLICATION_STATUSES.HIDDEN,
        published_at: null,
        published_by: null,
      })
      .in("class_id", remoteClassIds)
      .in("status", LIVE_PUBLICATION_STATUSES);

    if (updateError) throw updateError;
  } catch (error) {
    console.error("Erreur masquage des autres lives Supabase:", error);
  }
}

export async function saveArenaCurrentLiveClassRepository({
  showId,
  arena,
  classId,
  status,
}) {
  await hideOtherArenaLiveClassesRepository({ showId, arena, classId });

  return savePublicationStateRepository(classId, {
    status,
    publishedAt: null,
    publishedBy: null,
  });
}

export async function advanceArenaLiveClassAfterCompletionRepository({
  showId,
  arena,
  classId,
  nextStatus = PUBLICATION_STATUSES.LIVE_NO_SCORE,
}) {
  const normalizedShowId = String(showId || "");
  const normalizedClassId = String(classId || "");

  if (!normalizedShowId || !normalizedClassId) {
    return null;
  }

  const localNextClass = findNextArenaClass(
    getLocalArenaClasses(normalizedShowId, arena),
    getDaysByShowId(normalizedShowId),
    normalizedClassId
  );

  if (localNextClass) {
    return saveArenaCurrentLiveClassRepository({
      showId: normalizedShowId,
      arena,
      classId: localNextClass.id,
      status: nextStatus,
    });
  }

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { classes, days } = await getRemoteShowClassesAndDays(
        supabase,
        normalizedShowId
      );
      const remoteNextClass = findNextArenaClass(
        classes.filter((classItem) => isSameArena(classItem.arena, arena)),
        days,
        normalizedClassId
      );

      if (remoteNextClass) {
        return saveArenaCurrentLiveClassRepository({
          showId: normalizedShowId,
          arena,
          classId: remoteNextClass.id,
          status: nextStatus,
        });
      }
    } catch (error) {
      console.error("Erreur avancement live Supabase:", error);
    }
  }

  return savePublicationStateRepository(normalizedClassId, {
    status: PUBLICATION_STATUSES.HIDDEN,
    publishedAt: null,
    publishedBy: null,
  });
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
