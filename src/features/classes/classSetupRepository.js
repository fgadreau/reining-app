import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { getClassById } from "./classSelectors";
import {
  hasClassScheduleDetails,
  normalizeClassScheduleDetails,
  normalizeClassScheduleStart,
} from "./classSchedule";
import {
  deleteClassSetup,
  getClassSetup,
  normalizeClassSetup,
  saveClassSetup,
} from "./classSetupStorage";
import { updateClass } from "./classStorage";
import { NO_PATTERN_ID, isNoPatternValue } from "../patterns/patternDefinitions";
import { normalizeLiveDisplayMode } from "../live/liveDataSource";

const LIVE_DISPLAY_PENDING_STORAGE_KEY =
  "showscore_live_display_mode_pending_v1";
const LIVE_SOURCE_PENDING_STORAGE_KEY =
  "showscore_live_data_source_pending_v1";

function loadPendingValues(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function savePendingValues(storageKey, pending) {
  localStorage.setItem(storageKey, JSON.stringify(pending || {}));
}

function getPendingLiveDisplayMode(classId) {
  return loadPendingValues(LIVE_DISPLAY_PENDING_STORAGE_KEY)[classId] || null;
}

function setPendingLiveDisplayMode(classId, mode) {
  const pending = loadPendingValues(LIVE_DISPLAY_PENDING_STORAGE_KEY);
  pending[classId] = normalizeLiveDisplayMode(mode);
  savePendingValues(LIVE_DISPLAY_PENDING_STORAGE_KEY, pending);
}

function clearPendingLiveDisplayMode(classId) {
  const pending = loadPendingValues(LIVE_DISPLAY_PENDING_STORAGE_KEY);
  delete pending[classId];
  savePendingValues(LIVE_DISPLAY_PENDING_STORAGE_KEY, pending);
}

function getPendingLiveDataSource(classId) {
  return loadPendingValues(LIVE_SOURCE_PENDING_STORAGE_KEY)[classId] || null;
}

function setPendingLiveDataSource(classId, source) {
  const pending = loadPendingValues(LIVE_SOURCE_PENDING_STORAGE_KEY);
  pending[classId] = source;
  savePendingValues(LIVE_SOURCE_PENDING_STORAGE_KEY, pending);
}

function clearPendingLiveDataSource(classId) {
  const pending = loadPendingValues(LIVE_SOURCE_PENDING_STORAGE_KEY);
  delete pending[classId];
  savePendingValues(LIVE_SOURCE_PENDING_STORAGE_KEY, pending);
}

async function pushLiveDisplayMode(classId, liveDisplayMode) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.rpc("set_show_score_live_display_mode", {
    target_class_id: classId,
    target_mode: liveDisplayMode,
  });
  if (error) throw error;
  return true;
}

async function pushLiveDataSource(classId, liveDataSource) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.rpc("set_show_score_live_data_source", {
    target_class_id: classId,
    target_source: liveDataSource,
  });
  if (error) throw error;
  return true;
}

function toSetup(row) {
  const remoteScheduleDetails = normalizeClassScheduleDetails(
    row.schedule_details
  );

  return normalizeClassSetup({
    pattern: row.pattern || "",
    customPattern:
      row.custom_pattern && typeof row.custom_pattern === "object"
        ? row.custom_pattern
        : null,
    runs: Array.isArray(row.runs) ? row.runs : [],
    isDrawImported: Boolean(row.is_draw_imported),
    judges: Array.isArray(row.judges) ? row.judges : [],
    blockClasses: Array.isArray(row.block_classes) ? row.block_classes : [],
    scheduleDetails: hasClassScheduleDetails(remoteScheduleDetails)
      ? remoteScheduleDetails
      : {},
    startedAt: row.started_at || null,
    dragInterval: row.drag_interval || null,
    dragDurationMinutes: row.drag_duration_minutes,
    setApprovalMode: row.set_approval_mode,
    setApprovals: Array.isArray(row.set_approvals) ? row.set_approvals : [],
    liveDataSource: row.live_data_source,
    liveDisplayMode: row.live_display_mode,
    qualifiedRiderCount: row.qualified_rider_count,
    liveSourceChangedAt: row.live_source_changed_at || null,
    liveSourceChangedBy: row.live_source_changed_by || null,
    lockedAt: row.locked_at || null,
    lockedBy: row.locked_by_label || null,
    finalized: Boolean(row.finalized),
    finalizedAt: row.finalized_at || null,
    judgeName: row.judge_name || "",
    judgeSignature: row.judge_signature || null,
    judgeSignedAt: row.judge_signed_at || null,
    finalPdfFileName: row.final_pdf_file_name || null,
    updatedAt: row.updated_at || null,
  });
}

