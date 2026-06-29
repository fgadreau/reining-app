import {
  getClassActiveManoeuvreStorageKey,
  getClassScoringRunsStorageKey,
} from "../../utils/classLocalStorage";

export function loadScoringRuns(classId) {
  try {
    const raw = localStorage.getItem(getClassScoringRunsStorageKey(classId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erreur lecture scoring runs:", error);
    return [];
  }
}

export function saveScoringRuns(classId, runs) {
  try {
    localStorage.setItem(
      getClassScoringRunsStorageKey(classId),
      JSON.stringify(Array.isArray(runs) ? runs : [])
    );
  } catch (error) {
    console.error("Erreur sauvegarde runs bloc:", error);
  }
}

export function loadActiveManoeuvre(classId) {
  try {
    const raw = localStorage.getItem(getClassActiveManoeuvreStorageKey(classId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      parsed &&
      ((typeof parsed.draw === "number" &&
        typeof parsed.manoeuvreIndex === "number") ||
        parsed.type === "drag")
    ) {
      return parsed;
    }

    return null;
  } catch (error) {
    console.error("Erreur chargement manoeuvre active:", error);
    return null;
  }
}

export function saveActiveManoeuvre(classId, activeManoeuvre) {
  try {
    localStorage.setItem(
      getClassActiveManoeuvreStorageKey(classId),
      JSON.stringify(activeManoeuvre ?? null)
    );
  } catch (error) {
    console.error("Erreur sauvegarde manoeuvre active:", error);
  }
}

export function clearScoringData(classId) {
  try {
    localStorage.removeItem(getClassScoringRunsStorageKey(classId));
    localStorage.removeItem(getClassActiveManoeuvreStorageKey(classId));
  } catch (error) {
    console.error("Erreur suppression données scoring:", error);
  }
}
