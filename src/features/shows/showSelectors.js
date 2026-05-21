import { shows as mockShows } from "../../data/mock/shows";

const STORAGE_KEY = "reining_shows_v1";

function loadShowsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mockShows;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return mockShows;

    return parsed;
  } catch (error) {
    console.error("Erreur lecture shows:", error);
    return mockShows;
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