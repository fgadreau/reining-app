import { SCORING_SYNC_STATUS } from "./scoringSyncQueue";

export const JUDGE_SCORING_SESSION_SYNC_QUEUE_KEY =
  "reining_judge_scoring_session_sync_queue_v1";

function getMutationKey(classId, judgeId) {
  return `judge-session:${classId || ""}:${judgeId || ""}`;
}

function createRevision() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadQueueMap() {
  try {
    const raw = localStorage.getItem(JUDGE_SCORING_SESSION_SYNC_QUEUE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture queue sync sessions juges:", error);
    return {};
  }
}

function saveQueueMap(queueMap) {
  try {
    localStorage.setItem(
      JUDGE_SCORING_SESSION_SYNC_QUEUE_KEY,
      JSON.stringify(queueMap || {})
    );
  } catch (error) {
    console.error("Erreur sauvegarde queue sync sessions juges:", error);
  }
}

export function getPendingJudgeScoringSessionMutation(classId, judgeId) {
  const queueMap = loadQueueMap();
  const mutation = queueMap[getMutationKey(classId, judgeId)];

  return mutation?.type === "judge_scoring_session" ? mutation : null;
}

export function hasPendingJudgeScoringSessionMutation(classId, judgeId = null) {
  if (judgeId) {
    return Boolean(getPendingJudgeScoringSessionMutation(classId, judgeId));
  }

  return getQueuedJudgeScoringSessionMutations({ classId }).length > 0;
}

export function queueJudgeScoringSessionMutation(session) {
  const classId = session?.classId || "";
  const judgeId = session?.judgeId || "";
  const queueMap = loadQueueMap();
  const now = new Date().toISOString();
  const key = getMutationKey(classId, judgeId);
  const previous = queueMap[key];

  const mutation = {
    id: key,
    type: "judge_scoring_session",
    classId,
    judgeId,
    session,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    revision: createRevision(),
    attempts: previous?.attempts || 0,
    lastAttemptAt: previous?.lastAttemptAt || null,
    lastError: null,
  };

  queueMap[key] = mutation;
  saveQueueMap(queueMap);
  return mutation;
}

export function getQueuedJudgeScoringSessionMutations(options = {}) {
  const queueMap = loadQueueMap();
  const classId = options.classId || null;
  const judgeId = options.judgeId || null;

  return Object.values(queueMap)
    .filter((mutation) => mutation?.type === "judge_scoring_session")
    .filter((mutation) => !classId || mutation.classId === classId)
    .filter((mutation) => !judgeId || mutation.judgeId === judgeId)
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
}

export function getJudgeScoringSessionSyncFailure(classId, judgeId = null) {
  const mutations = getQueuedJudgeScoringSessionMutations({
    classId,
    judgeId,
  });
  const [mutation] = mutations
    .filter((candidate) => candidate?.lastError || candidate?.lastAttemptAt)
    .sort((a, b) =>
      String(b.lastAttemptAt || b.updatedAt).localeCompare(
        String(a.lastAttemptAt || a.updatedAt)
      )
    );
  const pendingMutation = mutation || mutations[0];

  if (!pendingMutation) {
    return null;
  }

  return {
    attempts: Number(pendingMutation.attempts) || 0,
    lastAttemptAt: pendingMutation.lastAttemptAt || null,
    lastError: pendingMutation.lastError || "",
  };
}

export function markJudgeScoringSessionMutationAttempt(
  classId,
  judgeId,
  revision,
  errorMessage
) {
  const queueMap = loadQueueMap();
  const key = getMutationKey(classId, judgeId);
  const current = queueMap[key];

  if (!current || current.revision !== revision) {
    return current || null;
  }

  queueMap[key] = {
    ...current,
    attempts: (Number(current.attempts) || 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: errorMessage || "Sync failed",
  };

  saveQueueMap(queueMap);
  return queueMap[key];
}

export function removeJudgeScoringSessionMutation(
  classId,
  judgeId,
  revision = null
) {
  const queueMap = loadQueueMap();
  const key = getMutationKey(classId, judgeId);
  const current = queueMap[key];

  if (!current) {
    return null;
  }

  if (revision && current.revision !== revision) {
    return current;
  }

  delete queueMap[key];
  saveQueueMap(queueMap);
  return null;
}

export function getLocalJudgeScoringSessionSyncStatus(classId, judgeId = null) {
  return hasPendingJudgeScoringSessionMutation(classId, judgeId)
    ? SCORING_SYNC_STATUS.PENDING
    : SCORING_SYNC_STATUS.SYNCED;
}
