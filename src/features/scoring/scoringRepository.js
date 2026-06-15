import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  clearScoringData as clearScoringDataLocal,
  loadActiveManoeuvre as loadActiveManoeuvreLocal,
  loadScoringRuns as loadScoringRunsLocal,
  saveActiveManoeuvre as saveActiveManoeuvreLocal,
  saveScoringRuns as saveScoringRunsLocal,
} from "./scoringStorage";
import {
  getLocalScoringRunsSyncStatus,
  getPendingScoringRunsMutation,
  getQueuedScoringRunsMutations,
  getScoringRunsSyncFailure,
  hasPendingScoringRunsMutation,
  markScoringRunsMutationAttempt,
  queueScoringRunsMutation,
  removeScoringRunsMutation,
  SCORING_SYNC_STATUS,
} from "./scoringSyncQueue";

let activeScoringQueueFlush = null;
const scheduledScoringQueueFlushes = new Map();

function toScoringSession(row, classId) {
  return {
    classId,
    runs: Array.isArray(row?.runs) ? row.runs : [],
    activeManoeuvre:
      row?.active_manoeuvre && typeof row.active_manoeuvre === "object"
        ? row.active_manoeuvre
        : null,
    startedAt: row?.started_at || null,
    updatedAt: row?.updated_at || row?.updatedAt || null,
  };
}

function getLocalScoringSession(classId) {
  return {
    classId,
    runs: loadScoringRunsLocal(classId),
    activeManoeuvre: loadActiveManoeuvreLocal(classId),
  };
}

async function upsertScoringSession(classId, updates = {}) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured" };
  }

  try {
    const row = {
      class_id: classId,
    };

    if (updates.runs !== undefined) {
      row.runs = Array.isArray(updates.runs) ? updates.runs : [];
    }

    if (updates.activeManoeuvre !== undefined) {
      row.active_manoeuvre = updates.activeManoeuvre;
    }

    if (updates.startedAt !== undefined) {
      row.started_at = updates.startedAt;
    }

    const { error } = await supabase.from("show_score_scoring_sessions").upsert(row);

    if (error) throw error;
    return { ok: true, error: null };
  } catch (error) {
    console.error("Erreur sauvegarde scoring Supabase:", error);
    return {
      ok: false,
      error: error?.message || "Erreur sauvegarde scoring Supabase",
    };
  }
}

function notifyScoringSyncStatus(options, classId, status) {
  if (options?.classId && options.classId !== classId) return;
  if (typeof options?.onStatusChange === "function") {
    options.onStatusChange(status);
  }
}

function getScheduledFlushKey(classId = null) {
  return classId || "__all__";
}

function cancelScheduledScoringSyncQueue(classId = null) {
  const key = getScheduledFlushKey(classId);
  const scheduled = scheduledScoringQueueFlushes.get(key);

  if (!scheduled) return;

  clearTimeout(scheduled.timer);
  scheduledScoringQueueFlushes.delete(key);

  if (typeof scheduled.resolve === "function") {
    scheduled.resolve({
      syncedCount: 0,
      failedCount: 0,
      status: classId
        ? getScoringRunsSyncStatus(classId)
        : SCORING_SYNC_STATUS.PENDING,
      cancelled: true,
    });
  }
}

async function flushScoringSyncQueueNow(options = {}) {
  const targetClassId = options.classId || null;
  const supabase = getSupabaseClient();

  if (!supabase) {
    if (targetClassId) {
      notifyScoringSyncStatus(
        options,
        targetClassId,
        SCORING_SYNC_STATUS.LOCAL
      );
    }

    return {
      syncedCount: 0,
      failedCount: 0,
      status: SCORING_SYNC_STATUS.LOCAL,
    };
  }

  let syncedCount = 0;
  let failedCount = 0;

  while (true) {
    const [mutation] = getQueuedScoringRunsMutations(targetClassId);

    if (!mutation) break;

    notifyScoringSyncStatus(
      options,
      mutation.classId,
      SCORING_SYNC_STATUS.SYNCING
    );

    const result = await upsertScoringSession(mutation.classId, {
      runs: mutation.runs,
    });

    if (!result.ok) {
      failedCount += 1;
      markScoringRunsMutationAttempt(
        mutation.classId,
        mutation.revision,
        result.error
      );
      notifyScoringSyncStatus(
        options,
        mutation.classId,
        SCORING_SYNC_STATUS.PENDING
      );
      break;
    }

    const currentMutation = getPendingScoringRunsMutation(mutation.classId);
    if (currentMutation?.revision === mutation.revision) {
      removeScoringRunsMutation(mutation.classId, mutation.revision);
      syncedCount += 1;
    }
  }

  const status = targetClassId
    ? getScoringRunsSyncStatus(targetClassId)
    : failedCount > 0
      ? SCORING_SYNC_STATUS.PENDING
      : SCORING_SYNC_STATUS.SYNCED;

  if (targetClassId) {
    notifyScoringSyncStatus(options, targetClassId, status);
  }

  return {
    syncedCount,
    failedCount,
    status,
  };
}

