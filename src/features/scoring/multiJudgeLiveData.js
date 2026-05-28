import { isScoredRunComplete } from "../../utils/scoring";
import {
  getJudgeDisplayName,
  normalizeClassJudges,
} from "../classes/classJudges";
import {
  buildCombinedJudgeScore,
  classUsesCombinedJudgeScore,
} from "./multiJudgeScoring";

export function hasMultiJudgeLiveSetup({ judges, judgeSessions }) {
  return (
    normalizeClassJudges({ judges }).length > 1 ||
    (Array.isArray(judgeSessions) && judgeSessions.length > 1)
  );
}

export function getMultiJudgeLiveUpdatedAt(judgeSessions = []) {
  const timestamps = (Array.isArray(judgeSessions) ? judgeSessions : [])
    .map((session) => session?.updatedAt || session?.claimedAt || null)
    .filter(Boolean)
    .sort();

  return timestamps[timestamps.length - 1] || null;
}

export function buildMultiJudgeLiveRuns({
  setupRuns = [],
  judgeSessions = [],
  judges = [],
  pattern = "",
  customPattern = null,
  headers = [],
}) {
  const judgeRows = buildJudgeRows(judges, judgeSessions);
  const sourceRuns = setupRuns.length
    ? setupRuns
    : buildBaseRunsFromJudgeSessions(judgeRows);
  const activeDraw = getActiveDraw(judgeRows);
  const canCombineScores = classUsesCombinedJudgeScore(pattern, customPattern);
  const manoeuvreCount = headers.length;

  return sourceRuns.map((setupRun, index) => {
    const draw = setupRun?.draw ?? setupRun?.order ?? index + 1;
    const judgeRuns = judgeRows
      .map((row) => {
        const run = findMatchingRun(row.session?.runs, setupRun, index);
        if (!run) return null;

        return {
          ...run,
          judgeId: row.judge.id,
          judgeName: row.session?.judgeName || row.displayName,
          judgeOrder: row.judge.order || row.index + 1,
        };
      })
      .filter(Boolean);
    const completeJudgeRuns = judgeRuns.filter((run) =>
      isCompleteJudgeRun(run, manoeuvreCount)
    );
    const allJudgesComplete =
      judgeRows.length > 0 && completeJudgeRuns.length === judgeRows.length;
    const combinedScore =
      canCombineScores && allJudgesComplete
        ? buildCombinedJudgeScore(completeJudgeRuns)
        : null;
    const scoreTotal =
      combinedScore?.isComplete && combinedScore?.scoreTotal
        ? combinedScore.scoreTotal
        : "";
    const completedAt = scoreTotal
      ? getLatestTimestamp(
          completeJudgeRuns.map((run) => run.completedAt || run.updatedAt)
        ) || getMultiJudgeLiveUpdatedAt(judgeRows.map((row) => row.session))
      : null;

    return {
      ...setupRun,
      draw,
      order: setupRun?.order ?? index + 1,
      backNumber: setupRun?.backNumber || judgeRuns[0]?.backNumber || "",
      rider: setupRun?.rider || judgeRuns[0]?.rider || "",
      horse: setupRun?.horse || judgeRuns[0]?.horse || "",
      owner: setupRun?.owner || judgeRuns[0]?.owner || "",
      scores: [],
      penalties: [],
      penTotal: "",
      scoreTotal,
      status: scoreTotal ? "completed" : "",
      isComplete: Boolean(scoreTotal),
      isActive: activeDraw != null && String(draw) === String(activeDraw),
      startedAt: getEarliestTimestamp(judgeRuns.map((run) => run.startedAt)),
      completedAt,
      multiJudge: true,
      judgeScores: completeJudgeRuns.map((run) => ({
        judgeId: run.judgeId,
        judgeName: run.judgeName,
        scoreTotal: run.scoreTotal ?? "",
      })),
    };
  });
}

function buildJudgeRows(judges, judgeSessions) {
  const normalizedJudges = normalizeClassJudges({ judges });
  const sessionByJudgeId = new Map(
    (Array.isArray(judgeSessions) ? judgeSessions : [])
      .filter((session) => session?.judgeId)
      .map((session) => [session.judgeId, session])
  );

  return normalizedJudges.map((judge, index) => ({
    judge,
    index,
    displayName: getJudgeDisplayName(judge, index),
    session: sessionByJudgeId.get(judge.id) || {
      judgeId: judge.id,
      judgeName: judge.name || getJudgeDisplayName(judge, index),
      runs: [],
    },
  }));
}

function buildBaseRunsFromJudgeSessions(judgeRows) {
  const runsByKey = new Map();

  judgeRows.forEach((row) => {
    (Array.isArray(row.session?.runs) ? row.session.runs : []).forEach(
      (run, index) => {
        const key = run?.id || String(run?.draw ?? run?.order ?? index + 1);
        if (!runsByKey.has(key)) {
          runsByKey.set(key, run);
        }
      }
    );
  });

  return Array.from(runsByKey.values()).sort((a, b) => {
    const aDraw = Number(a?.draw ?? a?.order);
    const bDraw = Number(b?.draw ?? b?.order);

    if (Number.isFinite(aDraw) && Number.isFinite(bDraw) && aDraw !== bDraw) {
      return aDraw - bDraw;
    }

    return String(a?.draw || "").localeCompare(String(b?.draw || ""));
  });
}

function getActiveDraw(judgeRows) {
  const counts = new Map();

  judgeRows.forEach((row) => {
    const draw = row.session?.activeManoeuvre?.draw;
    if (draw === null || draw === undefined || draw === "") return;

    const key = String(draw);
    const current = counts.get(key) || { draw, count: 0 };
    counts.set(key, {
      draw,
      count: current.count + 1,
    });
  });

  return (
    Array.from(counts.values()).sort((a, b) => b.count - a.count)[0]?.draw ??
    null
  );
}

function findMatchingRun(runs, setupRun, index) {
  const judgeRuns = Array.isArray(runs) ? runs : [];
  const setupDraw = setupRun?.draw ?? setupRun?.order ?? index + 1;

  return (
    judgeRuns.find((run) => run?.id && run.id === setupRun?.id) ||
    judgeRuns.find((run) => (run?.draw ?? run?.order) === setupDraw) ||
    null
  );
}

function isCompleteJudgeRun(run, manoeuvreCount) {
  const score = String(run?.scoreTotal ?? "").trim();
  return Boolean(score && isScoredRunComplete(run, manoeuvreCount));
}

function getLatestTimestamp(values) {
  const timestamps = values.filter(Boolean).sort();
  return timestamps[timestamps.length - 1] || null;
}

function getEarliestTimestamp(values) {
  const timestamps = values.filter(Boolean).sort();
  return timestamps[0] || null;
}
