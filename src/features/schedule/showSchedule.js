import {
  buildClassTimingRow,
  buildDayScheduleRows,
  buildDayScheduleSummary,
  buildPatternTimingStats,
  getClassPatternValue,
} from "../classes/classTimeAnalytics";
import {
  CLASS_START_MODE_AFTER_PREVIOUS,
  CLASS_START_MODE_FIXED,
  compareMixedScheduleItemsByStart,
  normalizeClassStartTime,
} from "../classes/classSchedule";
import { calculatePaidWarmupScheduleSummary } from "../paidWarmups/paidWarmupStorage";

export const SHOW_SCHEDULE_ITEM_TYPES = {
  CLASS: "class",
  PAID_WARMUP: "paid_warmup",
};

export function buildPaidWarmupScheduleRow({ warmup, day, now = new Date() }) {
  const summary = calculatePaidWarmupScheduleSummary(warmup, now);

  return {
    classId: warmup?.id,
    itemId: warmup?.id,
    itemType: SHOW_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
    className: warmup?.name || "Paid warm up",
    arena: warmup?.arena || "",
    dayLabel: day?.label || "Journée",
    dayDate: day?.date || "",
    pattern: "Paid warm up",
    sortOrder: warmup?.sortOrder || 1,
    runCount: summary.runCount,
    completedRuns: summary.completedRuns,
    remainingRuns: summary.remainingRuns,
    averageRunSeconds: summary.averageRunSeconds,
    classAverageRunSeconds: summary.averageRunSeconds,
    usedPatternAverage: false,
    remainingDragBreaks: summary.remainingDragBreaks,
    remainingSeconds: summary.remainingSeconds,
    estimatedEndAt:
      summary.remainingSeconds == null
        ? null
        : new Date(now.getTime() + summary.remainingSeconds * 1000).toISOString(),
    startedAt: warmup?.activeStartedAt || null,
    scheduleStartMode: warmup?.scheduleStartMode,
    scheduleStartTime: warmup?.scheduleStartTime,
    plannedStartAt: null,
    estimatedStartAt: null,
    scheduleStartUsesFallback: false,
    isDelayedFromFixedStart: false,
    isComplete: summary.runCount > 0 && summary.completedRuns >= summary.runCount,
    status: "paid_warmup",
  };
}

export function buildShowScheduleSections({
  daySections,
  now = new Date(),
  patternAverageByValue = null,
}) {
  const sourceSections = Array.isArray(daySections) ? daySections : [];
  const resolvedPatternAverageByValue =
    patternAverageByValue ||
    new Map(
      buildPatternTimingStats(
        sourceSections.flatMap((section) => section.classRows || [])
      ).map((stat) => [stat.pattern, stat.averageRunSeconds])
    );

  return sourceSections.map((section) => {
    const day = section.day;
    const classRows = (section.classRows || []).map((classData) => ({
      ...buildClassTimingRow({
        classData,
        day,
        now,
        patternAverageRunSeconds:
          resolvedPatternAverageByValue.get(getClassPatternValue(classData)) ||
          null,
      }),
      itemId: classData?.classItem?.id,
      itemType: SHOW_SCHEDULE_ITEM_TYPES.CLASS,
      arena: classData?.classItem?.arena || "",
      sortOrder: classData?.classItem?.sortOrder || 1,
    }));
    const paidWarmupRows = (section.paidWarmups || []).map((warmup) =>
      buildPaidWarmupScheduleRow({ warmup, day, now })
    );
    const rows = buildDayScheduleRows(
      [...classRows, ...paidWarmupRows].sort(compareScheduleRows),
      { day, now }
    );

    return {
      day,
      rows,
      summary: buildDayScheduleSummary(rows, now),
    };
  });
}

