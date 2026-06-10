import {
  getPatternDisplayName,
  getPatternHeaders,
  isNoPatternValue,
} from "../patterns/patternDefinitions";
import {
  calculateClassTimingSummary,
  getRunDurationSeconds,
  isMeasuredRunDurationUsable,
} from "./classTiming";
import {
  CLASS_START_MODE_AFTER_PREVIOUS,
  CLASS_START_MODE_FIXED,
  normalizeClassScheduleDetails,
} from "./classSchedule";

export function getClassPatternValue(classData) {
  const patternValue = String(
    classData?.setup?.pattern || classData?.classItem?.pattern || ""
  ).trim();
  const customPattern =
    classData?.setup?.customPattern || classData?.classItem?.customPattern || null;
  return getPatternDisplayName(patternValue, customPattern) || patternValue;
}

function getClassPatternRawValue(classData) {
  return String(
    classData?.setup?.pattern || classData?.classItem?.pattern || ""
  ).trim();
}

function getClassCustomPattern(classData) {
  return classData?.setup?.customPattern || classData?.classItem?.customPattern || null;
}

export function getClassRunCount(classData) {
  const setupRuns = classData?.setup?.runs;
  const scoringRuns = classData?.scoringRuns;
  const scheduleDetails = normalizeClassScheduleDetails(
    classData?.setup?.scheduleDetails
  );
  const scheduleParticipantCount = Number.parseInt(
    scheduleDetails.participantCount,
    10
  );

  if (Array.isArray(setupRuns) && setupRuns.length) return setupRuns.length;
  if (Array.isArray(scoringRuns) && scoringRuns.length) return scoringRuns.length;
  if (
    isNoPatternValue(getClassPatternRawValue(classData)) &&
    Number.isFinite(scheduleParticipantCount) &&
    scheduleParticipantCount > 0
  ) {
    return scheduleParticipantCount;
  }
  return 0;
}

export function getClassScoringRuns(classData) {
  return Array.isArray(classData?.scoringRuns) ? classData.scoringRuns : [];
}

export function getClassManeuverCount(classData) {
  return getPatternHeaders(
    getClassPatternRawValue(classData),
    getClassCustomPattern(classData)
  ).length;
}

export function getMedianSeconds(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!sorted.length) return null;

  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function getAverageSeconds(values) {
  const cleanValues = values.filter((value) => Number.isFinite(value) && value > 0);

  if (!cleanValues.length) return null;

  return (
    cleanValues.reduce((total, value) => total + value, 0) / cleanValues.length
  );
}

export function buildPatternTimingStats(classRows) {
  const groups = new Map();

  classRows.forEach((classData) => {
    const pattern = getClassPatternValue(classData) || "Sans pattern";
    const runs = getClassScoringRuns(classData);
    const durations = runs
      .map(getRunDurationSeconds)
      .filter(isMeasuredRunDurationUsable);

    if (!groups.has(pattern)) {
      groups.set(pattern, {
        pattern,
        classIds: new Set(),
        durations: [],
        runCount: 0,
      });
    }

    const group = groups.get(pattern);
    if (classData?.classItem?.id) {
      group.classIds.add(classData.classItem.id);
    }
    group.durations.push(...durations);
    group.runCount += runs.length;
  });

  return Array.from(groups.values())
    .map((group) => ({
      pattern: group.pattern,
      classCount: group.classIds.size,
      runCount: group.runCount,
      timedRunCount: group.durations.length,
      averageRunSeconds: getAverageSeconds(group.durations),
      medianRunSeconds: getMedianSeconds(group.durations),
    }))
    .sort((a, b) => String(a.pattern).localeCompare(String(b.pattern)));
}

