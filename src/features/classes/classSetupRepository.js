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

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function toSetup(row, localSetup = {}) {
  const remoteHasJudges = hasOwn(row, "judges");
  const remoteScheduleDetails = normalizeClassScheduleDetails(
    row.schedule_details
  );
  const localScheduleDetails = normalizeClassScheduleDetails(
    localSetup?.scheduleDetails
  );
  const fallbackJudges = Array.isArray(localSetup?.judges)
    ? localSetup.judges
    : [];

  return normalizeClassSetup({
    pattern: row.pattern || "",
    customPattern:
      row.custom_pattern && typeof row.custom_pattern === "object"
        ? row.custom_pattern
        : null,
    runs: Array.isArray(row.runs) ? row.runs : [],
    isDrawImported: Boolean(row.is_draw_imported),
    judges:
      remoteHasJudges && Array.isArray(row.judges)
        ? row.judges
        : fallbackJudges,
    blockClasses: Array.isArray(row.block_classes)
      ? row.block_classes
      : localSetup?.blockClasses || [],
    scheduleDetails: hasClassScheduleDetails(remoteScheduleDetails)
      ? remoteScheduleDetails
      : localScheduleDetails,
    startedAt: row.started_at || null,
    dragInterval: row.drag_interval || null,
    dragDurationMinutes: row.drag_duration_minutes,
    lockedAt: row.locked_at || null,
    lockedBy: row.locked_by_label || null,
    finalized: Boolean(row.finalized),
    finalizedAt: row.finalized_at || null,
    judgeName: row.judge_name || localSetup?.judgeName || "",
    judgeSignature: row.judge_signature || null,
    judgeSignedAt: row.judge_signed_at || null,
    finalPdfFileName: row.final_pdf_file_name || null,
    updatedAt: row.updated_at || null,
  });
}

function toSetupRow(classId, setup, options = {}) {
  const normalized = normalizeClassSetup(setup);
  const includePlanning = options.includePlanning !== false;
  const includeCustomPattern = options.includeCustomPattern !== false;
  const includeJudges = options.includeJudges !== false;
  const includeScheduleDetails = options.includeScheduleDetails !== false;
  const includeBlockClasses = options.includeBlockClasses !== false;
  const includeFinalPdf = options.includeFinalPdf !== false;
  const row = {
    class_id: classId,
    pattern: normalized.pattern || null,
    runs: normalized.runs,
    is_draw_imported: Boolean(normalized.isDrawImported),
    locked_at: normalized.lockedAt || null,
    locked_by_label: normalized.lockedBy || null,
    finalized: Boolean(normalized.finalized),
    finalized_at: normalized.finalizedAt || null,
    judge_name: normalized.judgeName || null,
    judge_signature: normalized.judgeSignature || null,
    judge_signed_at: normalized.judgeSignedAt || null,
  };

  if (includeFinalPdf) {
    row.final_pdf_file_name = normalized.finalPdfFileName || null;
  }

  if (includePlanning) {
    row.started_at = normalized.startedAt || null;
    row.drag_interval = normalized.dragInterval || null;
    row.drag_duration_minutes = normalized.dragDurationMinutes;
  }

  if (includeCustomPattern) {
    row.custom_pattern = normalized.customPattern || null;
  }

  if (includeJudges) {
    row.judges = normalized.judges || [];
  }

  if (includeScheduleDetails) {
    row.schedule_details = normalizeClassScheduleDetails(
      normalized.scheduleDetails
    );
  }

  if (includeBlockClasses) {
    row.block_classes = normalized.blockClasses || [];
  }

  return row;
}

function isPlanningColumnMissingError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("started_at") ||
    message.includes("drag_interval") ||
    message.includes("drag_duration_minutes")
  );
}

function isCustomPatternColumnMissingError(error) {
  return String(error?.message || "").includes("custom_pattern");
}

function isJudgesColumnMissingError(error) {
  return String(error?.message || "").includes("judges");
}

function isScheduleDetailsColumnMissingError(error) {
  return String(error?.message || "").includes("schedule_details");
}

function isBlockClassesColumnMissingError(error) {
  return String(error?.message || "").includes("block_classes");
}

function isFinalPdfColumnMissingError(error) {
  return String(error?.message || "").includes("final_pdf_file_name");
}

export async function getClassSetupRepository(classId) {
  const localSetup = getClassSetup(classId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localSetup;
  }

  try {
    const { data, error } = await supabase
      .from("show_score_class_setups")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localSetup;

    const setup = toSetup(data, localSetup);
    saveClassSetup(classId, setup);
    return setup;
  } catch (error) {
    console.error("Erreur chargement setup Supabase:", error);
    return localSetup;
  }
}

export async function saveClassSetupRepository(classId, setup) {
  const previousSetup = getClassSetup(classId);
  const normalized = normalizeClassSetup(setup);
  const supabase = getSupabaseClient();

  saveClassSetup(classId, normalized);

  if (supabase) {
    try {
      const { error } = await supabase
        .from("show_score_class_setups")
        .upsert(toSetupRow(classId, normalized));

      if (error) throw error;
    } catch (error) {
      if (isCustomPatternColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("show_score_class_setups")
            .upsert(
              toSetupRow(classId, normalized, { includeCustomPattern: false })
            );

          if (legacyError) throw legacyError;
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        }
      }

      if (isJudgesColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("show_score_class_setups")
            .upsert(toSetupRow(classId, normalized, { includeJudges: false }));

          if (legacyError) throw legacyError;
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        }
      }

      if (isPlanningColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("show_score_class_setups")
            .upsert(toSetupRow(classId, normalized, { includePlanning: false }));

          if (legacyError) throw legacyError;
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        }
      }

      if (isScheduleDetailsColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("show_score_class_setups")
            .upsert(
              toSetupRow(classId, normalized, { includeScheduleDetails: false })
            );

          if (legacyError) throw legacyError;
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        }
      }

      if (isBlockClassesColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("show_score_class_setups")
            .upsert(
              toSetupRow(classId, normalized, { includeBlockClasses: false })
            );

          if (legacyError) throw legacyError;
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        }
      }

      if (isFinalPdfColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("show_score_class_setups")
            .upsert(toSetupRow(classId, normalized, { includeFinalPdf: false }));

          if (legacyError) throw legacyError;
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          trackClassSetupReadyEvent(classId, previousSetup, normalized);
          return normalized;
        }
      }

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
        const savedSetup = toSetup(data, nextLocalSetup);
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
