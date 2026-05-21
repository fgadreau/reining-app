import { shows as mockShows } from "../../data/mock/shows";

const STORAGE_KEY = "reining_shows_v1";

function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mockShows;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : mockShows;
  } catch (error) {
    console.error("Erreur lecture show storage:", error);
    return mockShows;
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Erreur sauvegarde show storage:", error);
  }
}

export function saveShows(data) {
  saveAll(Array.isArray(data) ? data : []);
}

export function createShow(newShow) {
  const all = getAll();
  saveAll([...all, newShow]);
}

export function updateShow(showId, updates) {
  const all = getAll();
  const next = all.map((item) =>
    item.id === showId ? { ...item, ...updates } : item
  );
  saveAll(next);
}

export function deleteShow(showId) {
  const all = getAll();
  const next = all.filter((item) => item.id !== showId);
  saveAll(next);
}