export function buildClassTimingRow({
  classData,
  day,
  now = new Date(),
  patternAverageRunSeconds = null,
}) {
  const pattern = getClassPatternValue(classData);
  const scheduleDetails = normalizeClassScheduleDetails(
    classData?.setup?.scheduleDetails
  );
  const maneuverCount = getClassManeuverCount(classData);
  const runs = getClassScoringRuns(classData);
  const runCount = getClassRunCount(classData);
  const placeholderRuns =
    runs.length >= runCount
      ? runs
      : [
          ...runs,
          ...Array.from({ length: runCount - runs.length }, () => ({
            scores: [],
            penalties: [],
          })),
        ];
  const summary = calculateClassTimingSummary({
    runs: placeholderRuns,
    maneuverCount,
    startedAt: classData?.setup?.startedAt,
    dragInterval: classData?.setup?.dragInterval,
    dragDurationMinutes: classData?.setup?.dragDurationMinutes,
    now,
  });
  const averageRunSeconds =
    summary.averageRunSeconds ?? patternAverageRunSeconds ?? null;
  const remainingSeconds =
    summary.remainingSeconds ??
    (averageRunSeconds == null
      ? null
      : summary.remainingRuns * averageRunSeconds +
        summary.remainingDragBreaks * summary.dragDurationMinutes * 60);
  const estimatedEndAt =
    remainingSeconds == null
      ? null
      : new Date(now.getTime() + remainingSeconds * 1000).toISOString();

  return {
    classId: classData?.classItem?.id,
    className: classData?.classItem?.name || "Bloc sans nom",
    dayLabel: day?.label || "Journée",
    dayDate: day?.date || "",
    pattern: pattern || "—",
    runCount,
    completedRuns: summary.completedRuns,
    remainingRuns: summary.remainingRuns,
    averageRunSeconds,
    classAverageRunSeconds: summary.averageRunSeconds,
    usedPatternAverage: summary.averageRunSeconds == null && averageRunSeconds != null,
    remainingDragBreaks: summary.remainingDragBreaks,
    remainingSeconds,
    estimatedEndAt,
    startedAt: classData?.setup?.startedAt || null,
    scheduleStartMode: scheduleDetails.startMode,
    scheduleStartTime: scheduleDetails.startTime,
    plannedStartAt: null,
    estimatedStartAt: null,
    scheduleStartUsesFallback: false,
    isDelayedFromFixedStart: false,
    isComplete: runCount > 0 && summary.completedRuns >= runCount,
    status: classData?.status || "draft",
  };
}

function parseDateAndClockTime(dayDate, timeValue) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(dayDate || "")) ||
    !/^\d{2}:\d{2}$/.test(String(timeValue || ""))
  ) {
    return null;
  }

  const [year, month, day] = String(dayDate).split("-").map(Number);
  const [hours, minutes] = String(timeValue).split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }

  return date;
}

