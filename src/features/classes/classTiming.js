import {
  isScoredRunComplete,
  runHasAnyData,
  runHasVideoReview,
} from "../../utils/scoring";

export const DRAG_INTERVAL_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
export const DEFAULT_DRAG_DURATION_MINUTES = 8;
export const MIN_MEASURED_RUN_SECONDS = 60;
export const MAX_MEASURED_RUN_SECONDS = 9 * 60;

export function normalizeDragInterval(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeDragDurationMinutes(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_DRAG_DURATION_MINUTES;
}

export function formatClockTime(isoValue) {
  if (!isoValue) return "—";

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";

  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${String(remainingSeconds).padStart(2, "0")} s`;
  }

  return `${remainingSeconds} s`;
}

export function getRunDurationSeconds(run) {
  const explicitDuration = Number(run?.durationSeconds);
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
    return explicitDuration;
  }

  if (!run?.startedAt || !run?.completedAt) return null;

  const started = Date.parse(run.startedAt);
  const completed = Date.parse(run.completedAt);
  const duration = Math.round((completed - started) / 1000);

  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

export function isMeasuredRunDurationUsable(durationSeconds) {
  return (
    Number.isFinite(durationSeconds) &&
    durationSeconds >= MIN_MEASURED_RUN_SECONDS &&
    durationSeconds <= MAX_MEASURED_RUN_SECONDS
  );
}

export function stampRunTiming(run, maneuverCount, timestamp = new Date().toISOString()) {
  const hasTimingData = runHasAnyData(run);
  const startedAt = run.startedAt || (hasTimingData ? timestamp : null);
  const isComplete =
    isScoredRunComplete(run, maneuverCount) && !runHasVideoReview(run);

  if (!isComplete || !startedAt) {
    return {
      ...run,
      startedAt,
      completedAt: null,
      durationSeconds: null,
    };
  }

  const completedAt = run.completedAt || timestamp;
  const durationSeconds =
    getRunDurationSeconds({ ...run, startedAt, completedAt }) || 0;

  return {
    ...run,
    startedAt,
    completedAt,
    durationSeconds,
  };
}

export function calculateClassTimingSummary({
  runs,
  maneuverCount,
  startedAt,
  dragInterval,
  dragDurationMinutes,
  now = new Date(),
}) {
  const sourceRuns = Array.isArray(runs) ? runs : [];
  const completedRuns = sourceRuns.filter((run) =>
    isScoredRunComplete(run, maneuverCount)
  ).length;
  const remainingRuns = Math.max(sourceRuns.length - completedRuns, 0);
  const timedDurations = sourceRuns
    .map(getRunDurationSeconds)
    .filter(isMeasuredRunDurationUsable);
  const averageRunSeconds = timedDurations.length
    ? timedDurations.reduce((sum, value) => sum + value, 0) /
      timedDurations.length
    : null;
  const normalizedDragInterval = normalizeDragInterval(dragInterval);
  const normalizedDragDurationMinutes =
    normalizeDragDurationMinutes(dragDurationMinutes);
  const totalDragBreaks = normalizedDragInterval
    ? Math.floor(Math.max(sourceRuns.length - 1, 0) / normalizedDragInterval)
    : 0;
  const completedDragBreaks =
    normalizedDragInterval && completedRuns > 0
      ? Math.floor(Math.max(completedRuns - 1, 0) / normalizedDragInterval)
      : 0;
  const remainingDragBreaks = Math.max(totalDragBreaks - completedDragBreaks, 0);
  const remainingSeconds =
    averageRunSeconds == null
      ? null
      : remainingRuns * averageRunSeconds +
        remainingDragBreaks * normalizedDragDurationMinutes * 60;
  const estimatedEndAt =
    remainingSeconds == null
      ? null
      : new Date(now.getTime() + remainingSeconds * 1000).toISOString();
  const parsedStartedAt = startedAt ? Date.parse(startedAt) : NaN;
  const elapsedSeconds = Number.isFinite(parsedStartedAt)
    ? Math.max(0, Math.round((now.getTime() - parsedStartedAt) / 1000))
    : null;

  return {
    completedRuns,
    remainingRuns,
    averageRunSeconds,
    dragInterval: normalizedDragInterval,
    dragDurationMinutes: normalizedDragDurationMinutes,
    remainingDragBreaks,
    remainingSeconds,
    estimatedEndAt,
    elapsedSeconds,
  };
}
