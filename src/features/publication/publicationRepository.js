const STORAGE_KEY = "reining_publication_states_v1";

const DEFAULT_VISIBLE_FIELDS = [
  "draw",
  "backNumber",
  "rider",
  "horse",
  "owner",
  "scoreTotal",
  "status",
];

export const PUBLICATION_STATUSES = {
  HIDDEN: "hidden",
  LIVE: "live",
  LIVE_NO_SCORE: "live_no_score",
  LIVE_SCORING: "live_scoring",
  LIVE_FINISHED: "live_finished",
  OFFICIAL: "official",
  PUBLISHED: "published",
};

export const LIVE_PUBLICATION_STATUSES = [
  PUBLICATION_STATUSES.LIVE,
  PUBLICATION_STATUSES.LIVE_NO_SCORE,
  PUBLICATION_STATUSES.LIVE_SCORING,
  PUBLICATION_STATUSES.LIVE_FINISHED,
];

export const PLANNED_LIVE_PUBLICATION_STATUSES = [
  PUBLICATION_STATUSES.HIDDEN,
  PUBLICATION_STATUSES.LIVE_NO_SCORE,
  PUBLICATION_STATUSES.LIVE_SCORING,
  PUBLICATION_STATUSES.LIVE,
];

export const SCORE_VISIBLE_PUBLICATION_STATUSES = [
  PUBLICATION_STATUSES.LIVE,
  PUBLICATION_STATUSES.LIVE_SCORING,
  PUBLICATION_STATUSES.LIVE_FINISHED,
  PUBLICATION_STATUSES.OFFICIAL,
  PUBLICATION_STATUSES.PUBLISHED,
];

export const LIVE_SCORE_DISPLAY_MODES = {
  HIDDEN: "hidden",
  COMPLETED_TOTAL: "completed_total",
  FULL_DETAILS: "full_details",
};

export function isLivePublicationStatus(status) {
  return LIVE_PUBLICATION_STATUSES.includes(status);
}

export function normalizePlannedLiveStatus(
  status,
  fallback = PUBLICATION_STATUSES.HIDDEN
) {
  const normalizedStatus =
    status === PUBLICATION_STATUSES.LIVE_FINISHED
      ? PUBLICATION_STATUSES.LIVE_SCORING
      : status;

  return PLANNED_LIVE_PUBLICATION_STATUSES.includes(normalizedStatus)
    ? normalizedStatus
    : fallback;
}

export function getPlannedLiveStatus(
  publication,
  fallback = PUBLICATION_STATUSES.LIVE_SCORING
) {
  const plannedStatus = normalizePlannedLiveStatus(
    publication?.plannedLiveStatus,
    null
  );

  if (plannedStatus) return plannedStatus;

  return isLivePublicationStatus(publication?.status)
    ? normalizePlannedLiveStatus(publication.status, fallback)
    : fallback;
}

export function canPublicationStatusShowScores(status) {
  return SCORE_VISIBLE_PUBLICATION_STATUSES.includes(status);
}

export function getLiveScoreDisplayMode(status) {
  if (status === PUBLICATION_STATUSES.LIVE_NO_SCORE) {
    return LIVE_SCORE_DISPLAY_MODES.HIDDEN;
  }

  if (status === PUBLICATION_STATUSES.LIVE_SCORING) {
    return LIVE_SCORE_DISPLAY_MODES.COMPLETED_TOTAL;
  }

  if (
    status === PUBLICATION_STATUSES.LIVE ||
    status === PUBLICATION_STATUSES.LIVE_FINISHED
  ) {
    return LIVE_SCORE_DISPLAY_MODES.FULL_DETAILS;
  }

  return canPublicationStatusShowScores(status)
    ? LIVE_SCORE_DISPLAY_MODES.FULL_DETAILS
    : LIVE_SCORE_DISPLAY_MODES.HIDDEN;
}

export function getPublicationStatusLabel(status) {
  switch (status) {
    case PUBLICATION_STATUSES.LIVE:
      return "Live détaillé";
    case PUBLICATION_STATUSES.LIVE_NO_SCORE:
      return "Live sans scores";
    case PUBLICATION_STATUSES.LIVE_SCORING:
      return "Live scores complétés";
    case PUBLICATION_STATUSES.LIVE_FINISHED:
      return "Live terminé";
    case PUBLICATION_STATUSES.OFFICIAL:
      return "Officiel";
    case PUBLICATION_STATUSES.PUBLISHED:
      return "Publié";
    case PUBLICATION_STATUSES.HIDDEN:
    default:
      return "Masqué";
  }
}

export function loadAllPublicationStates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture publication states:", error);
    return {};
  }
}

export function saveAllPublicationStates(states) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch (error) {
    console.error("Erreur sauvegarde publication states:", error);
  }
}

export function getDefaultPublicationState(classId) {
  return {
    classId,
    status: PUBLICATION_STATUSES.HIDDEN,
    publishedAt: null,
    publishedBy: null,
    publicUrl: null,
    plannedLiveStatus: PUBLICATION_STATUSES.LIVE_SCORING,
    visibleFields: DEFAULT_VISIBLE_FIELDS,
  };
}

export function getPublicationState(classId) {
  const all = loadAllPublicationStates();
  const storedState = all[classId] || {};
  const defaultState = getDefaultPublicationState(classId);

  return {
    ...defaultState,
    ...storedState,
    plannedLiveStatus: storedState.plannedLiveStatus
      ? normalizePlannedLiveStatus(storedState.plannedLiveStatus)
      : isLivePublicationStatus(storedState.status)
        ? normalizePlannedLiveStatus(storedState.status)
        : defaultState.plannedLiveStatus,
  };
}

export function savePublicationState(classId, updates) {
  const all = loadAllPublicationStates();
  const current = getPublicationState(classId);

  const next = {
    ...current,
    ...updates,
    classId,
    plannedLiveStatus: normalizePlannedLiveStatus(
      updates?.plannedLiveStatus,
      current.plannedLiveStatus
    ),
    visibleFields: Array.isArray(updates?.visibleFields)
      ? updates.visibleFields
      : current.visibleFields,
  };

  saveAllPublicationStates({
    ...all,
    [classId]: next,
  });

  return next;
}

export function publishClass(classId, publishedBy = null) {
  return savePublicationState(classId, {
    status: PUBLICATION_STATUSES.PUBLISHED,
    publishedAt: new Date().toISOString(),
    publishedBy,
  });
}

export function unpublishClass(classId) {
  return savePublicationState(classId, {
    status: PUBLICATION_STATUSES.HIDDEN,
    publishedAt: null,
    publishedBy: null,
  });
}

export function deletePublicationState(classId) {
  const all = loadAllPublicationStates();
  const next = { ...all };
  delete next[classId];
  saveAllPublicationStates(next);
}
