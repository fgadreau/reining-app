import { normalizeAnnouncerLiveSession } from "./announcerLiveSession";

const STORAGE_KEY = "showscore_announcer_live_sessions_v1";

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture sessions live annonceur:", error);
    return {};
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions || {}));
  } catch (error) {
    console.error("Erreur sauvegarde sessions live annonceur:", error);
  }
}

export function getAnnouncerLiveSessionLocal(classId, setupRuns = []) {
  const sessions = loadSessions();
  return normalizeAnnouncerLiveSession(sessions[classId], {
    classId,
    setupRuns,
  });
}

export function saveAnnouncerLiveSessionLocal(
  classId,
  session,
  setupRuns = []
) {
  const sessions = loadSessions();
  const normalized = normalizeAnnouncerLiveSession(session, {
    classId,
    setupRuns,
  });

  sessions[classId] = normalized;
  saveSessions(sessions);
  return normalized;
}

export function deleteAnnouncerLiveSessionLocal(classId) {
  const sessions = loadSessions();
  delete sessions[classId];
  saveSessions(sessions);
}