function toSetupRow(classId, setup) {
  const normalized = normalizeClassSetup(setup);
  const row = {
    class_id: classId,
    pattern: normalized.pattern || null,
    runs: normalized.runs,
    is_draw_imported: Boolean(normalized.isDrawImported),
    started_at: normalized.startedAt || null,
    drag_interval: normalized.dragInterval || null,
    drag_duration_minutes: normalized.dragDurationMinutes,
    set_approval_mode: normalized.setApprovalMode,
    set_approvals: normalized.setApprovals,
    live_data_source: normalized.liveDataSource,
    live_display_mode: normalized.liveDisplayMode,
    qualified_rider_count: normalized.qualifiedRiderCount,
    custom_pattern: normalized.customPattern || null,
    judges: normalized.judges || [],
    schedule_details: normalizeClassScheduleDetails(normalized.scheduleDetails),
    block_classes: normalized.blockClasses || [],
    locked_at: normalized.lockedAt || null,
    locked_by_label: normalized.lockedBy || null,
    finalized: Boolean(normalized.finalized),
    finalized_at: normalized.finalizedAt || null,
    judge_name: normalized.judgeName || null,
    judge_signature: normalized.judgeSignature || null,
    judge_signed_at: normalized.judgeSignedAt || null,
  };

  row.final_pdf_file_name = normalized.finalPdfFileName || null;

  return row;
}

export async function getClassSetupRepository(classId) {
  const localSetup = getClassSetup(classId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localSetup;
  }

  const pendingLiveDataSource = getPendingLiveDataSource(classId);
  if (pendingLiveDataSource) {
    try {
      await pushLiveDataSource(classId, pendingLiveDataSource);
      clearPendingLiveDataSource(classId);
    } catch (error) {
      console.error("Erreur synchronisation source live Supabase:", error);
      return localSetup;
    }
  }

  const pendingLiveDisplayMode = getPendingLiveDisplayMode(classId);
  if (pendingLiveDisplayMode) {
    try {
      await pushLiveDisplayMode(classId, pendingLiveDisplayMode);
      clearPendingLiveDisplayMode(classId);
    } catch (error) {
      console.error(
        "Erreur synchronisation affichage live minimal Supabase:",
        error
      );
      return localSetup;
    }
  }

  try {
    const { data, error } = await supabase
      .from("show_score_class_setups")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localSetup;

    const setup = toSetup(data);
    saveClassSetup(classId, setup);
    return setup;
  } catch (error) {
    console.error("Erreur chargement setup Supabase:", error);
    return localSetup;
  }
}

export async function saveClassLiveDisplayModeRepository(classId, mode) {
  const liveDisplayMode = normalizeLiveDisplayMode(mode);
  const currentSetup = getClassSetup(classId);
  saveClassSetup(classId, {
    ...currentSetup,
    liveDisplayMode,
  });
  setPendingLiveDisplayMode(classId, liveDisplayMode);

  const supabase = getSupabaseClient();
  if (!supabase) return liveDisplayMode;

  try {
    await pushLiveDisplayMode(classId, liveDisplayMode);
    clearPendingLiveDisplayMode(classId);
  } catch (error) {
    console.error("Erreur sauvegarde affichage live minimal Supabase:", error);
  }

  return liveDisplayMode;
}

