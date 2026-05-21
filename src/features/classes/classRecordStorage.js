const STORAGE_KEY = "reining_class_records_v1";

function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (e) {
    console.error("Erreur lecture class records:", e);
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Erreur sauvegarde class records:", e);
  }
}

function getDefaultRecord(classId) {
  return {
    id: classId,
    official: {
      judgeName: "",
      judgeSignature: null,
      finalized: false,
      finalizedAt: null,
      judgeSignedAt: null,
      secretariatValidatedAt: null,
      finalPdfFileName: null,
      officialRuns: [],
    },
  };
}

export function getClassRecord(classId) {
  const all = getAll();
  return all[classId] || getDefaultRecord(classId);
}

export function saveClassRecord(classId, updates) {
  const all = getAll();
  const current = all[classId] || getDefaultRecord(classId);

  const next = {
    ...all,
    [classId]: {
      ...current,
      ...updates,
      official: {
        ...current.official,
        ...(updates.official || {}),
      },
    },
  };

  saveAll(next);
}

export function deleteClassRecord(classId) {
  const all = getAll();
  const next = { ...all };
  delete next[classId];
  saveAll(next);
}