export function buildShowSchedulePreviewSections({
  daySections,
  now = new Date(),
  patternAverageByValue = null,
}) {
  const sourceSections = Array.isArray(daySections) ? daySections : [];
  const resolvedPatternAverageByValue =
    patternAverageByValue ||
    new Map(
      buildPatternTimingStats(
        sourceSections.flatMap((section) => section.classRows || [])
      ).map((stat) => [stat.pattern, stat.averageRunSeconds])
    );

  return sourceSections.map((section) => {
    const day = section.day;
    const classRows = (section.classRows || []).map((classData) => {
      const timingRow = buildClassTimingRow({
        classData,
        day,
        now,
        patternAverageRunSeconds:
          resolvedPatternAverageByValue.get(getClassPatternValue(classData)) ||
          null,
      });

      return {
        ...timingRow,
        itemId: classData?.classItem?.id,
        itemType: SHOW_SCHEDULE_ITEM_TYPES.CLASS,
        arena: classData?.classItem?.arena || "",
        sortOrder: classData?.classItem?.sortOrder || 1,
        estimatedDurationSeconds: timingRow.remainingSeconds,
      };
    });
    const paidWarmupRows = (section.paidWarmups || []).map((warmup) => {
      const row = buildPaidWarmupScheduleRow({ warmup, day, now });

      return {
        ...row,
        estimatedDurationSeconds: row.remainingSeconds,
      };
    });
    const rows = buildDaySchedulePreviewRows(
      [...classRows, ...paidWarmupRows].sort(compareScheduleRows),
      { day }
    );

    return {
      day,
      rows,
      summary: buildDaySchedulePreviewSummary(rows),
    };
  });
}

export function countScheduleItems(scheduleSections) {
  return (Array.isArray(scheduleSections) ? scheduleSections : []).reduce(
    (total, section) => total + (section.rows?.length || 0),
    0
  );
}

function compareScheduleRows(a, b) {
  return compareMixedScheduleItemsByStart(a, b);
}

function buildDaySchedulePreviewRows(rows, { day } = {}) {
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
    const estimatedStartDate =
      mode === CLASS_START_MODE_FIXED ? fixedStartDate : cursor;
    const durationSeconds = Number.isFinite(row.estimatedDurationSeconds)
      ? Math.max(row.estimatedDurationSeconds, 0)
      : null;
    const estimatedEndDate =
      estimatedStartDate && durationSeconds != null
        ? addSeconds(estimatedStartDate, durationSeconds)
        : null;

    cursor = estimatedEndDate || null;

    return {
      ...row,
      scheduleStartMode: mode,
      scheduleStartTime: mode === CLASS_START_MODE_FIXED ? row.scheduleStartTime : "",
      plannedStartAt: toIsoString(fixedStartDate),
      estimatedStartAt: toIsoString(estimatedStartDate),
      estimatedEndAt: toIsoString(estimatedEndDate),
      estimatedDurationSeconds: durationSeconds,
      scheduleStartUsesFallback: false,
      isDelayedFromFixedStart: false,
      isEstimateBlockedByMissingAnchor: Boolean(
        mode === CLASS_START_MODE_AFTER_PREVIOUS && !estimatedStartDate
      ),
      isEstimateBlockedByMissingDuration: Boolean(
        estimatedStartDate && durationSeconds == null
      ),
    };
  });
}

function buildDaySchedulePreviewSummary(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const estimatedEndAt = [...sourceRows]
    .reverse()
    .map((row) => row.estimatedEndAt)
    .find(Boolean);

  return {
    estimatedEndAt: estimatedEndAt || null,
    itemCount: sourceRows.length,
  };
}

function parseDateAndClockTime(dayDate, timeValue) {
  const clockTime = normalizeClassStartTime(timeValue);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(dayDate || "")) ||
    !clockTime
  ) {
    return null;
  }

  const [year, month, day] = String(dayDate).split("-").map(Number);
  const [hours, minutes] = clockTime.split(":").map(Number);
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

function addSeconds(date, seconds) {
  if (!(date instanceof Date) || !Number.isFinite(seconds)) return null;
  return new Date(date.getTime() + Math.max(seconds, 0) * 1000);
}

function toIsoString(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString()
    : null;
}
