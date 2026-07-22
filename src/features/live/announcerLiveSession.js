import {
  formatTotalValue,
  parseScoreTotalValue,
  penaltyCellHasScratch,
  runHasVideoReview,
} from "../../utils/scoring";
import { getRunIntegrationMetadata } from "../classes/classSetupStorage";
import {
  getJudgeDisplayName,
  normalizeClassJudges,
} from "../classes/classJudges";
import {
  buildCombinedJudgeScore,
  classUsesCombinedJudgeScore,
} from "../scoring/multiJudgeScoring";
import { isLivePublicationStatus } from "../publication/publicationRepository";

export const ANNOUNCER_RUN_STATUSES = {
  PENDING: "pending",
  ON_COURSE: "on_course",
  SCORED: "scored",
  NO_SCORE: "no_score",
  SCRATCH: "scratch",
  REVIEW: "review",
};

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : String(now || "");
}

function findMatchingRun(runs, sourceRun, index = 0) {
  const sourceRuns = Array.isArray(runs) ? runs : [];
  const draw = sourceRun?.draw ?? sourceRun?.order ?? index + 1;

  return (
    sourceRuns.find((run) => run?.id && run.id === sourceRun?.id) ||
    sourceRuns.find(
      (run) =>
        String(run?.draw ?? run?.order ?? "") === String(draw ?? "")
    ) ||
    null
  );
}

function scoringRunHasScratch(run = {}) {
  if (
    ["scratch", "scr", "scratched"].includes(
      String(run?.status || "").trim().toLowerCase()
    )
  ) {
    return true;
  }

  return (Array.isArray(run?.penalties) ? run.penalties : []).some(
    penaltyCellHasScratch
  );
}

function getSnapshotStatus(run = {}) {
  if (
    runHasVideoReview({
      ...run,
      scores: Array.isArray(run?.scores) ? run.scores : [],
      penalties: Array.isArray(run?.penalties) ? run.penalties : [],
    })
  ) {
    return ANNOUNCER_RUN_STATUSES.REVIEW;
  }
  if (scoringRunHasScratch(run)) return ANNOUNCER_RUN_STATUSES.SCRATCH;

  const normalizedStatus = String(run?.status || "").trim().toLowerCase();
  const normalizedScore = String(run?.scoreTotal || "").trim().toUpperCase();
  if (
    normalizedStatus === ANNOUNCER_RUN_STATUSES.NO_SCORE ||
    normalizedScore === "NS"
  ) {
    return ANNOUNCER_RUN_STATUSES.NO_SCORE;
  }

  const score = String(formatTotalValue(run?.scoreTotal) || "").trim();
  if (score && score !== "Review") return ANNOUNCER_RUN_STATUSES.SCORED;

  return ANNOUNCER_RUN_STATUSES.PENDING;
}

function normalizeRunStatus(value) {
  return Object.values(ANNOUNCER_RUN_STATUSES).includes(value)
    ? value
    : ANNOUNCER_RUN_STATUSES.PENDING;
}

function normalizeAnnouncerJudgeScores(judgeScores = []) {
  return (Array.isArray(judgeScores) ? judgeScores : [])
    .map((judgeScore, index) => ({
      judgeId: judgeScore?.judgeId || `judge-${index + 1}`,
      judgeName: judgeScore?.judgeName || "",
      scoreTotal: formatTotalValue(judgeScore?.scoreTotal),
    }))
    .filter((judgeScore) => String(judgeScore.scoreTotal || "").trim());
}

