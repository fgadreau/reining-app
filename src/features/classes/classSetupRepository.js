import { getSupabaseClient } from "../cloud/supabaseClient";
import { APP_EVENT_TYPES, trackEvent } from "../analytics/analyticsRepository";
import { getClassById } from "./classSelectors";
import { normalizeClassScheduleDetails } from "./classSchedule";
import {
  deleteClassSetup,
  getClassSetup,
  normalizeClassSetup,
  saveClassSetup,
} from "./classSetupStorage";
import { NO_PATTERN_ID, isNoPatternValue } from "../patterns/patternDefinitions";

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function toSetup(row, localSetup = {}) {
  const remoteHasJudges = hasOwn(row, "judges");
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
    scheduleDetails: normalizeClassScheduleDetails(row.schedule_details),
    startedAt: row.started_at || null,
    dragInterval: row.drag_interval || null,
    dragDurationMinutes: row.drag_duration_minutes,
    lockedAt: row.locked_at || null,
    lockedBy: row.locked_by || null,
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
  const row = {
    class_id: classId,
    pattern: normalized.pattern || null,
    runs: normalized.runs,
    is_draw_imported: Boolean(normalized.isDrawImported),
    locked_at: normalized.lockedAt || null,
    locked_by: normalized.lockedBy || null,
    finalized: Boolean(normalized.finalized),
    finalized_at: normalized.finalizedAt || null,
    judge_name: normalized.judgeName || null,
    judge_signature: normalized.judgeSignature || null,
    judge_signed_at: normalized.judgeSignedAt || null,
    final_pdf_file_name: normalized.finalPdfFileName || null,
  };

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

export async function getClassSetupRepository(classId) {
  const localSetup = getClassSetup(classId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localSetup;
  }

  try {
    const { data, error } = await supabase
      .from("class_setups")
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
        .from("class_setups")
        .upsert(toSetupRow(classId, normalized));

      if (error) throw error;
    } catch (error) {
      if (isCustomPatternColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("class_setups")
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
            .from("class_setups")
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
            .from("class_setups")
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
            .from("class_setups")
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

export async function deleteClassSetupRepository(classId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("class_setups")
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
