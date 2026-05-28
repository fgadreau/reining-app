import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  deleteClassSetup,
  getClassSetup,
  normalizeClassSetup,
  saveClassSetup,
} from "./classSetupStorage";

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
  });
}

function toSetupRow(classId, setup, options = {}) {
  const normalized = normalizeClassSetup(setup);
  const includePlanning = options.includePlanning !== false;
  const includeCustomPattern = options.includeCustomPattern !== false;
  const includeJudges = options.includeJudges !== false;
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
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          return normalized;
        }
      }

      if (isJudgesColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("class_setups")
            .upsert(toSetupRow(classId, normalized, { includeJudges: false }));

          if (legacyError) throw legacyError;
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          return normalized;
        }
      }

      if (isPlanningColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("class_setups")
            .upsert(toSetupRow(classId, normalized, { includePlanning: false }));

          if (legacyError) throw legacyError;
          return normalized;
        } catch (legacyError) {
          console.error("Erreur sauvegarde setup Supabase:", legacyError);
          return normalized;
        }
      }

      console.error("Erreur sauvegarde setup Supabase:", error);
    }
  }

  return normalized;
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
