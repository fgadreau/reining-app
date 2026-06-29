import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { getAllClasses, getClassById } from "../classes/classSelectors";
import { getDaysByShowId } from "../days/daySelectors";
import {
  getPaidWarmupById,
  loadPaidWarmups,
  savePaidWarmup,
} from "../paidWarmups/paidWarmupStorage";
import { isNoPatternValue } from "../patterns/patternDefinitions";
import {
  LIVE_SCHEDULE_ITEM_TYPES,
  buildLiveScheduleItems,
  findFirstPendingPaidWarmupBeforeItem,
  findNextScheduleItemInArena,
  findScheduleItem,
  isSameScheduleArena,
} from "../schedule/liveSchedule";
import {
  deletePublicationState,
  getDefaultPublicationState,
  getPublicationState,
  getPlannedLiveStatus,
  isLivePublicationStatus,
  LIVE_PUBLICATION_STATUSES,
  loadAllPublicationStates,
  normalizePlannedLiveStatus,
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
    plannedLiveStatus: normalizePlannedLiveStatus(
      row.planned_live_status,
      isLivePublicationStatus(row.status)
        ? normalizePlannedLiveStatus(row.status)
        : getDefaultPublicationState(row.class_id).plannedLiveStatus
    ),
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
    planned_live_status: normalizePlannedLiveStatus(state.plannedLiveStatus),
    visible_fields: state.visibleFields,
  };
}

function isPlannedLiveStatusColumnMissingError(error) {
  return String(error?.message || "").includes("planned_live_status");
}

