import {
  getPatternDisplayName,
  getPatternHeaders,
} from "../patterns/patternDefinitions";
import {
  calculateClassTimingSummary,
  getRunDurationSeconds,
  MIN_MEASURED_RUN_SECONDS,
} from "./classTiming";

export function getClassPatternValue(classData) {
  const patternValue = String(
    classData?.setup?.pattern || classData?.classItem?.pattern || ""
  ).trim();
  return getPatternDisplayName(patternValue) || patternValue;
}

export function getClassRunCount(classData) {
  const setupRuns = classData?.setup?.runs;
  const scoringRuns = classData?.scoringRuns;

  if (Array.isArray(setupRuns) && setupRuns.length) return setupRuns.length;
  if (Array.isArray(scoringRuns)) return scoringRuns.length;
  return 0;
}

export function getClassScoringRuns(classData) {
  return Array.isArray(classData?.scoringRuns) ? classData.scoringRuns : [];
}

export function getClassManeuverCount(classData) {
  return getPatternHeaders(getClassPatternValue(classData)).length;
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
      .filter(
        (value) => Number.isFinite(value) && value >= MIN_MEASURED_RUN_SECONDS
      );

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
    className: classData?.classItem?.name || "Classe sans nom",
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
    isComplete: runCount > 0 && summary.completedRuns >= runCount,
    status: classData?.status || "draft",
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
