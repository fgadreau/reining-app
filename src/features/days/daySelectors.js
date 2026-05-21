import { days as mockDays } from "../../data/mock/days";

const STORAGE_KEY = "reining_days_v1";

function loadDaysFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mockDays;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return mockDays;

    return parsed;
  } catch (error) {
    console.error("Erreur lecture days:", error);
    return mockDays;
  }
}

export function getAllDays() {
  return loadDaysFromStorage();
}

export function getDaysByShowId(showId) {
  return loadDaysFromStorage()
    .filter((day) => day.showId === showId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export function getDayById(dayId) {
  return loadDaysFromStorage().find((day) => day.id === dayId) || null;
}