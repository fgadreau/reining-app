import { getSupabaseClient } from "../cloud/supabaseClient";
import { getClassRecord, saveClassRecord } from "./classRecordStorage";

function toOfficialResult(row) {
  return {
    classId: row.class_id,
    judgeName: row.judge_name || "",
    judgeSignature: row.judge_signature || null,
    finalized: Boolean(row.finalized),
    finalizedAt: row.finalized_at || null,
    judgeSignedAt: row.judge_signed_at || null,
    secretariatValidatedAt: row.secretariat_validated_at || null,
    finalPdfFileName: row.final_pdf_file_name || null,
    customPattern:
      row.custom_pattern && typeof row.custom_pattern === "object"
        ? row.custom_pattern
        : null,
    officialRuns: Array.isArray(row.official_runs) ? row.official_runs : [],
    updatedAt: row.updated_at || null,
  };
}

function toOfficialResultRow(classId, official, options = {}) {
  const includeCustomPattern = options.includeCustomPattern !== false;
  const row = {
    class_id: classId,
    judge_name: official.judgeName || null,
    judge_signature: official.judgeSignature || null,
    finalized: Boolean(official.finalized),
    finalized_at: official.finalizedAt || null,
    judge_signed_at: official.judgeSignedAt || null,
    secretariat_validated_at: official.secretariatValidatedAt || null,
    final_pdf_file_name: official.finalPdfFileName || null,
    official_runs: Array.isArray(official.officialRuns)
      ? official.officialRuns
      : [],
  };

  if (includeCustomPattern) {
    row.custom_pattern = official.customPattern || null;
  }

  return row;
}

function isCustomPatternColumnMissingError(error) {
  return String(error?.message || "").includes("custom_pattern");
}

function getLocalOfficialResult(classId) {
  const record = getClassRecord(classId);
  const official = record?.official || {};

  return {
    classId,
    judgeName: official.judgeName || "",
    judgeSignature: official.judgeSignature || null,
    finalized: Boolean(official.finalized),
    finalizedAt: official.finalizedAt || null,
    judgeSignedAt: official.judgeSignedAt || null,
    secretariatValidatedAt: official.secretariatValidatedAt || null,
    finalPdfFileName: official.finalPdfFileName || null,
    customPattern: official.customPattern || null,
    officialRuns: Array.isArray(official.officialRuns)
      ? official.officialRuns
      : [],
    updatedAt: null,
  };
}

export async function getOfficialResultRepository(classId) {
  const localResult = getLocalOfficialResult(classId);
  const supabase = getSupabaseClient();

  if (!supabase || !classId) {
    return localResult;
  }

  try {
    const { data, error } = await supabase
      .from("official_results")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localResult;

    const result = toOfficialResult(data);
    saveClassRecord(classId, {
      official: {
        judgeName: result.judgeName,
        judgeSignature: result.judgeSignature,
        finalized: result.finalized,
        finalizedAt: result.finalizedAt,
        judgeSignedAt: result.judgeSignedAt,
        secretariatValidatedAt: result.secretariatValidatedAt,
        finalPdfFileName: result.finalPdfFileName,
        customPattern: result.customPattern,
        officialRuns: result.officialRuns,
      },
    });

    return result;
  } catch (error) {
    console.error("Erreur chargement résultat officiel Supabase:", error);
    return localResult;
  }
}

export async function saveOfficialResultRepository(classId, updates) {
  const current = getLocalOfficialResult(classId);
  const next = {
    ...current,
    ...updates,
    classId,
    officialRuns: Array.isArray(updates?.officialRuns)
      ? updates.officialRuns
      : current.officialRuns,
  };

  saveClassRecord(classId, {
    official: {
      judgeName: next.judgeName,
      judgeSignature: next.judgeSignature,
      finalized: next.finalized,
      finalizedAt: next.finalizedAt,
      judgeSignedAt: next.judgeSignedAt,
      secretariatValidatedAt: next.secretariatValidatedAt,
      finalPdfFileName: next.finalPdfFileName,
      customPattern: next.customPattern,
      officialRuns: next.officialRuns,
    },
  });

  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("official_results")
        .upsert(toOfficialResultRow(classId, next));

      if (error) throw error;
    } catch (error) {
      if (isCustomPatternColumnMissingError(error)) {
        try {
          const { error: legacyError } = await supabase
            .from("official_results")
            .upsert(
              toOfficialResultRow(classId, next, { includeCustomPattern: false })
            );

          if (legacyError) throw legacyError;
          return next;
        } catch (legacyError) {
          console.error("Erreur sauvegarde résultat officiel Supabase:", legacyError);
          return next;
        }
      }

      console.error("Erreur sauvegarde résultat officiel Supabase:", error);
    }
  }

  return next;
}

export async function validateOfficialResultRepository({
  classData,
  validatedAt = new Date().toISOString(),
}) {
  const classId = classData?.classItem?.id;
  const official = classData?.official || {};

  if (!classId) {
    throw new Error("Classe introuvable.");
  }

  if (!official.isFinalized || !official.judgeSignature) {
    throw new Error("La classe doit être signée par le juge avant validation.");
  }

  return saveOfficialResultRepository(classId, {
    judgeName: official.judgeName,
    judgeSignature: official.judgeSignature,
    finalized: true,
    finalizedAt: official.finalizedAt || validatedAt,
    judgeSignedAt: official.judgeSignedAt || official.finalizedAt || validatedAt,
    secretariatValidatedAt: validatedAt,
    finalPdfFileName: official.finalPdfFileName || null,
    customPattern:
      classData?.setup?.customPattern ||
      classData?.classItem?.customPattern ||
      official.customPattern ||
      null,
    officialRuns: Array.isArray(classData?.scoringRuns)
      ? classData.scoringRuns
      : [],
  });
}
