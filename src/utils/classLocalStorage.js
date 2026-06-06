export function getClassSetupStorageKey(classId) {
  return `reining-class-setup-${classId}`;
}

export function getClassScoringRunsStorageKey(classId) {
  return `reining-scoring-runs-${classId}`;
}

export function getClassActiveManoeuvreStorageKey(classId) {
  return `reining-scoring-active-manoeuvre-${classId}`;
}

export function loadClassSetup(classId) {
  try {
    const raw = localStorage.getItem(getClassSetupStorageKey(classId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed;
  } catch (error) {
    console.error("Erreur chargement setup local de bloc:", error);
    return null;
  }
}

export function saveClassSetup(classId, runs) {
  try {
    localStorage.setItem(getClassSetupStorageKey(classId), JSON.stringify(runs));
  } catch (error) {
    console.error("Erreur sauvegarde setup local de bloc:", error);
  }
}

export function clearClassSetup(classId) {
  try {
    localStorage.removeItem(getClassSetupStorageKey(classId));
  } catch (error) {
    console.error("Erreur suppression setup local de bloc:", error);
  }
}
