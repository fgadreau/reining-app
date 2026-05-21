import { classes as mockClasses } from "../../data/mock/classes";

const STORAGE_KEY = "reining_classes_v1";

function loadClassesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return mockClasses;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return mockClasses;

    return parsed;
  } catch (error) {
    console.error("Erreur lecture classes:", error);
    return mockClasses;
  }
}

export function getAllClasses() {
  return loadClassesFromStorage();
}

export function getClassById(classId) {
  return loadClassesFromStorage().find((item) => item.id === classId) || null;
}

export function getClassesByDayId(dayId) {
  return loadClassesFromStorage().filter((item) => item.dayId === dayId);
}