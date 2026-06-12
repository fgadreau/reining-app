import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  loadJudgeScoringSessionLocal,
  loadJudgeScoringSessionsForClassLocal,
  normalizeJudgeScoringSession,
  saveJudgeScoringSessionLocal,
} from "./judgeScoringSessionStorage";
import {
  getLocalJudgeScoringSessionSyncStatus,
  getQueuedJudgeScoringSessionMutations,
  hasPendingJudgeScoringSessionMutation,
  markJudgeScoringSessionMutationAttempt,
  queueJudgeScoringSessionMutation,
  removeJudgeScoringSessionMutation,
} from "./judgeScoringSessionSyncQueue";
import { SCORING_SYNC_STATUS } from "./scoringSyncQueue";

let activeJudgeSessionQueueFlush = null;
const scheduledJudgeSessionQueueFlushes = new Map();

function toJudgeScoringSession(row, options = {}) {
  return normalizeJudgeScoringSession(
    {
      classId: row.class_id,
      judgeId: row.judge_id,
      judgeName: row.judge_name || "",
      claimedBy: row.claimed_by || null,
      claimedByEmail: row.claimed_by_email || null,
      claimedAt: row.claimed_at || null,
      runs: Array.isArray(row.runs) ? row.runs : [],
      activeManoeuvre:
        row.active_manoeuvre && typeof row.active_manoeuvre === "object"
          ? row.active_manoeuvre
          : null,
      judgeSignature: row.judge_signature || null,
      finalized: Boolean(row.finalized),
      finalizedAt: row.finalized_at || null,
      judgeSignedAt: row.judge_signed_at || null,
      updatedAt: row.updated_at || null,
    },
    options
  );
}

function toJudgeScoringSessionRow(session) {
  const normalized = normalizeJudgeScoringSession(session);

  return {
    class_id: normalized.classId,
    judge_id: normalized.judgeId,
    judge_name: normalized.judgeName || "",
    claimed_by: normalized.claimedBy || null,
    claimed_by_email: normalized.claimedByEmail || null,
    claimed_at: normalized.claimedAt || null,
    runs: Array.isArray(normalized.runs) ? normalized.runs : [],
    active_manoeuvre: normalized.activeManoeuvre || null,
    judge_signature: normalized.judgeSignature || null,
    finalized: Boolean(normalized.finalized),
    finalized_at: normalized.finalizedAt || null,
    judge_signed_at: normalized.judgeSignedAt || null,
  };
}

function getClaimPayload(user, claimedAt = new Date().toISOString()) {
  return {
    claimedBy: user?.id || null,
    claimedByEmail: user?.email || null,
    claimedAt,
  };
}

function sessionClaimedByOther(session, user) {
  return Boolean(
    session?.claimedBy &&
      user?.id &&
      String(session.claimedBy) !== String(user.id)
  );
}

function sessionClaimedByUser(session, user) {
  return Boolean(
    session?.claimedBy &&
      user?.id &&
      String(session.claimedBy) === String(user.id)
  );
}

function notifyJudgeSessionSyncStatus(options, classId, status) {
  if (options?.classId && options.classId !== classId) return;
  if (typeof options?.onStatusChange === "function") {
    options.onStatusChange(status);
  }
}

function getScheduledFlushKey(classId = null, judgeId = null) {
  return `${classId || "__all__"}:${judgeId || "__all__"}`;
}

function cancelScheduledJudgeSessionSyncQueue(classId = null, judgeId = null) {
  const key = getScheduledFlushKey(classId, judgeId);
  const scheduled = scheduledJudgeSessionQueueFlushes.get(key);

  if (!scheduled) return;

  clearTimeout(scheduled.timer);
  scheduledJudgeSessionQueueFlushes.delete(key);

  if (typeof scheduled.resolve === "function") {
    scheduled.resolve({
      syncedCount: 0,
      failedCount: 0,
      status: classId
        ? getJudgeScoringSessionSyncStatus(classId, judgeId)
        : SCORING_SYNC_STATUS.PENDING,
      cancelled: true,
    });
  }
}

