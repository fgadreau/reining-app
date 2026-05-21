import { clearScoringData } from "../scoring/scoringStorage";
import { deleteClassRecord } from "./classRecordStorage";
import { deleteClassSetup } from "./classSetupStorage";

const STORAGE_KEY = "reining_classes_v1";

function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erreur lecture class storage:", error);
    return [];
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Erreur sauvegarde class storage:", error);
  }
}

export function saveClasses(data) {
  saveAll(Array.isArray(data) ? data.map(stripLegacyStatus) : []);
}

function stripLegacyStatus(classItem) {
  if (!classItem) return classItem;

  const { status, ...rest } = classItem;
  return rest;
}

export function createClass(newClass) {
  const all = getAll();
  saveAll([...all, stripLegacyStatus(newClass)]);
}

export function updateClass(classId, updates) {
  const all = getAll();
  const cleanUpdates = stripLegacyStatus(updates);

  const next = all.map((item) =>
    item.id === classId ? { ...item, ...cleanUpdates } : item
  );

  saveAll(next);
}

export function deleteClass(classId) {
  const all = getAll();
  const next = all.filter((item) => item.id !== classId);
  saveAll(next);
  deleteClassSetup(classId);
  deleteClassRecord(classId);
  clearScoringData(classId);
}