export function buildAnnouncerJudgeScoreResult({
  judges = [],
  judgeScores = [],
  pattern = "",
  customPattern = null,
} = {}) {
  const normalizedJudges = normalizeClassJudges({ judges });
  const judgeRows = normalizedJudges.length
    ? normalizedJudges
    : [{ id: "judge-1", name: "", order: 1 }];
  const scoreByJudgeId = new Map(
    (Array.isArray(judgeScores) ? judgeScores : []).map((judgeScore) => [
      String(judgeScore?.judgeId || ""),
      judgeScore,
    ])
  );
  const normalizedScores = judgeRows.map((judge, index) => {
    const source =
      scoreByJudgeId.get(String(judge.id)) ||
      (Array.isArray(judgeScores) ? judgeScores[index] : null) ||
      {};

    return {
      judgeId: judge.id,
      judgeName:
        judge.name || source.judgeName || getJudgeDisplayName(judge, index),
      scoreTotal: formatTotalValue(source.scoreTotal),
    };
  });
  const allScoresValid = normalizedScores.every((judgeScore) =>
    Number.isFinite(parseScoreTotalValue(judgeScore.scoreTotal))
  );

  if (!allScoresValid) {
    return {
      judgeScores: normalizedScores,
      scoreTotal: "",
      isComplete: false,
      isSupported: true,
    };
  }

  if (normalizedScores.length === 1) {
    return {
      judgeScores: normalizedScores,
      scoreTotal: normalizedScores[0].scoreTotal,
      isComplete: true,
      isSupported: true,
    };
  }

  if (!classUsesCombinedJudgeScore(pattern, customPattern)) {
    return {
      judgeScores: normalizedScores,
      scoreTotal: "",
      isComplete: false,
      isSupported: false,
    };
  }

  const combined = buildCombinedJudgeScore(normalizedScores);

  return {
    judgeScores: normalizedScores,
    scoreTotal: combined.scoreTotal,
    isComplete: combined.isComplete,
    isSupported: true,
  };
}

export function getAnnouncerLiveActivationStatus({
  session = {},
  publicationStatus = "",
  plannedLiveStatus = "",
} = {}) {
  if (
    !session?.startedAt ||
    session?.completedAt ||
    isLivePublicationStatus(publicationStatus) ||
    !isLivePublicationStatus(plannedLiveStatus)
  ) {
    return null;
  }

  return plannedLiveStatus;
}

export function normalizeAnnouncerLiveRun(run = {}, index = 0) {
  const status = normalizeRunStatus(run?.status);
  const scoreTotal =
    status === ANNOUNCER_RUN_STATUSES.SCRATCH
      ? "SCR"
      : status === ANNOUNCER_RUN_STATUSES.NO_SCORE
        ? "NS"
        : status === ANNOUNCER_RUN_STATUSES.REVIEW
          ? "Review"
          : formatTotalValue(run?.scoreTotal);

  return {
    ...run,
    id: run?.id || `announcer-run-${run?.draw ?? index + 1}`,
    order: run?.order ?? index + 1,
    draw: run?.draw ?? run?.order ?? index + 1,
    backNumber: run?.backNumber || "",
    rider: run?.rider || "",
    horse: run?.horse || "",
    owner: run?.owner || "",
    classCodes: Array.isArray(run?.classCodes) ? run.classCodes : [],
    ...getRunIntegrationMetadata(run),
    status,
    scoreTotal,
    judgeScores: normalizeAnnouncerJudgeScores(run?.judgeScores),
    isActive: status === ANNOUNCER_RUN_STATUSES.ON_COURSE,
    isComplete: [
      ANNOUNCER_RUN_STATUSES.SCORED,
      ANNOUNCER_RUN_STATUSES.NO_SCORE,
      ANNOUNCER_RUN_STATUSES.SCRATCH,
    ].includes(status),
    startedAt: run?.startedAt || null,
    completedAt:
      status === ANNOUNCER_RUN_STATUSES.REVIEW
        ? null
        : run?.completedAt || null,
    dragCompletedAt: run?.dragCompletedAt || null,
    resultSource: run?.resultSource || "announcer",
    history: Array.isArray(run?.history) ? run.history : [],
  };
}

