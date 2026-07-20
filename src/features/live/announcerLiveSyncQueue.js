export const ANNOUNCER_LIVE_SYNC_QUEUE_KEY =
  "showscore_announcer_live_sync_queue_v1";

export const ANNOUNCER_LIVE_SYNC_STATUSES = {
  LOCAL: "local",
  SYNCING: "syncing",
  SYNCED: "synced",
  PENDING: "pending",
};

function getMutationKey(classId) {
  return `announcer-live:${classId}`;
}

function createRevision() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadQueue() {
  try {
    const raw = localStorage.getItem(ANNOUNCER_LIVE_SYNC_QUEUE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture queue live annonceur:", error);
    return {};
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(
      ANNOUNCER_LIVE_SYNC_QUEUE_KEY,
      JSON.stringify(queue || {})
    );
  } catch (error) {
    console.error("Erreur sauvegarde queue live annonceur:", error);
  }
}

export function getPendingAnnouncerLiveMutation(classId) {
  const mutation = loadQueue()[getMutationKey(classId)];
  return mutation?.type === "announcer_live_session" ? mutation : null;
}

export function hasPendingAnnouncerLiveMutation(classId) {
  return Boolean(getPendingAnnouncerLiveMutation(classId));
}

export function queueAnnouncerLiveMutation(classId, session) {
  const queue = loadQueue();
  const key = getMutationKey(classId);
  const previous = queue[key];
  const now = new Date().toISOString();

  queue[key] = {
    id: key,
    type: "announcer_live_session",
    classId,
    session,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    revision: createRevision(),
    attempts: previous?.attempts || 0,
    lastAttemptAt: previous?.lastAttemptAt || null,
    lastError: null,
  };
  saveQueue(queue);
  return queue[key];
}

export function getQueuedAnnouncerLiveMutations(classId = null) {
  return Object.values(loadQueue())
    .filter((mutation) => mutation?.type === "announcer_live_session")
    .filter((mutation) => !classId || mutation.classId === classId)
    .sort((left, right) =>
      String(left.updatedAt).localeCompare(String(right.updatedAt))
    );
}

export function markAnnouncerLiveMutationAttempt(
  classId,
  revision,
  errorMessage
) {
  const queue = loadQueue();
  const key = getMutationKey(classId);
  const current = queue[key];

  if (!current || current.revision !== revision) return current || null;

  queue[key] = {
    ...current,
    attempts: (Number(current.attempts) || 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: String(errorMessage || "Sync failed"),
  };
  saveQueue(queue);
  return queue[key];
}

export function removeAnnouncerLiveMutation(classId, revision = null) {
  const queue = loadQueue();
  const key = getMutationKey(classId);
  const current = queue[key];

  if (!current || (revision && current.revision !== revision)) {
    return current || null;
  }

  delete queue[key];
  saveQueue(queue);
  return null;
}

export function getAnnouncerLiveSyncStatus(classId, hasSupabase = true) {
  if (!hasSupabase) return ANNOUNCER_LIVE_SYNC_STATUSES.LOCAL;
  return hasPendingAnnouncerLiveMutation(classId)
    ? ANNOUNCER_LIVE_SYNC_STATUSES.PENDING
    : ANNOUNCER_LIVE_SYNC_STATUSES.SYNCED;
}

export function getAnnouncerLiveSyncFailure(classId) {
  const mutation = getPendingAnnouncerLiveMutation(classId);
  if (!mutation) return null;

  return {
    attempts: Number(mutation.attempts) || 0,
    lastAttemptAt: mutation.lastAttemptAt || null,
    lastError: mutation.lastError || "",
  };
}
