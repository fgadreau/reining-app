const MAX_NOTE_LENGTH = 180;

function normalizePositiveIntegerText(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

function normalizeCompletedSectionCount(value, sectionCount) {
  const parsed = Number.parseInt(value, 10);
  const max = Number.parseInt(sectionCount, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Number.isFinite(max) && max > 0 ? Math.min(parsed, max) : parsed;
}

export function normalizeClassScheduleDetails(details = {}) {
  const participantCount = normalizePositiveIntegerText(details.participantCount);
  const sectionCount = normalizePositiveIntegerText(details.sectionCount);
  const sectionSize = normalizePositiveIntegerText(details.sectionSize);
  const hasFinal = Boolean(details.hasFinal);
  const isCompleted = Boolean(details.isCompleted);

  return {
    participantCount,
    sectionCount,
    sectionSize,
    completedSectionCount: normalizeCompletedSectionCount(
      details.completedSectionCount,
      sectionCount
    ),
    hasFinal,
    finalCompleted: hasFinal && Boolean(details.finalCompleted),
    isCompleted,
    completedAt: isCompleted ? details.completedAt || null : null,
    note: String(details.note || "").slice(0, MAX_NOTE_LENGTH),
  };
}

export function hasClassScheduleDetails(details = {}) {
  const normalized = normalizeClassScheduleDetails(details);
  return Boolean(
    normalized.participantCount ||
      normalized.sectionCount ||
      normalized.sectionSize ||
      normalized.completedSectionCount > 0 ||
      normalized.hasFinal ||
      normalized.finalCompleted ||
      normalized.isCompleted ||
      normalized.note.trim()
  );
}
