export const SCORING_RUNS_SYNC_QUEUE_KEY = "reining_scoring_runs_sync_queue_v1";

export const SCORING_SYNC_STATUS = {
  LOCAL: "local",
  SYNCING: "syncing",
  SYNCED: "synced",
  PENDING: "pending",
};

function getMutationKey(classId) {
  return `scoring-runs:${classId}`;
}

function createRevision() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadQueueMap() {
  try {
    const raw = localStorage.getItem(SCORING_RUNS_SYNC_QUEUE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture queue sync scoring:", error);
    return {};
  }
}

function saveQueueMap(queueMap) {
  try {
    localStorage.setItem(
      SCORING_RUNS_SYNC_QUEUE_KEY,
      JSON.stringify(queueMap || {})
    );
  } catch (error) {
    console.error("Erreur sauvegarde queue sync scoring:", error);
  }
}

export function getPendingScoringRunsMutation(classId) {
  const queueMap = loadQueueMap();
  const mutation = queueMap[getMutationKey(classId)];

  return mutation?.type === "scoring_runs" ? mutation : null;
}

export function getScoringRunsSyncFailure(classId) {
  const mutation = getPendingScoringRunsMutation(classId);

  if (!mutation) {
    return null;
  }

  return {
    attempts: Number(mutation.attempts) || 0,
    lastAttemptAt: mutation.lastAttemptAt || null,
    lastError: mutation.lastError || "",
  };
}

export function hasPendingScoringRunsMutation(classId) {
  return Boolean(getPendingScoringRunsMutation(classId));
}

export function queueScoringRunsMutation(classId, runs) {
  const queueMap = loadQueueMap();
  const now = new Date().toISOString();
  const key = getMutationKey(classId);
  const previous = queueMap[key];

  const mutation = {
    id: key,
    type: "scoring_runs",
    classId,
    runs: Array.isArray(runs) ? runs : [],
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

export function getQueuedScoringRunsMutations(classId = null) {
  const queueMap = loadQueueMap();

  return Object.values(queueMap)
    .filter((mutation) => mutation?.type === "scoring_runs")
    .filter((mutation) => !classId || mutation.classId === classId)
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
}

export function markScoringRunsMutationAttempt(classId, revision, errorMessage) {
  const queueMap = loadQueueMap();
  const key = getMutationKey(classId);
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

export function removeScoringRunsMutation(classId, revision = null) {
  const queueMap = loadQueueMap();
  const key = getMutationKey(classId);
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

export function getLocalScoringRunsSyncStatus(classId) {
  return hasPendingScoringRunsMutation(classId)
    ? SCORING_SYNC_STATUS.PENDING
    : SCORING_SYNC_STATUS.SYNCED;
}