function getSupabaseErrorText(error) {
  return [error?.message, error?.details, error?.hint]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function isEventBlockColumnMissingError(error) {
  return getSupabaseErrorText(error).includes("is_event_block");
}

export async function getPublicationStateRepository(classId) {
  const localState = getPublicationState(classId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localState;
  }

  try {
    const { data, error } = await supabase
      .from("show_score_publication_states")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localState;

    const remoteState = toPublicationState(data);
    const state = {
      ...remoteState,
      plannedLiveStatus:
        Object.prototype.hasOwnProperty.call(data, "planned_live_status")
          ? remoteState.plannedLiveStatus
          : localState.plannedLiveStatus,
    };
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
      .from("show_score_publication_states")
      .select("*")
      .in("class_id", uniqueIds);

    if (error) throw error;

    const nextStates = { ...localStates };
    const result = {};

    uniqueIds.forEach((classId) => {
      result[classId] = getPublicationState(classId);
    });

    (data || []).forEach((row) => {
      const remoteState = toPublicationState(row);
      const state = {
        ...remoteState,
        plannedLiveStatus: Object.prototype.hasOwnProperty.call(
          row,
          "planned_live_status"
        )
          ? remoteState.plannedLiveStatus
          : result[remoteState.classId]?.plannedLiveStatus ||
            getDefaultPublicationState(remoteState.classId).plannedLiveStatus,
      };
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
        .from("show_score_publication_states")
        .upsert(toPublicationRow(classId, nextState));

      if (error) throw error;
    } catch (error) {
      if (isPlannedLiveStatusColumnMissingError(error)) {
        try {
          const legacyRow = toPublicationRow(classId, nextState);
          delete legacyRow.planned_live_status;

          const { error: legacyError } = await supabase
            .from("show_score_publication_states")
            .upsert(legacyRow);

          if (legacyError) throw legacyError;
        } catch (legacyError) {
          console.error("Erreur sauvegarde publication Supabase:", legacyError);
        }
      } else {
        console.error("Erreur sauvegarde publication Supabase:", error);
      }
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

function isSameArena(firstArena, secondArena) {
  return isSameScheduleArena(firstArena, secondArena);
}

function getLocalShowLiveSchedule(showId) {
  const days = getDaysByShowId(showId);
  const dayIds = new Set(days.map((day) => day.id));
  const classes = getAllClasses().filter((classItem) => classItem.showId === showId && !classItem.isEventBlock);
  const paidWarmups = loadPaidWarmups().filter(
    (warmup) => warmup.showId === showId || dayIds.has(warmup.dayId)
  );

  return buildLiveScheduleItems({ classes, paidWarmups, days });
}

async function getRemoteShowLiveSchedule(supabase, showId) {
  const classesQuery = supabase
    .from("classes")
    .select(
      "id, show_id, show_day_id, name, arena, sort_order, schedule_start_mode, scheduled_time, is_event_block"
    )
    .eq("show_id", showId)
    .eq("is_event_block", false);

  const [classesResult, daysResult, paidWarmupsResult] = await Promise.all([
    classesQuery,
    supabase
      .from("show_days")
      .select("id, day_date, sort_order")
      .eq("show_id", showId),
    supabase.from("show_score_paid_warmups").select("*").eq("show_id", showId),
  ]);

  let resolvedClassesResult = classesResult;
  if (classesResult.error && isEventBlockColumnMissingError(classesResult.error)) {
    resolvedClassesResult = await supabase
      .from("classes")
      .select(
        "id, show_id, show_day_id, name, arena, sort_order, schedule_start_mode, scheduled_time"
      )
      .eq("show_id", showId);
  }

  if (resolvedClassesResult.error) throw resolvedClassesResult.error;
  if (daysResult.error) throw daysResult.error;
  if (paidWarmupsResult.error) throw paidWarmupsResult.error;

  return buildLiveScheduleItems({
    classes: Array.isArray(resolvedClassesResult.data)
      ? resolvedClassesResult.data
          .filter((row) => row?.is_event_block !== true)
          .map((row) => ({
          ...row,
          dayId: row.show_day_id,
          scheduleStartTime: row.scheduled_time || "",
        }))
      : [],
    paidWarmups: Array.isArray(paidWarmupsResult.data)
      ? paidWarmupsResult.data.map((row) => ({
          id: row.id,
          associationId: row.organization_id,
          showId: row.show_id,
          dayId: row.show_day_id,
          name: row.name || "",
          arena: row.arena || "",
          isPublicLive: Boolean(row.is_public_live),
          activeEntryId: row.active_entry_id || null,
          activeStartedAt: row.active_started_at || null,
          entries: Array.isArray(row.entries) ? row.entries : [],
          sortOrder: row.sort_order || 1,
        }))
      : [],
    days: Array.isArray(daysResult.data)
      ? daysResult.data.map((row) => ({
          ...row,
          date: row.day_date || "",
        }))
      : [],
  });
}

function findNextArenaLiveItem({
  scheduleItems,
  completedType,
  completedItemId,
  arena,
}) {
  const currentItem = findScheduleItem(
    scheduleItems,
    completedType,
    completedItemId
  );

  if (!currentItem) return null;

  return findNextScheduleItemInArena(
    scheduleItems,
    currentItem,
    arena || currentItem.effectiveArena
  );
}

async function findPendingPaidWarmupBeforeClassRepository({
  showId,
  arena,
  classId,
}) {
  const localScheduleItems = getLocalShowLiveSchedule(showId);
  const localClassItem = findScheduleItem(
    localScheduleItems,
    LIVE_SCHEDULE_ITEM_TYPES.CLASS,
    classId
  );
  const localPendingWarmup = localClassItem
    ? findFirstPendingPaidWarmupBeforeItem(localScheduleItems, {
        ...localClassItem,
        effectiveArena: arena || localClassItem.effectiveArena,
      })
    : null;

  if (localPendingWarmup) {
    return localPendingWarmup;
  }

  const supabase = getSupabaseClient();

  if (!supabase) return null;

  try {
    const remoteScheduleItems = await getRemoteShowLiveSchedule(supabase, showId);
    const remoteClassItem = findScheduleItem(
      remoteScheduleItems,
      LIVE_SCHEDULE_ITEM_TYPES.CLASS,
      classId
    );

    return remoteClassItem
      ? findFirstPendingPaidWarmupBeforeItem(remoteScheduleItems, {
          ...remoteClassItem,
          effectiveArena: arena || remoteClassItem.effectiveArena,
        })
      : null;
  } catch (error) {
    console.error("Erreur détection paid warmup live Supabase:", error);
    return null;
  }
}

async function savePaidWarmupLiveStateRepository({
  paidWarmupId,
  isPublicLive,
  paidWarmup = null,
}) {
  const normalizedPaidWarmupId = String(paidWarmupId || "");
  if (!normalizedPaidWarmupId) return null;

  const localWarmup = paidWarmup || getPaidWarmupById(normalizedPaidWarmupId);
  const savedLocal = localWarmup
    ? savePaidWarmup({
        ...localWarmup,
        isPublicLive: Boolean(isPublicLive),
      })
    : null;
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("show_score_paid_warmups")
        .update({ is_public_live: Boolean(isPublicLive) })
        .eq("id", normalizedPaidWarmupId);

      if (error) throw error;
    } catch (error) {
      console.error("Erreur sauvegarde live paid warmup Supabase:", error);
    }
  }

  return savedLocal || { id: normalizedPaidWarmupId, isPublicLive };
}

export async function hideOtherArenaLiveClassesRepository({
  showId,
  arena,
  classId,
}) {
  const normalizedShowId = String(showId || "");
  const normalizedClassId = String(classId || "");

  if (!normalizedShowId) {
    return;
  }

  const localClassIds = getAllClasses()
    .filter(
      (classItem) =>
        classItem.showId === normalizedShowId &&
        isSameArena(classItem.arena, arena)
    )
    .map((classItem) => classItem.id)
    .filter((id) => id && (!normalizedClassId || id !== normalizedClassId));

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
    const remoteScheduleItems = await getRemoteShowLiveSchedule(
      supabase,
      normalizedShowId
    );

    const remoteClassIds = remoteScheduleItems
      .filter(
        (item) =>
          item.type === LIVE_SCHEDULE_ITEM_TYPES.CLASS &&
          isSameArena(item.effectiveArena, arena)
      )
      .map((item) => item.itemId)
      .filter((id) => id && (!normalizedClassId || id !== normalizedClassId));

    if (remoteClassIds.length === 0) return;

    const { error: updateError } = await supabase
      .from("show_score_publication_states")
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

export async function hideOtherArenaLivePaidWarmupsRepository({
  showId,
  arena,
  paidWarmupId,
}) {
  const normalizedShowId = String(showId || "");
  const normalizedPaidWarmupId = String(paidWarmupId || "");

  if (!normalizedShowId) {
    return;
  }

  const localWarmupIds = getLocalShowLiveSchedule(normalizedShowId)
    .filter(
      (item) =>
        item.type === LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP &&
        isSameArena(item.effectiveArena, arena)
    )
    .map((item) => item.itemId)
    .filter(
      (id) => id && (!normalizedPaidWarmupId || id !== normalizedPaidWarmupId)
    );

  localWarmupIds.forEach((otherWarmupId) => {
    const currentWarmup = getPaidWarmupById(otherWarmupId);

    if (!currentWarmup?.isPublicLive) return;

    savePaidWarmup({
      ...currentWarmup,
      isPublicLive: false,
    });
  });

  const supabase = getSupabaseClient();

  if (!supabase) {
    return;
  }

  try {
    const remoteScheduleItems = await getRemoteShowLiveSchedule(
      supabase,
      normalizedShowId
    );
    const remoteWarmupIds = remoteScheduleItems
      .filter(
        (item) =>
          item.type === LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP &&
          isSameArena(item.effectiveArena, arena)
      )
      .map((item) => item.itemId)
      .filter(
        (id) => id && (!normalizedPaidWarmupId || id !== normalizedPaidWarmupId)
      );

    if (remoteWarmupIds.length === 0) return;

    const { error } = await supabase
      .from("show_score_paid_warmups")
      .update({ is_public_live: false })
      .in("id", remoteWarmupIds);

    if (error) throw error;
  } catch (error) {
    console.error("Erreur masquage des autres paid warmups Supabase:", error);
  }
}

export async function saveArenaCurrentLiveClassRepository({
  showId,
  arena,
  classId,
  status,
}) {
  const localScheduleItem = findScheduleItem(
    getLocalShowLiveSchedule(showId),
    LIVE_SCHEDULE_ITEM_TYPES.CLASS,
    classId
  );
  const effectiveArena = arena || localScheduleItem?.effectiveArena || "";
  const pendingWarmup = await findPendingPaidWarmupBeforeClassRepository({
    showId,
    arena: effectiveArena,
    classId,
  });

  if (pendingWarmup) {
    await saveArenaCurrentLivePaidWarmupRepository({
      showId,
      arena: pendingWarmup.effectiveArena || effectiveArena,
      paidWarmupId: pendingWarmup.itemId,
    });

    return savePublicationStateRepository(classId, {
      status: PUBLICATION_STATUSES.HIDDEN,
      publishedAt: null,
      publishedBy: null,
    });
  }

  await hideOtherArenaLivePaidWarmupsRepository({
    showId,
    arena: effectiveArena,
  });
  await hideOtherArenaLiveClassesRepository({
    showId,
    arena: effectiveArena,
    classId,
  });

  const classLiveStatus = await getClassActivationStatusRepository({
    classId,
    explicitStatus: status,
    classItem: localScheduleItem?.source || null,
  });

  return savePublicationStateRepository(classId, {
    status: isLivePublicationStatus(classLiveStatus)
      ? classLiveStatus
      : PUBLICATION_STATUSES.HIDDEN,
    publishedAt: null,
    publishedBy: null,
  });
}

export async function saveArenaCurrentLivePaidWarmupRepository({
  showId,
  arena,
  paidWarmupId,
}) {
  const normalizedShowId = String(showId || "");
  const normalizedPaidWarmupId = String(paidWarmupId || "");

  if (!normalizedShowId || !normalizedPaidWarmupId) {
    return null;
  }

  const scheduleItem = findScheduleItem(
    getLocalShowLiveSchedule(normalizedShowId),
    LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
    normalizedPaidWarmupId
  );
  const effectiveArena = arena || scheduleItem?.effectiveArena || "";

  await hideOtherArenaLiveClassesRepository({
    showId: normalizedShowId,
    arena: effectiveArena,
  });
  await hideOtherArenaLivePaidWarmupsRepository({
    showId: normalizedShowId,
    arena: effectiveArena,
    paidWarmupId: normalizedPaidWarmupId,
  });

  return savePaidWarmupLiveStateRepository({
    paidWarmupId: normalizedPaidWarmupId,
    isPublicLive: true,
    paidWarmup: scheduleItem?.source || null,
  });
}

export async function advanceArenaLiveClassAfterCompletionRepository({
  showId,
  arena,
  classId,
  nextStatus = null,
}) {
  const normalizedShowId = String(showId || "");
  const normalizedClassId = String(classId || "");

  if (!normalizedShowId || !normalizedClassId) {
    return null;
  }

  const localScheduleItems = getLocalShowLiveSchedule(normalizedShowId);
  const localNextItem = findNextArenaLiveItem({
    scheduleItems: localScheduleItems,
    completedType: LIVE_SCHEDULE_ITEM_TYPES.CLASS,
    completedItemId: normalizedClassId,
    arena,
  });

  if (localNextItem) {
    const activatedItem = await activateArenaLiveItemRepository({
      showId: normalizedShowId,
      arena: localNextItem.effectiveArena || arena,
      scheduleItems: localScheduleItems,
      item: localNextItem,
      status: nextStatus,
    });

    if (activatedItem) return activatedItem;
  }

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const remoteScheduleItems = await getRemoteShowLiveSchedule(
        supabase,
        normalizedShowId
      );
      const remoteNextItem = findNextArenaLiveItem({
        scheduleItems: remoteScheduleItems,
        completedType: LIVE_SCHEDULE_ITEM_TYPES.CLASS,
        completedItemId: normalizedClassId,
        arena,
      });

      if (remoteNextItem) {
        const activatedItem = await activateArenaLiveItemRepository({
          showId: normalizedShowId,
          arena: remoteNextItem.effectiveArena || arena,
          scheduleItems: remoteScheduleItems,
          item: remoteNextItem,
          status: nextStatus,
        });

        if (activatedItem) return activatedItem;
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

export async function advanceArenaLivePaidWarmupAfterCompletionRepository({
  showId,
  arena,
  paidWarmupId,
  nextStatus = null,
}) {
  const normalizedShowId = String(showId || "");
  const normalizedPaidWarmupId = String(paidWarmupId || "");

  if (!normalizedShowId || !normalizedPaidWarmupId) {
    return null;
  }

  const localScheduleItems = getLocalShowLiveSchedule(normalizedShowId);
  const localNextItem = findNextArenaLiveItem({
    scheduleItems: localScheduleItems,
    completedType: LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
    completedItemId: normalizedPaidWarmupId,
    arena,
  });

  await savePaidWarmupLiveStateRepository({
    paidWarmupId: normalizedPaidWarmupId,
    isPublicLive: false,
  });

  if (localNextItem) {
    const activatedItem = await activateArenaLiveItemRepository({
      showId: normalizedShowId,
      arena: localNextItem.effectiveArena || arena,
      scheduleItems: localScheduleItems,
      item: localNextItem,
      status: nextStatus,
    });

    if (activatedItem) return activatedItem;
  }

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const remoteScheduleItems = await getRemoteShowLiveSchedule(
        supabase,
        normalizedShowId
      );
      const remoteNextItem = findNextArenaLiveItem({
        scheduleItems: remoteScheduleItems,
        completedType: LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
        completedItemId: normalizedPaidWarmupId,
        arena,
      });

      if (remoteNextItem) {
        const activatedItem = await activateArenaLiveItemRepository({
          showId: normalizedShowId,
          arena: remoteNextItem.effectiveArena || arena,
          scheduleItems: remoteScheduleItems,
          item: remoteNextItem,
          status: nextStatus,
        });

        if (activatedItem) return activatedItem;
      }
    } catch (error) {
      console.error("Erreur avancement live paid warmup Supabase:", error);
    }
  }

  return null;
}

async function activateArenaLiveItemRepository({
  showId,
  arena,
  scheduleItems,
  item,
  status,
}) {
  let currentItem = item;
  let explicitStatus = status;

  while (currentItem) {
    if (currentItem.type === LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP) {
      return saveArenaCurrentLivePaidWarmupRepository({
        showId,
        arena: currentItem.effectiveArena || arena,
        paidWarmupId: currentItem.itemId,
      });
    }

    if (currentItem.type === LIVE_SCHEDULE_ITEM_TYPES.CLASS) {
      const classLiveStatus = await getClassActivationStatusRepository({
        classId: currentItem.itemId,
        explicitStatus,
        classItem: currentItem.source,
      });

      if (isLivePublicationStatus(classLiveStatus)) {
        return saveArenaCurrentLiveItemRepository({
          showId,
          arena: currentItem.effectiveArena || arena,
          item: currentItem,
          status: classLiveStatus,
        });
      }

      await savePublicationStateRepository(currentItem.itemId, {
        status: PUBLICATION_STATUSES.HIDDEN,
        publishedAt: null,
        publishedBy: null,
      });
    }

    currentItem = findNextScheduleItemInArena(
      scheduleItems,
      currentItem,
      currentItem.effectiveArena || arena
    );
    explicitStatus = null;
  }

  return null;
}

async function getClassActivationStatusRepository({
  classId,
  explicitStatus,
  classItem = null,
}) {
  const normalizedExplicitStatus = normalizePlannedLiveStatus(
    explicitStatus,
    null
  );

  if (normalizedExplicitStatus) {
    return isNoPatternValue(classItem?.pattern) &&
      isLivePublicationStatus(normalizedExplicitStatus)
      ? PUBLICATION_STATUSES.LIVE_NO_SCORE
      : normalizedExplicitStatus;
  }

  const publication = await getPublicationStateRepository(classId);
  const plannedStatus = getPlannedLiveStatus(publication);

  return isNoPatternValue(classItem?.pattern) && isLivePublicationStatus(plannedStatus)
    ? PUBLICATION_STATUSES.LIVE_NO_SCORE
    : plannedStatus;
}

async function saveArenaCurrentLiveItemRepository({
  showId,
  arena,
  item,
  status,
}) {
  if (item?.type === LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP) {
    return saveArenaCurrentLivePaidWarmupRepository({
      showId,
      arena,
      paidWarmupId: item.itemId,
    });
  }

  if (item?.type === LIVE_SCHEDULE_ITEM_TYPES.CLASS) {
    await hideOtherArenaLivePaidWarmupsRepository({ showId, arena });
    await hideOtherArenaLiveClassesRepository({
      showId,
      arena,
      classId: item.itemId,
    });

    return savePublicationStateRepository(item.itemId, {
      status,
      publishedAt: null,
      publishedBy: null,
    });
  }

  return null;
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
        .from("show_score_publication_states")
        .delete()
        .eq("class_id", classId);

      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression publication Supabase:", error);
    }
  }

  deletePublicationState(classId);
}
