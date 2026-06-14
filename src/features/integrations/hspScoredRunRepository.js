import { getSupabaseClient } from "../cloud/supabaseClient";
import { getRunStatus, parseScoreTotalValue } from "../../utils/scoring";

const HSP_SCORED_RUNS_TABLE = "scored_runs";
const VALID_HSP_RUN_STATUSES = new Set([
  "scored",
  "scratch",
  "no_score",
  "disqualified",
]);

function cleanText(value) {
  return String(value ?? "").trim();
}

function getFirstText(source, keys) {
  for (const key of keys) {
    const value = cleanText(source?.[key]);
    if (value) return value;
  }

  return "";
}

function normalizeScoreStatusText(value) {
  return cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function getHspRunStatus(run = {}) {
  const penalties = Array.isArray(run.penalties) ? run.penalties : [];
  const specialStatus = getRunStatus({ ...run, penalties });

  if (specialStatus === "SCR") return "scratch";
  if (specialStatus === "NS") return "no_score";
  if (specialStatus === "DQ") return "disqualified";

  const statusText = normalizeScoreStatusText(run.status);
  const scoreText = normalizeScoreStatusText(run.scoreTotal);

  if (["scratch", "scr", "scratched"].includes(statusText)) return "scratch";
  if (["scratch", "scr", "scratched"].includes(scoreText)) return "scratch";
  if (["no_score", "ns", "noscore"].includes(statusText)) return "no_score";
  if (["no_score", "ns", "noscore"].includes(scoreText)) return "no_score";
  if (["dq", "disqualified", "disqualification"].includes(statusText)) {
    return "disqualified";
  }
  if (["dq", "disqualified", "disqualification"].includes(scoreText)) {
    return "disqualified";
  }

  return parseScoreTotalValue(run.scoreTotal) !== null ? "scored" : "";
}

function getFinalScore(status, run = {}) {
  if (status !== "scored") return null;

  const score = parseScoreTotalValue(run.scoreTotal);
  return Number.isFinite(score) ? score : null;
}

function getShowId({ classItem = {}, setup = {} } = {}) {
  return (
    getFirstText(setup.hspSource, ["showId", "show_id"]) ||
    getFirstText(classItem, ["showId", "show_id"])
  );
}

function toScoredRunRow(run, context = {}) {
  const runId = getFirstText(run, ["runId", "run_id"]);
  const showId = getShowId(context);
  const status = getHspRunStatus(run);

  if (!runId || !showId || !VALID_HSP_RUN_STATUSES.has(status)) {
    return null;
  }

  return {
    run_id: runId,
    show_id: showId,
    back_number: getFirstText(run, ["backNumber", "back_number"]) || null,
    rider_id:
      getFirstText(run, ["riderId", "rider_id", "riderContactId", "rider_contact_id"]) ||
      null,
    horse_id: getFirstText(run, ["horseId", "horse_id"]) || null,
    owner_id:
      getFirstText(run, ["ownerId", "owner_id", "ownerContactId", "owner_contact_id"]) ||
      null,
    scored_at:
      getFirstText(run, ["completedAt", "completed_at", "updatedAt", "updated_at"]) ||
      context.scoredAt ||
      new Date().toISOString(),
    status,
    final_score: getFinalScore(status, run),
  };
}

function dedupeRowsByRunId(rows) {
  return Array.from(
    new Map(rows.map((row) => [row.run_id, row])).values()
  );
}

export function buildHspScoredRunRows({
  classItem = {},
  setup = {},
  runs = [],
  scoredAt = new Date().toISOString(),
} = {}) {
  return dedupeRowsByRunId(
    (Array.isArray(runs) ? runs : [])
      .map((run) => toScoredRunRow(run, { classItem, setup, scoredAt }))
      .filter(Boolean)
  );
}

export async function syncHspScoredRunsBatchRepository(options = {}) {
  const rows = buildHspScoredRunRows(options);
  const supabase = getSupabaseClient();

  if (!supabase || rows.length === 0) {
    return {
      ok: true,
      syncedCount: 0,
      skippedCount: rows.length,
      error: null,
    };
  }

  try {
    const { error } = await supabase
      .from(HSP_SCORED_RUNS_TABLE)
      .upsert(rows, { onConflict: "run_id" });

    if (error) throw error;

    return {
      ok: true,
      syncedCount: rows.length,
      skippedCount: 0,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      syncedCount: 0,
      skippedCount: rows.length,
      error: error?.message || "Erreur sync résultats HSP",
    };
  }
}
