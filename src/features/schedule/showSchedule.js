import {
  buildClassTimingRow,
  buildDayScheduleRows,
  buildDayScheduleSummary,
  buildPatternTimingStats,
  getClassPatternValue,
} from "../classes/classTimeAnalytics";
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

export function countScheduleItems(scheduleSections) {
  return (Array.isArray(scheduleSections) ? scheduleSections : []).reduce(
    (total, section) => total + (section.rows?.length || 0),
    0
  );
}

function compareScheduleRows(a, b) {
  const sortOrder = (a.sortOrder || 0) - (b.sortOrder || 0);
  if (sortOrder !== 0) return sortOrder;
  return String(a.className || "").localeCompare(String(b.className || ""));
}