export function getScoringRunsSyncStatus(classId) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return SCORING_SYNC_STATUS.LOCAL;
  }

  return getLocalScoringRunsSyncStatus(classId);
}

export { getScoringRunsSyncFailure };

export function flushScoringSyncQueue(options = {}) {
  cancelScheduledScoringSyncQueue(options.classId || null);

  if (activeScoringQueueFlush) {
    return activeScoringQueueFlush.then(() => flushScoringSyncQueue(options));
  }

  activeScoringQueueFlush = flushScoringSyncQueueNow(options).finally(() => {
    activeScoringQueueFlush = null;
  });

  return activeScoringQueueFlush;
}

export function scheduleScoringSyncQueue(options = {}) {
  const classId = options.classId || null;
  const delayMs = Math.max(Number(options.delayMs) || 0, 0);

  if (delayMs <= 0) {
    return flushScoringSyncQueue(options);
  }

  cancelScheduledScoringSyncQueue(classId);

  return new Promise((resolve, reject) => {
    const key = getScheduledFlushKey(classId);
    const timer = setTimeout(() => {
      scheduledScoringQueueFlushes.delete(key);
      flushScoringSyncQueue(options).then(resolve).catch(reject);
    }, delayMs);

    scheduledScoringQueueFlushes.set(key, {
      timer,
      resolve,
      reject,
    });
  });
}

export function loadScoringRuns(classId) {
  return loadScoringRunsLocal(classId);
}

export function saveScoringRuns(classId, runs) {
  saveScoringRunsLocal(classId, runs);
}

export function loadActiveManoeuvre(classId) {
  return loadActiveManoeuvreLocal(classId);
}

export function saveActiveManoeuvre(classId, activeManoeuvre) {
  saveActiveManoeuvreLocal(classId, activeManoeuvre);
}

export function clearScoringData(classId) {
  clearScoringDataLocal(classId);
  removeScoringRunsMutation(classId);
}

export async function loadScoringSessionRepository(classId) {
  const localSession = getLocalScoringSession(classId);
  const supabase = getSupabaseClient();

  if (!supabase) {
    return localSession;
  }

  if (hasPendingScoringRunsMutation(classId)) {
    await flushScoringSyncQueue({ classId });

    if (hasPendingScoringRunsMutation(classId)) {
      return localSession;
    }
  }

  try {
    const { data, error } = await supabase
      .from("show_score_scoring_sessions")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return localSession;

    if (hasPendingScoringRunsMutation(classId)) {
      return localSession;
    }

    const session = toScoringSession(data, classId);
    saveScoringRunsLocal(classId, session.runs);
    saveActiveManoeuvreLocal(classId, session.activeManoeuvre);
    return session;
  } catch (error) {
    console.error("Erreur chargement scoring Supabase:", error);
    return localSession;
  }
}

export async function loadScoringRunsRepository(classId) {
  const session = await loadScoringSessionRepository(classId);
  return session.runs;
}

export async function loadActiveManoeuvreRepository(classId) {
  const session = await loadScoringSessionRepository(classId);
  return session.activeManoeuvre;
}

export async function saveScoringRunsRepository(classId, runs, options = {}) {
  const normalizedRuns = Array.isArray(runs) ? runs : [];
  const debounceMs = Math.max(Number(options.debounceMs) || 0, 0);

  saveScoringRunsLocal(classId, normalizedRuns);
  queueScoringRunsMutation(classId, normalizedRuns);
  notifyScoringSyncStatus(options, classId, SCORING_SYNC_STATUS.LOCAL);

  const syncOptions = {
    ...options,
    classId,
  };

  if (debounceMs > 0) {
    await scheduleScoringSyncQueue({
      ...syncOptions,
      delayMs: debounceMs,
    });
  } else {
    await flushScoringSyncQueue(syncOptions);
  }

  return normalizedRuns;
}

export async function saveScoringStartedAtRepository(classId, startedAt) {
  await upsertScoringSession(classId, { startedAt: startedAt || null });
}

export async function saveActiveManoeuvreRepository(classId, activeManoeuvre) {
  const normalizedActiveManoeuvre = activeManoeuvre ?? null;
  saveActiveManoeuvreLocal(classId, normalizedActiveManoeuvre);
  await upsertScoringSession(classId, {
    activeManoeuvre: normalizedActiveManoeuvre,
  });
  return normalizedActiveManoeuvre;
}

export async function clearScoringDataRepository(classId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("show_score_scoring_sessions")
        .delete()
        .eq("class_id", classId);

      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression scoring Supabase:", error);
    }
  }

  clearScoringDataLocal(classId);
  removeScoringRunsMutation(classId);
}

export { SCORING_SYNC_STATUS };
