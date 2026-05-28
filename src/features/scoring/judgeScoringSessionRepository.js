import { getSupabaseClient } from "../cloud/supabaseClient";
import {
  loadJudgeScoringSessionLocal,
  loadJudgeScoringSessionsForClassLocal,
  normalizeJudgeScoringSession,
  saveJudgeScoringSessionLocal,
} from "./judgeScoringSessionStorage";

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

async function fetchRemoteJudgeScoringSession(classId, judge) {
  const supabase = getSupabaseClient();

  if (!supabase || !classId || !judge?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("judge_scoring_sessions")
    .select("*")
    .eq("class_id", classId)
    .eq("judge_id", judge.id)
    .maybeSingle();

  if (error) throw error;
  return data ? toJudgeScoringSession(data, { classId, judge }) : null;
}

export function isJudgeSessionClaimedByOther(session, user) {
  return sessionClaimedByOther(session, user);
}

export async function loadJudgeScoringSessionRepository(classId, judge) {
  const localSession = loadJudgeScoringSessionLocal(classId, judge);
  const supabase = getSupabaseClient();

  if (!supabase || !classId || !judge?.id) {
    return localSession;
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

  try {
    const { data, error } = await supabase
      .from("judge_scoring_sessions")
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
        .from("judge_scoring_sessions")
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
      .from("judge_scoring_sessions")
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
}) {
  const current = loadJudgeScoringSessionLocal(classId, judge);
  const next = saveJudgeScoringSessionLocal(classId, judge.id, {
    ...current,
    ...updates,
    judgeName: updates?.judgeName || current.judgeName || judge.name || "",
  });
  const supabase = getSupabaseClient();

  if (!supabase) {
    return next;
  }

  try {
    const saveQuery = next.claimedBy
      ? supabase
          .from("judge_scoring_sessions")
          .update(toJudgeScoringSessionRow(next))
          .eq("class_id", next.classId)
          .eq("judge_id", next.judgeId)
          .or(`claimed_by.is.null,claimed_by.eq.${next.claimedBy}`)
      : supabase
          .from("judge_scoring_sessions")
          .upsert(toJudgeScoringSessionRow(next));

    const { data, error } = await saveQuery.select("*").maybeSingle();

    if (error) throw error;
    if (!data) {
      const remoteSession = await fetchRemoteJudgeScoringSession(classId, judge);
      return remoteSession || next;
    }

    const saved = toJudgeScoringSession(data, { classId, judge });
    saveJudgeScoringSessionLocal(classId, judge.id, saved);
    return saved;
  } catch (error) {
    console.error("Erreur sauvegarde session juge Supabase:", error);
    return next;
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