export function normalizeAnnouncerLiveSession(
  session = {},
  { classId = "", setupRuns = [] } = {}
) {
  const sourceRuns =
    Array.isArray(session?.runs) && session.runs.length
      ? session.runs
      : setupRuns;

  return {
    classId: session?.classId || classId,
    runs: sourceRuns.map(normalizeAnnouncerLiveRun),
    activeManoeuvre:
      session?.activeManoeuvre &&
      typeof session.activeManoeuvre === "object"
        ? session.activeManoeuvre
        : null,
    startedAt: session?.startedAt || null,
    completedAt: session?.completedAt || null,
    completedBy: session?.completedBy || null,
    revision: Number(session?.revision) || 0,
    updatedAt: session?.updatedAt || null,
  };
}

export function buildInitialAnnouncerLiveSession({
  classId,
  setupRuns = [],
  scoringRuns = [],
  activeManoeuvre = null,
  now = new Date(),
} = {}) {
  const timestamp = nowIso(now);
  const runs = (Array.isArray(setupRuns) ? setupRuns : []).map(
    (setupRun, index) => {
      const scoringRun = findMatchingRun(scoringRuns, setupRun, index);
      const snapshotStatus = scoringRun
        ? getSnapshotStatus(scoringRun)
        : ANNOUNCER_RUN_STATUSES.PENDING;
      const sourceRun = {
        ...setupRun,
        ...(scoringRun || {}),
        status: snapshotStatus,
        resultSource:
          snapshotStatus === ANNOUNCER_RUN_STATUSES.PENDING
            ? "announcer"
            : "scribe_snapshot",
        completedAt:
          snapshotStatus === ANNOUNCER_RUN_STATUSES.SCORED ||
          snapshotStatus === ANNOUNCER_RUN_STATUSES.NO_SCORE ||
          snapshotStatus === ANNOUNCER_RUN_STATUSES.SCRATCH
            ? scoringRun?.completedAt || timestamp
            : null,
      };

      return normalizeAnnouncerLiveRun(sourceRun, index);
    }
  );

  return normalizeAnnouncerLiveSession(
    {
      classId,
      runs,
      activeManoeuvre,
      startedAt: timestamp,
      updatedAt: timestamp,
    },
    { classId, setupRuns }
  );
}

function updateSessionRun(session, runId, updateRun, now = new Date()) {
  const timestamp = nowIso(now);
  const normalized = normalizeAnnouncerLiveSession(session);
  const runs = normalized.runs.map((run, index) =>
    run.id === runId
      ? normalizeAnnouncerLiveRun(updateRun(run, timestamp), index)
      : run
  );

  return {
    ...normalized,
    runs,
    revision: normalized.revision + 1,
    updatedAt: timestamp,
  };
}

export function startAnnouncerRun(session, runId, now = new Date()) {
  const normalized = normalizeAnnouncerLiveSession(session);
  const run = normalized.runs.find((item) => item.id === runId);

  if (!run || run.status !== ANNOUNCER_RUN_STATUSES.PENDING) {
    return normalized;
  }

  const timestamp = nowIso(now);
  const runs = normalized.runs.map((item, index) =>
    normalizeAnnouncerLiveRun(
      item.id === runId
        ? {
            ...item,
            status: ANNOUNCER_RUN_STATUSES.ON_COURSE,
            startedAt: timestamp,
          }
        : item.status === ANNOUNCER_RUN_STATUSES.ON_COURSE
          ? { ...item, status: ANNOUNCER_RUN_STATUSES.PENDING, isActive: false }
          : item,
      index
    )
  );

  return {
    ...normalized,
    runs,
    activeManoeuvre: {
      type: "run",
      runId: run.id,
      draw: run.draw,
      startedAt: timestamp,
    },
    startedAt: normalized.startedAt || timestamp,
    completedAt: null,
    completedBy: null,
    revision: normalized.revision + 1,
    updatedAt: timestamp,
  };
}

