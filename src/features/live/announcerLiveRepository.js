import { getSupabaseClient } from "../cloud/supabaseClient";
import { normalizeAnnouncerLiveSession } from "./announcerLiveSession";
import {
  deleteAnnouncerLiveSessionLocal,
  getAnnouncerLiveSessionLocal,
  saveAnnouncerLiveSessionLocal,
} from "./announcerLiveStorage";
import {
  ANNOUNCER_LIVE_SYNC_STATUSES,
  getAnnouncerLiveSyncFailure,
  getAnnouncerLiveSyncStatus as getQueueSyncStatus,
  getPendingAnnouncerLiveMutation,
  getQueuedAnnouncerLiveMutations,
  hasPendingAnnouncerLiveMutation,
  markAnnouncerLiveMutationAttempt,
  queueAnnouncerLiveMutation,
  removeAnnouncerLiveMutation,
} from "./announcerLiveSyncQueue";

let activeFlush = null;

function toAnnouncerLiveSession(row, classId, setupRuns = []) {
  return normalizeAnnouncerLiveSession(
    {
      classId: row?.class_id || classId,
      runs: Array.isArray(row?.runs) ? row.runs : [],
      activeManoeuvre:
        row?.active_manoeuvre && typeof row.active_manoeuvre === "object"
          ? row.active_manoeuvre
          : null,
      startedAt: row?.started_at || null,
      completedAt: row?.completed_at || null,
      completedBy: row?.completed_by || null,
      revision: row?.revision,
      updatedAt: row?.updated_at || null,
    },
    { classId, setupRuns }
  );
}

function toAnnouncerLiveRow(classId, session) {
  const normalized = normalizeAnnouncerLiveSession(session, { classId });

  return {
    class_id: classId,
    runs: normalized.runs,
    active_manoeuvre: normalized.activeManoeuvre,
    started_at: normalized.startedAt,
    completed_at: normalized.completedAt,
    completed_by: normalized.completedBy,
    revision: normalized.revision,
  };
}

async function upsertRemoteSession(classId, session) {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: "Supabase is not configured" };

  try {
    const row = toAnnouncerLiveRow(classId, session);
    const { data, error } = await supabase.rpc(
      "save_show_score_announcer_live_session",
      {
        target_class_id: row.class_id,
        target_runs: row.runs,
        target_active_manoeuvre: row.active_manoeuvre,
        target_started_at: row.started_at,
        target_completed_at: row.completed_at,
        target_completed_by: row.completed_by,
        target_revision: row.revision,
      }
    );

    if (error) throw error;
    if (data !== true) {
      throw new Error(
        "Conflit de révision du live annonceur. Recharge les données avant de continuer."
      );
    }
    return { ok: true, error: null };
  } catch (error) {
    console.error("Erreur sauvegarde live annonceur Supabase:", error);
    return {
      ok: false,
      error: error?.message || "Erreur sauvegarde live annonceur Supabase",
    };
  }
}

async function flushQueueNow({ classId = null, onStatusChange } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    if (typeof onStatusChange === "function") {
      onStatusChange(ANNOUNCER_LIVE_SYNC_STATUSES.LOCAL);
    }
    return ANNOUNCER_LIVE_SYNC_STATUSES.LOCAL;
  }

  while (true) {
    const [mutation] = getQueuedAnnouncerLiveMutations(classId);
    if (!mutation) break;

    if (typeof onStatusChange === "function") {
      onStatusChange(ANNOUNCER_LIVE_SYNC_STATUSES.SYNCING);
    }

    const result = await upsertRemoteSession(
      mutation.classId,
      mutation.session
    );

    if (!result.ok) {
      markAnnouncerLiveMutationAttempt(
        mutation.classId,
        mutation.revision,
        result.error
      );
      if (typeof onStatusChange === "function") {
        onStatusChange(ANNOUNCER_LIVE_SYNC_STATUSES.PENDING);
      }
      return ANNOUNCER_LIVE_SYNC_STATUSES.PENDING;
    }

    const current = getPendingAnnouncerLiveMutation(mutation.classId);
    if (current?.revision === mutation.revision) {
      removeAnnouncerLiveMutation(mutation.classId, mutation.revision);
    }
  }

  const status = classId
    ? getQueueSyncStatus(classId, true)
    : ANNOUNCER_LIVE_SYNC_STATUSES.SYNCED;
  if (typeof onStatusChange === "function") onStatusChange(status);
  return status;
}

export function flushAnnouncerLiveSyncQueue(options = {}) {
  if (activeFlush) {
    return activeFlush.then(() => flushAnnouncerLiveSyncQueue(options));
  }

  activeFlush = flushQueueNow(options).finally(() => {
    activeFlush = null;
  });
  return activeFlush;
}

export function getAnnouncerLiveSession(classId, setupRuns = []) {
  return getAnnouncerLiveSessionLocal(classId, setupRuns);
}

export function getAnnouncerLiveSessionSyncStatus(classId) {
  return getQueueSyncStatus(classId, Boolean(getSupabaseClient()));
}

export { getAnnouncerLiveSyncFailure };

export async function getAnnouncerLiveSessionRepository(
  classId,
  setupRuns = []
) {
  const local = getAnnouncerLiveSessionLocal(classId, setupRuns);
  const supabase = getSupabaseClient();
  if (!supabase) return local;

  if (hasPendingAnnouncerLiveMutation(classId)) {
    await flushAnnouncerLiveSyncQueue({ classId });
    if (hasPendingAnnouncerLiveMutation(classId)) return local;
  }

  try {
    const { data, error } = await supabase
      .from("show_score_announcer_live_sessions")
      .select("*")
      .eq("class_id", classId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return local;

    const session = toAnnouncerLiveSession(data, classId, setupRuns);
    saveAnnouncerLiveSessionLocal(classId, session, setupRuns);
    return session;
  } catch (error) {
    console.error("Erreur chargement live annonceur Supabase:", error);
    return local;
  }
}

export async function saveAnnouncerLiveSessionRepository(
  classId,
  session,
  { setupRuns = [], onStatusChange } = {}
) {
  const normalized = saveAnnouncerLiveSessionLocal(
    classId,
    session,
    setupRuns
  );
  queueAnnouncerLiveMutation(classId, normalized);
  if (typeof onStatusChange === "function") {
    onStatusChange(ANNOUNCER_LIVE_SYNC_STATUSES.LOCAL);
  }
  await flushAnnouncerLiveSyncQueue({ classId, onStatusChange });
  return normalized;
}

export async function deleteAnnouncerLiveSessionRepository(classId) {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { error } = await supabase
        .from("show_score_announcer_live_sessions")
        .delete()
        .eq("class_id", classId);
      if (error) throw error;
    } catch (error) {
      console.error("Erreur suppression live annonceur Supabase:", error);
    }
  }

  deleteAnnouncerLiveSessionLocal(classId);
  removeAnnouncerLiveMutation(classId);
}
