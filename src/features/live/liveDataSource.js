export const LIVE_DATA_SOURCES = {
  SCRIBE: "scribe",
  ANNOUNCER: "announcer",
};

export const LIVE_DISPLAY_MODES = {
  FULL: "full",
  ORDER_ONLY: "order_only",
};

export function normalizeLiveDataSource(value) {
  return value === LIVE_DATA_SOURCES.ANNOUNCER
    ? LIVE_DATA_SOURCES.ANNOUNCER
    : LIVE_DATA_SOURCES.SCRIBE;
}

export function isAnnouncerLiveSource(setup = {}) {
  return (
    normalizeLiveDataSource(setup?.liveDataSource) ===
    LIVE_DATA_SOURCES.ANNOUNCER
  );
}

export function normalizeQualifiedRiderCount(value) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeLiveDisplayMode(value) {
  return value === LIVE_DISPLAY_MODES.ORDER_ONLY
    ? LIVE_DISPLAY_MODES.ORDER_ONLY
    : LIVE_DISPLAY_MODES.FULL;
}

export function resolveLiveScoringSession({
  setup = {},
  scoringSession = {},
  announcerSession = {},
} = {}) {
  const source = normalizeLiveDataSource(setup?.liveDataSource);

  if (source !== LIVE_DATA_SOURCES.ANNOUNCER) {
    return {
      source,
      session: scoringSession || {},
    };
  }

  return {
    source,
    session: {
      classId: announcerSession?.classId || scoringSession?.classId || "",
      runs: Array.isArray(announcerSession?.runs)
        ? announcerSession.runs
        : [],
      activeManoeuvre: announcerSession?.activeManoeuvre || null,
      startedAt: announcerSession?.startedAt || null,
      updatedAt: announcerSession?.updatedAt || null,
    },
  };
}
