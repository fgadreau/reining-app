import { classes as mockClasses } from "../../data/mock/classes";
import { compareScheduleItemsByStart } from "./classSchedule";

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

function isScoringClassItem(item) {
  return !item?.isEventBlock && item?.is_event_block !== true;
}

export function getAllClasses() {
  return loadClassesFromStorage().filter(isScoringClassItem);
}

export function getClassById(classId) {
  return getAllClasses().find((item) => item.id === classId) || null;
}

export function getClassesByDayId(dayId) {
  return getAllClasses()
    .filter((item) => item.dayId === dayId)
    .sort(compareScheduleItemsByStart);
}
