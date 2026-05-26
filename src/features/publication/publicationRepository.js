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

export const SCORE_VISIBLE_PUBLICATION_STATUSES = [
  PUBLICATION_STATUSES.LIVE,
  PUBLICATION_STATUSES.LIVE_SCORING,
  PUBLICATION_STATUSES.LIVE_FINISHED,
  PUBLICATION_STATUSES.OFFICIAL,
  PUBLICATION_STATUSES.PUBLISHED,
];

export function isLivePublicationStatus(status) {
  return LIVE_PUBLICATION_STATUSES.includes(status);
}

export function canPublicationStatusShowScores(status) {
  return SCORE_VISIBLE_PUBLICATION_STATUSES.includes(status);
}

export function getPublicationStatusLabel(status) {
  switch (status) {
    case PUBLICATION_STATUSES.LIVE:
      return "Live";
    case PUBLICATION_STATUSES.LIVE_NO_SCORE:
      return "Live sans scores";
    case PUBLICATION_STATUSES.LIVE_SCORING:
      return "Live avec scores";
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
    visibleFields: DEFAULT_VISIBLE_FIELDS,
  };
}

export function getPublicationState(classId) {
  const all = loadAllPublicationStates();
  return {
    ...getDefaultPublicationState(classId),
    ...(all[classId] || {}),
  };
}

export function savePublicationState(classId, updates) {
  const all = loadAllPublicationStates();
  const current = getPublicationState(classId);

  const next = {
    ...current,
    ...updates,
    classId,
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
