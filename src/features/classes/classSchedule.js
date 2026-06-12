const MAX_NOTE_LENGTH = 180;
export const CLASS_START_MODE_AFTER_PREVIOUS = "after_previous";
export const CLASS_START_MODE_FIXED = "fixed";

const VALID_START_MODES = new Set([
  CLASS_START_MODE_AFTER_PREVIOUS,
  CLASS_START_MODE_FIXED,
]);
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/;

export function normalizeClassStartMode(value) {
  return VALID_START_MODES.has(value) ? value : CLASS_START_MODE_AFTER_PREVIOUS;
}

export function normalizeClassStartTime(value) {
  const text = String(value || "").trim();
  return CLOCK_TIME_PATTERN.test(text) ? text.slice(0, 5) : "";
}

function getScheduleComparableSource(item = {}) {
  return item?.classItem || item?.classRecord || item?.warmup || item?.item || item;
}

export function getScheduleSortStartTime(item = {}) {
  const source = getScheduleComparableSource(item);
  const rawStartMode =
    source?.scheduleStartMode ||
    source?.schedule_start_mode ||
    source?.startMode ||
    source?.start_mode ||
    "";
  const rawStartTime =
    source?.scheduleStartTime ||
    source?.schedule_start_time ||
    source?.scheduled_time ||
    source?.startTime ||
    source?.start_time ||
    "";
  const startTime = normalizeClassStartTime(rawStartTime);
  const startMode = rawStartMode
    ? normalizeClassStartMode(rawStartMode)
    : startTime
      ? CLASS_START_MODE_FIXED
      : CLASS_START_MODE_AFTER_PREVIOUS;

  return startMode === CLASS_START_MODE_FIXED ? startTime : "";
}

function getScheduleSortOrder(item = {}) {
  const source = getScheduleComparableSource(item);
  const value = source?.sortOrder ?? source?.sort_order ?? item?.sortOrder ?? item?.sort_order;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getScheduleSortName(item = {}) {
  const source = getScheduleComparableSource(item);
  return String(source?.className || source?.name || item?.className || item?.name || "");
}

function compareScheduleItemsByOrder(first, second) {
  return (
    getScheduleSortOrder(first) - getScheduleSortOrder(second) ||
    getScheduleSortName(first).localeCompare(getScheduleSortName(second))
  );
}

export function compareScheduleItemsByStart(first, second) {
  const firstStartTime = getScheduleSortStartTime(first);
  const secondStartTime = getScheduleSortStartTime(second);

  if (firstStartTime && secondStartTime && firstStartTime !== secondStartTime) {
    return firstStartTime.localeCompare(secondStartTime);
  }

  if (firstStartTime && !secondStartTime) {
    return -1;
  }

  if (!firstStartTime && secondStartTime) {
    return 1;
  }

  return compareScheduleItemsByOrder(first, second);
}

function getScheduleItemType(item = {}) {
  const source = getScheduleComparableSource(item);
  return String(item?.itemType || item?.type || source?.itemType || source?.type || "");
}

function isPaidWarmupScheduleItem(item = {}) {
  return ["paid_warmup", "paidWarmup"].includes(getScheduleItemType(item));
}

export function compareMixedScheduleItemsByStart(first, second) {
  const includesPaidWarmup =
    isPaidWarmupScheduleItem(first) || isPaidWarmupScheduleItem(second);

  if (!includesPaidWarmup) {
    return compareScheduleItemsByStart(first, second);
  }

  const firstStartTime = getScheduleSortStartTime(first);
  const secondStartTime = getScheduleSortStartTime(second);

  if (firstStartTime && secondStartTime && firstStartTime !== secondStartTime) {
    return firstStartTime.localeCompare(secondStartTime);
  }

  return compareScheduleItemsByOrder(first, second);
}

export function normalizeClassScheduleStart(input = {}) {
  const source = input || {};
  const setupStartMode = normalizeClassStartMode(
    source.startMode || source.start_mode
  );
  const classStartMode = normalizeClassStartMode(
    source.scheduleStartMode || source.schedule_start_mode
  );
  const startMode =
    setupStartMode === CLASS_START_MODE_FIXED
      ? setupStartMode
      : classStartMode;
  const setupStartTime = source.startTime || source.start_time;
  const classStartTime = source.scheduleStartTime || source.schedule_start_time;

  return {
    startMode,
    startTime:
      startMode === CLASS_START_MODE_FIXED
        ? normalizeClassStartTime(
            setupStartMode === CLASS_START_MODE_FIXED
              ? setupStartTime || classStartTime
              : classStartTime || setupStartTime
          )
        : "",
  };
}

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
  const { startMode, startTime } = normalizeClassScheduleStart(details);

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
    startMode,
    startTime,
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
      normalized.note.trim() ||
      normalized.startMode === CLASS_START_MODE_FIXED
  );
}