export async function saveClassSetupRepository(classId, setup) {
  const previousSetup = getClassSetup(classId);
  const normalized = normalizeClassSetup({
    ...setup,
    liveDisplayMode:
      previousSetup?.liveDisplayMode ?? setup?.liveDisplayMode,
  });
  const supabase = getSupabaseClient();

  saveClassSetup(classId, normalized);
  if (previousSetup?.liveDataSource !== normalized.liveDataSource) {
    setPendingLiveDataSource(classId, normalized.liveDataSource);
  }

  if (supabase) {
    try {
      const { error } = await supabase
        .from("show_score_class_setups")
        .upsert(toSetupRow(classId, normalized));

      if (error) throw error;
      clearPendingLiveDataSource(classId);
      clearPendingLiveDisplayMode(classId);
    } catch (error) {
      console.error("Erreur sauvegarde setup Supabase:", error);
    }
  }

  trackClassSetupReadyEvent(classId, previousSetup, normalized);
  return normalized;
}

export async function saveClassScheduleDetailsRepository(classId, details) {
  const currentSetup = getClassSetup(classId);
  const normalizedDetails = normalizeClassScheduleDetails(details);
  const nextLocalSetup = {
    ...currentSetup,
    pattern: currentSetup.pattern || NO_PATTERN_ID,
    scheduleDetails: normalizedDetails,
    updatedAt: new Date().toISOString(),
  };
  const supabase = getSupabaseClient();

  saveClassSetup(classId, nextLocalSetup);
  await syncClassScheduleStartFields(classId, normalizedDetails);

  if (supabase) {
    try {
      const { data, error } = await supabase.rpc(
        "update_class_schedule_details",
        {
          target_class_id: classId,
          next_schedule_details: normalizedDetails,
        }
      );

      if (error) throw error;

      if (data) {
        const savedSetup = toSetup(data);
        saveClassSetup(classId, savedSetup);
        return savedSetup;
      }
    } catch (error) {
      console.error("Erreur sauvegarde détails horaire Supabase:", error);
      return saveClassSetupRepository(classId, nextLocalSetup);
    }
  }

  return nextLocalSetup;
}

async function syncClassScheduleStartFields(classId, details) {
  const classItem = getClassById(classId);

  if (!classItem) return;

  const scheduleStart = normalizeClassScheduleStart(details);

  if (
    String(classItem.scheduleStartMode || "") ===
      String(scheduleStart.startMode || "") &&
    String(classItem.scheduleStartTime || "") === String(scheduleStart.startTime || "")
  ) {
    return;
  }

  updateClass(classId, {
    scheduleStartMode: scheduleStart.startMode,
    scheduleStartTime: scheduleStart.startTime,
  });

  const supabase = getSupabaseClient();

  if (!supabase) return;

  try {
    const { error } = await supabase
      .from("classes")
      .update({
        schedule_start_mode: scheduleStart.startMode,
        scheduled_time: scheduleStart.startTime || null,
      })
      .eq("id", classId);

    if (error) throw error;
  } catch (error) {
    console.error("Erreur synchronisation heure du bloc Supabase:", error);
  }
}

export async function deleteClassSetupRepository(classId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("show_score_class_setups")
        .delete()
        .eq("class_id", classId);

      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression setup Supabase:", error);
    }
  }

  deleteClassSetup(classId);
}

function isSetupReady(setup) {
  if (isNoPatternValue(setup?.pattern)) {
    return true;
  }

  return Boolean(
    setup?.pattern &&
      Array.isArray(setup?.runs) &&
      setup.runs.length > 0
  );
}

function trackClassSetupReadyEvent(classId, previousSetup, nextSetup) {
  if (isSetupReady(previousSetup) || !isSetupReady(nextSetup)) {
    return;
  }

  const classItem = getClassById(classId);

  trackEvent({
    eventName: "class_setup_ready",
    eventType: APP_EVENT_TYPES.AUDIT,
    associationId: classItem?.associationId,
    showId: classItem?.showId,
    dayId: classItem?.dayId,
    classId,
    metadata: {
      pattern: nextSetup.pattern,
      runCount: nextSetup.runs.length,
      judgeCount: Array.isArray(nextSetup.judges) ? nextSetup.judges.length : 1,
    },
  });
}