async function fetchRemoteJudgeScoringSession(classId, judge) {
  const supabase = getSupabaseClient();

  if (!supabase || !classId || !judge?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("show_score_judge_sessions")
    .select("*")
    .eq("class_id", classId)
    .eq("judge_id", judge.id)
    .maybeSingle();

  if (error) throw error;
  return data ? toJudgeScoringSession(data, { classId, judge }) : null;
}

async function saveRemoteJudgeScoringSession(session) {
  const supabase = getSupabaseClient();
  const normalized = normalizeJudgeScoringSession(session);
  const judge = {
    id: normalized.judgeId,
    name: normalized.judgeName,
  };

  if (!supabase) {
    return { ok: false, error: "Supabase is not configured" };
  }

  try {
    const saveQuery = normalized.claimedBy
      ? supabase
          .from("show_score_judge_sessions")
          .update(toJudgeScoringSessionRow(normalized))
          .eq("class_id", normalized.classId)
          .eq("judge_id", normalized.judgeId)
          .or(`claimed_by.is.null,claimed_by.eq.${normalized.claimedBy}`)
      : supabase
          .from("show_score_judge_sessions")
          .upsert(toJudgeScoringSessionRow(normalized));

    const { data, error } = await saveQuery.select("*").maybeSingle();

    if (error) throw error;

    if (!data) {
      const remoteSession = await fetchRemoteJudgeScoringSession(
        normalized.classId,
        judge
      );

      if (remoteSession) {
        saveJudgeScoringSessionLocal(
          normalized.classId,
          normalized.judgeId,
          remoteSession
        );
        return {
          ok: false,
          conflict: true,
          session: remoteSession,
          error: "Judge session is claimed by another user",
        };
      }

      return {
        ok: false,
        error: "Judge session was not saved",
      };
    }

    const saved = toJudgeScoringSession(data, {
      classId: normalized.classId,
      judge,
    });
    saveJudgeScoringSessionLocal(normalized.classId, normalized.judgeId, saved);

    return {
      ok: true,
      session: saved,
    };
  } catch (error) {
    console.error("Erreur sauvegarde session juge Supabase:", error);
    return {
      ok: false,
      error: error?.message || "Erreur sauvegarde session juge Supabase",
    };
  }
}

async function flushJudgeScoringSessionSyncQueueNow(options = {}) {
  const targetClassId = options.classId || null;
  const targetJudgeId = options.judgeId || null;
  const supabase = getSupabaseClient();

  if (!supabase) {
    if (targetClassId) {
      notifyJudgeSessionSyncStatus(
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
    const [mutation] = getQueuedJudgeScoringSessionMutations({
      classId: targetClassId,
      judgeId: targetJudgeId,
    });

    if (!mutation) break;

    notifyJudgeSessionSyncStatus(
      options,
      mutation.classId,
      SCORING_SYNC_STATUS.SYNCING
    );

    const result = await saveRemoteJudgeScoringSession(mutation.session);

    if (!result.ok) {
      if (result.conflict) {
        removeJudgeScoringSessionMutation(
          mutation.classId,
          mutation.judgeId,
          mutation.revision
        );
        failedCount += 1;
        notifyJudgeSessionSyncStatus(
          options,
          mutation.classId,
          SCORING_SYNC_STATUS.SYNCED
        );
        continue;
      }

      failedCount += 1;
      markJudgeScoringSessionMutationAttempt(
        mutation.classId,
        mutation.judgeId,
        mutation.revision,
        result.error
      );
      notifyJudgeSessionSyncStatus(
        options,
        mutation.classId,
        SCORING_SYNC_STATUS.PENDING
      );
      break;
    }

    removeJudgeScoringSessionMutation(
      mutation.classId,
      mutation.judgeId,
      mutation.revision
    );
    syncedCount += 1;
  }

  const status = targetClassId
    ? getJudgeScoringSessionSyncStatus(targetClassId, targetJudgeId)
    : failedCount > 0
      ? SCORING_SYNC_STATUS.PENDING
      : SCORING_SYNC_STATUS.SYNCED;

  if (targetClassId) {
    notifyJudgeSessionSyncStatus(options, targetClassId, status);
  }

  return {
    syncedCount,
    failedCount,
    status,
  };
}

export function isJudgeSessionClaimedByOther(session, user) {
  return sessionClaimedByOther(session, user);
}

export function getJudgeScoringSessionSyncStatus(classId, judgeId = null) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return SCORING_SYNC_STATUS.LOCAL;
  }

  return getLocalJudgeScoringSessionSyncStatus(classId, judgeId);
}

export function flushJudgeScoringSessionSyncQueue(options = {}) {
  const classId = options.classId || null;
  const judgeId = options.judgeId || null;

  cancelScheduledJudgeSessionSyncQueue(classId, judgeId);

  if (activeJudgeSessionQueueFlush) {
    return activeJudgeSessionQueueFlush.then(() =>
      flushJudgeScoringSessionSyncQueue(options)
    );
  }

  activeJudgeSessionQueueFlush = flushJudgeScoringSessionSyncQueueNow(
    options
  ).finally(() => {
    activeJudgeSessionQueueFlush = null;
  });

  return activeJudgeSessionQueueFlush;
}

export function scheduleJudgeScoringSessionSyncQueue(options = {}) {
  const classId = options.classId || null;
  const judgeId = options.judgeId || null;
  const delayMs = Math.max(Number(options.delayMs) || 0, 0);

  if (delayMs <= 0) {
    return flushJudgeScoringSessionSyncQueue(options);
  }

  cancelScheduledJudgeSessionSyncQueue(classId, judgeId);

  return new Promise((resolve, reject) => {
    const key = getScheduledFlushKey(classId, judgeId);
    const timer = setTimeout(() => {
      scheduledJudgeSessionQueueFlushes.delete(key);
      flushJudgeScoringSessionSyncQueue(options).then(resolve).catch(reject);
    }, delayMs);

    scheduledJudgeSessionQueueFlushes.set(key, {
      timer,
      resolve,
      reject,
    });
  });
}

export async function loadJudgeScoringSessionRepository(classId, judge) {
  const localSession = loadJudgeScoringSessionLocal(classId, judge);
  const supabase = getSupabaseClient();

  if (!supabase || !classId || !judge?.id) {
    return localSession;
  }

  if (hasPendingJudgeScoringSessionMutation(classId, judge.id)) {
    await flushJudgeScoringSessionSyncQueue({ classId, judgeId: judge.id });

    if (hasPendingJudgeScoringSessionMutation(classId, judge.id)) {
      return localSession;
    }
  }

  try {
    const session = await fetchRemoteJudgeScoringSession(classId, judge);
    if (!session) return localSession;

    saveJudgeScoringSessionLocal(classId, judge.id, session);
    return session;
  } catch (error) {
    console.error("Erreur chargement session juge Supabase:", error);
    return localSession;
  }
}

export async function loadJudgeScoringSessionsForClassRepository(
  classId,
  judges = []
) {
  const localSessions = loadJudgeScoringSessionsForClassLocal(classId, judges);
  const supabase = getSupabaseClient();

  if (!supabase || !classId) {
    return localSessions;
  }

  if (hasPendingJudgeScoringSessionMutation(classId)) {
    await flushJudgeScoringSessionSyncQueue({ classId });

    if (hasPendingJudgeScoringSessionMutation(classId)) {
      return localSessions;
    }
  }

  try {
    const { data, error } = await supabase
      .from("show_score_judge_sessions")
      .select("*")
      .eq("class_id", classId);

    if (error) throw error;

    const sessionsByJudgeId = new Map();
    const judgeById = new Map(judges.map((judge) => [judge.id, judge]));

    (Array.isArray(data) ? data : []).forEach((row) => {
      const judge = judgeById.get(row.judge_id);
      const session = toJudgeScoringSession(row, { classId, judge });
      sessionsByJudgeId.set(session.judgeId, session);
      saveJudgeScoringSessionLocal(classId, session.judgeId, session);
    });

    return judges.map((judge, index) => {
      return (
        sessionsByJudgeId.get(judge.id) ||
        localSessions[index] ||
        normalizeJudgeScoringSession({}, { classId, judge })
      );
    });
  } catch (error) {
    console.error("Erreur chargement sessions juges Supabase:", error);
    return localSessions;
  }
}

export async function claimJudgeScoringSessionRepository({
  classId,
  judge,
  user,
}) {
  const claimedAt = new Date().toISOString();
  const localSession = loadJudgeScoringSessionLocal(classId, judge);
  const claimPayload = getClaimPayload(user, claimedAt);

  if (!user?.id) {
    return {
      ok: false,
      reason: "missing-user",
      session: localSession,
    };
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    if (sessionClaimedByOther(localSession, user)) {
      return {
        ok: false,
        reason: "claimed-by-other",
        session: localSession,
      };
    }

    const nextLocalSession = saveJudgeScoringSessionLocal(classId, judge.id, {
      ...localSession,
      ...claimPayload,
      judgeName: localSession.judgeName || judge.name || "",
    });

    return {
      ok: true,
      session: nextLocalSession,
    };
  }

  try {
    const remoteSession = await fetchRemoteJudgeScoringSession(classId, judge);

    if (sessionClaimedByOther(remoteSession, user)) {
      return {
        ok: false,
        reason: "claimed-by-other",
        session: remoteSession,
      };
    }

    if (remoteSession) {
      const { data, error } = await supabase
        .from("show_score_judge_sessions")
        .update(toJudgeScoringSessionRow({
          ...localSession,
          ...remoteSession,
          ...claimPayload,
          judgeName: remoteSession.judgeName || judge.name || "",
        }))
        .eq("class_id", classId)
        .eq("judge_id", judge.id)
        .or(`claimed_by.is.null,claimed_by.eq.${user.id}`)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const claimedSession = await loadJudgeScoringSessionRepository(
          classId,
          judge
        );
        return {
          ok: !sessionClaimedByOther(claimedSession, user),
          reason: sessionClaimedByOther(claimedSession, user)
            ? "claimed-by-other"
            : null,
          session: claimedSession,
        };
      }

      const session = toJudgeScoringSession(data, { classId, judge });
      saveJudgeScoringSessionLocal(classId, judge.id, session);
      return { ok: true, session };
    }

    const { data, error } = await supabase
      .from("show_score_judge_sessions")
      .insert(
        toJudgeScoringSessionRow({
          ...localSession,
          ...claimPayload,
          judgeName: localSession.judgeName || judge.name || "",
        })
      )
      .select("*")
      .maybeSingle();

    if (error) throw error;

    const session = toJudgeScoringSession(data, { classId, judge });
    saveJudgeScoringSessionLocal(classId, judge.id, session);
    return { ok: true, session };
  } catch (error) {
    console.error("Erreur réservation session juge Supabase:", error);

    try {
      const remoteSession = await fetchRemoteJudgeScoringSession(classId, judge);

      if (sessionClaimedByOther(remoteSession, user)) {
        return {
          ok: false,
          reason: "claimed-by-other",
          session: remoteSession,
        };
      }

      if (sessionClaimedByUser(remoteSession, user)) {
        saveJudgeScoringSessionLocal(classId, judge.id, remoteSession);
        return {
          ok: true,
          session: remoteSession,
        };
      }
    } catch (reloadError) {
      console.error("Erreur relecture session juge Supabase:", reloadError);
    }

    if (sessionClaimedByUser(localSession, user)) {
      const nextLocalSession = saveJudgeScoringSessionLocal(classId, judge.id, {
        ...localSession,
        ...claimPayload,
        judgeName: localSession.judgeName || judge.name || "",
      });

      return {
        ok: true,
        session: nextLocalSession,
        isLocalFallback: true,
      };
    }

    return {
      ok: false,
      reason: "sync-error",
      session: localSession,
    };
  }
}