export function startAnnouncerDrag(session, dragItem, now = new Date()) {
  const normalized = normalizeAnnouncerLiveSession(session);
  if (!dragItem || normalized.completedAt) return normalized;

  const timestamp = nowIso(now);

  return {
    ...normalized,
    runs: normalized.runs.map((run, index) =>
      normalizeAnnouncerLiveRun(
        run.status === ANNOUNCER_RUN_STATUSES.ON_COURSE
          ? { ...run, status: ANNOUNCER_RUN_STATUSES.PENDING }
          : run,
        index
      )
    ),
    activeManoeuvre: {
      type: "drag",
      id: dragItem.id || dragItem.itemId || "",
      afterIndex: Number.isInteger(dragItem.afterIndex)
        ? dragItem.afterIndex
        : null,
      afterDraw: dragItem.afterDraw ?? null,
      durationMinutes: Number(dragItem.durationMinutes) || null,
      startedAt: timestamp,
    },
    startedAt: normalized.startedAt || timestamp,
    revision: normalized.revision + 1,
    updatedAt: timestamp,
  };
}

export function stopAnnouncerDrag(session, now = new Date()) {
  const normalized = normalizeAnnouncerLiveSession(session);
  if (normalized.activeManoeuvre?.type !== "drag") return normalized;

  const timestamp = nowIso(now);
  const completedAfterIndex = Number.isInteger(
    normalized.activeManoeuvre.afterIndex
  )
    ? normalized.activeManoeuvre.afterIndex
    : normalized.runs.findIndex(
        (run) =>
          String(run.draw ?? "") ===
          String(normalized.activeManoeuvre.afterDraw ?? "")
      );

  return {
    ...normalized,
    runs: normalized.runs.map((run, index) =>
      index === completedAfterIndex
        ? normalizeAnnouncerLiveRun(
            {
              ...run,
              dragCompletedAt: timestamp,
            },
            index
          )
        : run
    ),
    activeManoeuvre: null,
    revision: normalized.revision + 1,
    updatedAt: timestamp,
  };
}

export function stopAnnouncerDragAndAdvance(
  session,
  nextRunId,
  now = new Date()
) {
  const normalized = normalizeAnnouncerLiveSession(session);
  const wasDragging = normalized.activeManoeuvre?.type === "drag";
  const stopped = stopAnnouncerDrag(normalized, now);

  if (!wasDragging || !nextRunId) return stopped;
  return startAnnouncerRun(stopped, nextRunId, now);
}

export function saveAnnouncerRunResult(
  session,
  runId,
  {
    status = ANNOUNCER_RUN_STATUSES.SCORED,
    scoreTotal = "",
    judgeScores = [],
    note = "",
  } = {},
  { now = new Date(), updatedBy = null } = {}
) {
  const normalizedStatus = normalizeRunStatus(status);
  const previous = normalizeAnnouncerLiveSession(session).runs.find(
    (run) => run.id === runId
  );

  if (!previous) return normalizeAnnouncerLiveSession(session);

  const cleanScore =
    normalizedStatus === ANNOUNCER_RUN_STATUSES.SCRATCH
      ? "SCR"
      : normalizedStatus === ANNOUNCER_RUN_STATUSES.NO_SCORE
        ? "NS"
        : normalizedStatus === ANNOUNCER_RUN_STATUSES.REVIEW
          ? "Review"
          : formatTotalValue(scoreTotal);
  const cleanJudgeScores =
    normalizedStatus === ANNOUNCER_RUN_STATUSES.SCORED
      ? normalizeAnnouncerJudgeScores(judgeScores)
      : [];
  const timestamp = nowIso(now);
  const didResultChange =
    previous.status !== normalizedStatus ||
    String(previous.scoreTotal || "") !== String(cleanScore || "") ||
    JSON.stringify(previous.judgeScores || []) !==
      JSON.stringify(cleanJudgeScores) ||
    String(previous.note || "") !== String(note || "");

  if (!didResultChange) return normalizeAnnouncerLiveSession(session);

  const next = updateSessionRun(
    session,
    runId,
    (run) => ({
      ...run,
      status: normalizedStatus,
      scoreTotal: cleanScore,
      judgeScores: cleanJudgeScores,
      note: String(note || "").trim(),
      isActive: false,
      completedAt:
        normalizedStatus === ANNOUNCER_RUN_STATUSES.REVIEW ? null : timestamp,
      resultSource: "announcer",
      history: [
        ...(Array.isArray(run.history) ? run.history : []),
        {
          changedAt: timestamp,
          changedBy: updatedBy,
          previousStatus: run.status,
          previousScoreTotal: run.scoreTotal || "",
          previousJudgeScores: run.judgeScores || [],
          nextStatus: normalizedStatus,
          nextScoreTotal: cleanScore || "",
          nextJudgeScores: cleanJudgeScores,
        },
      ],
    }),
    now
  );

  const activeRunMatches =
    next.activeManoeuvre?.runId === runId ||
    String(next.activeManoeuvre?.draw ?? "") === String(previous.draw ?? "");
  return activeRunMatches
    ? { ...next, activeManoeuvre: null }
    : next;
}

