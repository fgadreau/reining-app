import { getJudgeDisplayName } from "../classes/classJudges";

const STORAGE_KEY = "showscore_judge_scoring_sessions_v1";

function getSessionKey(classId, judgeId) {
  return `${classId || ""}:${judgeId || ""}`;
}

function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture sessions de juges:", error);
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Erreur sauvegarde sessions de juges:", error);
  }
}

export function normalizeJudgeScoringSession(session = {}, options = {}) {
  const judge = options.judge || {};
  const classId = session.classId || options.classId || "";
  const judgeId = session.judgeId || judge.id || "";

  return {
    classId,
    judgeId,
    judgeName:
      String(session.judgeName || judge.name || "").trim() ||
      getJudgeDisplayName(judge, Math.max(Number(judge.order || 1) - 1, 0)),
    claimedBy: session.claimedBy || null,
    claimedByEmail: session.claimedByEmail || null,
    claimedAt: session.claimedAt || null,
    runs: Array.isArray(session.runs) ? session.runs : [],
    activeManoeuvre:
      session.activeManoeuvre && typeof session.activeManoeuvre === "object"
        ? session.activeManoeuvre
        : null,
    judgeSignature: session.judgeSignature || null,
    finalized: Boolean(session.finalized),
    finalizedAt: session.finalizedAt || null,
    judgeSignedAt: session.judgeSignedAt || null,
    updatedAt: session.updatedAt || null,
  };
}

export function loadJudgeScoringSessionLocal(classId, judge) {
  const all = getAll();
  const session = all[getSessionKey(classId, judge?.id)];
  return normalizeJudgeScoringSession(session, { classId, judge });
}

export function loadJudgeScoringSessionsForClassLocal(classId, judges = []) {
  const all = getAll();
  const sessionsByJudgeId = new Map();

  Object.values(all).forEach((session) => {
    if (session?.classId === classId && session?.judgeId) {
      sessionsByJudgeId.set(
        session.judgeId,
        normalizeJudgeScoringSession(session, { classId })
      );
    }
  });

  return judges.map((judge) => {
    const session = sessionsByJudgeId.get(judge?.id);
    return session
      ? normalizeJudgeScoringSession(session, { classId, judge })
      : loadJudgeScoringSessionLocal(classId, judge);
  });
}

export function saveJudgeScoringSessionLocal(classId, judgeId, updates) {
  const all = getAll();
  const key = getSessionKey(classId, judgeId);
  const current = all[key] || { classId, judgeId };
  const next = normalizeJudgeScoringSession({
    ...current,
    ...updates,
    classId,
    judgeId,
    updatedAt: updates?.updatedAt || new Date().toISOString(),
  });

  all[key] = next;
  saveAll(all);
  return next;
}

export function deleteJudgeScoringSessionsLocal(classId) {
  const all = getAll();
  const next = {};

  Object.entries(all).forEach(([key, value]) => {
    if (value?.classId !== classId) {
      next[key] = value;
    }
  });

  saveAll(next);
}