export async function saveJudgeScoringSessionRepository({
  classId,
  judge,
  updates,
  debounceMs = 0,
  onStatusChange = null,
}) {
  const current = loadJudgeScoringSessionLocal(classId, judge);
  const next = saveJudgeScoringSessionLocal(classId, judge.id, {
    ...current,
    ...updates,
    judgeName: updates?.judgeName || current.judgeName || judge.name || "",
  });
  const normalized = normalizeJudgeScoringSession(next);
  const syncOptions = {
    classId,
    judgeId: judge.id,
    onStatusChange,
  };

  queueJudgeScoringSessionMutation(normalized);
  notifyJudgeSessionSyncStatus(syncOptions, classId, SCORING_SYNC_STATUS.LOCAL);

  try {
    if (debounceMs > 0) {
      await scheduleJudgeScoringSessionSyncQueue({
        ...syncOptions,
        delayMs: debounceMs,
      });
    } else {
      await flushJudgeScoringSessionSyncQueue(syncOptions);
    }

    return loadJudgeScoringSessionLocal(classId, judge);
  } catch (error) {
    notifyJudgeSessionSyncStatus(syncOptions, classId, SCORING_SYNC_STATUS.PENDING);
    return normalized;
  }
}

export async function releaseJudgeScoringSessionRepository({
  classId,
  judge,
}) {
  return saveJudgeScoringSessionRepository({
    classId,
    judge,
    updates: {
      claimedBy: null,
      claimedByEmail: null,
      claimedAt: null,
    },
  });
}
