export const CHAMPIONSHIP_CLASS_NOTE_MAX_LENGTH = 500;

export function normalizeChampionshipClassNotes(source = {}) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(source)
      .map(([classId, note]) => [
        String(classId || "").trim().slice(0, 200),
        String(note || "")
          .trim()
          .slice(0, CHAMPIONSHIP_CLASS_NOTE_MAX_LENGTH),
      ])
      .filter(([classId, note]) => classId && note)
  );
}

export function getChampionshipClassNote(source, classId) {
  const notes = normalizeChampionshipClassNotes(source);
  return notes[String(classId || "").trim()] || "";
}