export function saveAnnouncerRunResultAndAdvance(
  session,
  runId,
  result = {},
  {
    nextRunId = "",
    waitForDrag = false,
    now = new Date(),
    updatedBy = null,
  } = {}
) {
  const normalized = normalizeAnnouncerLiveSession(session);
  const targetRun = normalized.runs.find((run) => run.id === runId);
  const activeRunMatches =
    Boolean(targetRun) &&
    normalized.activeManoeuvre?.type !== "drag" &&
    (normalized.activeManoeuvre?.runId === runId ||
      String(normalized.activeManoeuvre?.draw ?? "") ===
        String(targetRun?.draw ?? ""));
  const saved = saveAnnouncerRunResult(normalized, runId, result, {
    now,
    updatedBy,
  });

  if (!activeRunMatches || waitForDrag || !nextRunId) return saved;
  return startAnnouncerRun(saved, nextRunId, now);
}

export function getPendingAnnouncerReviews(session) {
  return normalizeAnnouncerLiveSession(session).runs.filter(
    (run) => run.status === ANNOUNCER_RUN_STATUSES.REVIEW
  );
}

export function getUnresolvedAnnouncerRuns(session) {
  return normalizeAnnouncerLiveSession(session).runs.filter((run) =>
    [
      ANNOUNCER_RUN_STATUSES.PENDING,
      ANNOUNCER_RUN_STATUSES.ON_COURSE,
    ].includes(run.status)
  );
}

export function completeAnnouncerLiveSession(
  session,
  { now = new Date(), completedBy = null } = {}
) {
  const normalized = normalizeAnnouncerLiveSession(session);
  const pendingReviews = getPendingAnnouncerReviews(normalized);
  const unresolvedRuns = getUnresolvedAnnouncerRuns(normalized);

  if (pendingReviews.length || unresolvedRuns.length) {
    return {
      ok: false,
      session: normalized,
      pendingReviews,
      unresolvedRuns,
    };
  }

  const timestamp = nowIso(now);
  return {
    ok: true,
    session: {
      ...normalized,
      activeManoeuvre: null,
      completedAt: timestamp,
      completedBy,
      revision: normalized.revision + 1,
      updatedAt: timestamp,
    },
    pendingReviews: [],
    unresolvedRuns: [],
  };
}

export function reopenAnnouncerLiveSession(session, now = new Date()) {
  const normalized = normalizeAnnouncerLiveSession(session);
  const timestamp = nowIso(now);

  return {
    ...normalized,
    completedAt: null,
    completedBy: null,
    revision: normalized.revision + 1,
    updatedAt: timestamp,
  };
}