function parseDateTime(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function toIsoString(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString()
    : null;
}

function addSeconds(date, seconds) {
  if (!(date instanceof Date) || !Number.isFinite(seconds)) return null;
  return new Date(date.getTime() + Math.max(seconds, 0) * 1000);
}

function maxDate(first, second) {
  if (!first) return second || null;
  if (!second) return first || null;
  return first.getTime() >= second.getTime() ? first : second;
}

export function buildDayScheduleRows(rows, { day, now = new Date() } = {}) {
  const fallbackNow =
    now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  let cursor = null;

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const mode =
      row.scheduleStartMode === CLASS_START_MODE_FIXED
        ? CLASS_START_MODE_FIXED
        : CLASS_START_MODE_AFTER_PREVIOUS;
    const fixedStartDate =
      mode === CLASS_START_MODE_FIXED
        ? parseDateAndClockTime(row.dayDate || day?.date, row.scheduleStartTime)
        : null;
    const actualStartedDate = parseDateTime(row.startedAt);
    const remainingSeconds = Number.isFinite(row.remainingSeconds)
      ? Math.max(row.remainingSeconds, 0)
      : null;
    const isRunning = Boolean(actualStartedDate && !row.isComplete);
    let estimatedStartDate = null;
    let scheduleStartUsesFallback = false;

    if (isRunning) {
      estimatedStartDate = actualStartedDate;
    } else if (fixedStartDate) {
      estimatedStartDate = maxDate(cursor, fixedStartDate);
    } else if (cursor) {
      estimatedStartDate = cursor;
    } else {
      estimatedStartDate = fallbackNow;
      scheduleStartUsesFallback = true;
    }

    const endBaseDate = isRunning ? fallbackNow : estimatedStartDate;
    const estimatedEndDate =
      remainingSeconds == null ? null : addSeconds(endBaseDate, remainingSeconds);

    if (estimatedEndDate) {
      cursor = estimatedEndDate;
    } else if (!cursor && estimatedStartDate) {
      cursor = estimatedStartDate;
    } else if (fixedStartDate) {
      cursor = maxDate(cursor, fixedStartDate);
    }

    return {
      ...row,
      scheduleStartMode: mode,
      scheduleStartTime: mode === CLASS_START_MODE_FIXED ? row.scheduleStartTime : "",
      plannedStartAt: toIsoString(fixedStartDate),
      estimatedStartAt: toIsoString(estimatedStartDate),
      estimatedEndAt: toIsoString(estimatedEndDate) || row.estimatedEndAt,
      scheduleStartUsesFallback,
      isDelayedFromFixedStart: Boolean(
        fixedStartDate &&
          estimatedStartDate &&
          estimatedStartDate.getTime() > fixedStartDate.getTime()
      ),
    };
  });
}

export function buildDayScheduleSummary(rows, now = new Date()) {
  const validNow =
    now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const remainingRuns = (Array.isArray(rows) ? rows : []).reduce(
    (total, row) => total + Math.max(row.remainingRuns || 0, 0),
    0
  );
  const lastEstimatedEndAt = [...(Array.isArray(rows) ? rows : [])]
    .reverse()
    .map((row) => parseDateTime(row.estimatedEndAt))
    .find(Boolean);
  const remainingSecondsValues = (Array.isArray(rows) ? rows : [])
    .map((row) => row.remainingSeconds)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const fallbackRemainingSeconds = remainingSecondsValues.length
    ? remainingSecondsValues.reduce((total, value) => total + value, 0)
    : null;
  const remainingSeconds = lastEstimatedEndAt
    ? Math.max(
        0,
        Math.round((lastEstimatedEndAt.getTime() - validNow.getTime()) / 1000)
      )
    : fallbackRemainingSeconds;

  return {
    remainingRuns,
    remainingSeconds,
    estimatedEndAt: toIsoString(lastEstimatedEndAt),
  };
}

export function calculateClassTimeSimulation({
  participantCount,
  averageRunSeconds,
  dragInterval,
  dragDurationMinutes,
}) {
  const normalizedParticipantCount = Number.parseInt(participantCount, 10);
  const normalizedAverageRunSeconds = Number(averageRunSeconds);
  const normalizedDragInterval = Number.parseInt(dragInterval, 10);
  const normalizedDragDurationMinutes = Number.parseInt(dragDurationMinutes, 10);

  if (
    !Number.isFinite(normalizedParticipantCount) ||
    normalizedParticipantCount <= 0 ||
    !Number.isFinite(normalizedAverageRunSeconds) ||
    normalizedAverageRunSeconds <= 0
  ) {
    return null;
  }

  const dragBreaks =
    Number.isFinite(normalizedDragInterval) && normalizedDragInterval > 0
      ? Math.floor(Math.max(normalizedParticipantCount - 1, 0) / normalizedDragInterval)
      : 0;
  const dragSeconds =
    dragBreaks *
    (Number.isFinite(normalizedDragDurationMinutes)
      ? Math.max(normalizedDragDurationMinutes, 0)
      : 0) *
    60;
  const runSeconds = normalizedParticipantCount * normalizedAverageRunSeconds;

  return {
    participantCount: normalizedParticipantCount,
    dragBreaks,
    runSeconds,
    dragSeconds,
    totalSeconds: runSeconds + dragSeconds,
  };
}
