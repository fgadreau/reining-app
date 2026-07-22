import { shows as mockShows } from "../../data/mock/shows";

const STORAGE_KEY = "reining_shows_v1";

function normalizeShow(show) {
  return {
    ...show,
    livestreamUrl: show?.livestreamUrl || "",
    isLivestreamPublic: Boolean(show?.isLivestreamPublic),
    isSchedulePublic: Boolean(show?.isSchedulePublic),
    isTvDisplayPaused: Boolean(show?.isTvDisplayPaused),
    tvDisplayMessageFr: show?.tvDisplayMessageFr || "",
    tvDisplayMessageEn: show?.tvDisplayMessageEn || "",
    tvDisplayVideoPath: show?.tvDisplayVideoPath || "",
    tvDisplayVideoName: show?.tvDisplayVideoName || "",
    tvDisplayVideoSize: Number(show?.tvDisplayVideoSize || 0),
    tvDisplayVideoArena: show?.tvDisplayVideoArena || "",
  };
}

function loadShowsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mockShows.map(normalizeShow);

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return mockShows.map(normalizeShow);

    return parsed.map(normalizeShow);
  } catch (error) {
    console.error("Erreur lecture shows:", error);
    return mockShows.map(normalizeShow);
  }
}

export function getAllShows() {
  return loadShowsFromStorage();
}

export function getShowsByAssociationId(associationId) {
  return loadShowsFromStorage().filter(
    (show) => show.associationId === associationId
  );
}

export function getShowById(showId) {
  return loadShowsFromStorage().find((show) => show.id === showId) || null;
}
