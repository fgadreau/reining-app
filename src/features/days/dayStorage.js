import { days as mockDays } from "../../data/mock/days";

const STORAGE_KEY = "reining_days_v1";

function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mockDays;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : mockDays;
  } catch (error) {
    console.error("Erreur lecture day storage:", error);
    return mockDays;
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Erreur sauvegarde day storage:", error);
  }
}

export function saveDays(data) {
  saveAll(Array.isArray(data) ? data : []);
}

export function createDay(newDay) {
  const all = getAll();
  saveAll([...all, newDay]);
}

export function updateDay(dayId, updates) {
  const all = getAll();
  const next = all.map((item) =>
    item.id === dayId ? { ...item, ...updates } : item
  );
  saveAll(next);
}

export function deleteDay(dayId) {
  const all = getAll();
  const next = all.filter((item) => item.id !== dayId);
  saveAll(next);
}
