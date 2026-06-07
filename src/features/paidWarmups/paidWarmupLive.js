import {
  getPaidWarmupStats,
  normalizePaidWarmup,
} from "./paidWarmupStorage";

export const PAID_WARMUP_TIMER_CUES = {
  HALF_TIME: "half_time",
  ONE_MINUTE: "one_minute",
  FINISHED: "finished",
};

export function buildPaidWarmupLiveView(warmup, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);
  const entries = normalized.entries.map((entry, index) => ({
    ...entry,
    order: index + 1,
  }));
  const activeEntry =
    entries.find((entry) => entry.id === normalized.activeEntryId) || null;
  const activeIndex = activeEntry
    ? entries.findIndex((entry) => entry.id === activeEntry.id)
    : -1;
  const nextEntry = findNextPendingEntry(entries, activeIndex);
  const lastPassedEntries = findLastPassedEntries(entries, activeIndex, 2);
  const durationSeconds = normalized.durationMinutesPerRider * 60;
  const remainingSeconds = activeEntry
    ? calculateRemainingSeconds(normalized.activeStartedAt, durationSeconds, now)
    : null;
  const completedBeforeNext = entries.filter((entry) =>
    ["done", "no_show", "scratch"].includes(entry.status)
  ).length;
  const lastCompletedEntry = [...entries]
    .reverse()
    .find((entry) => ["done", "no_show", "scratch"].includes(entry.status));
  const isDragDue =
    !activeEntry &&
    Boolean(nextEntry) &&
    Boolean(normalized.dragInterval) &&
    completedBeforeNext > 0 &&
    completedBeforeNext % normalized.dragInterval === 0;
  const dragDurationSeconds = normalized.dragDurationMinutes * 60;
  const dragStartedAt = isDragDue ? lastCompletedEntry?.completedAt || null : null;
  const dragRemainingSeconds = isDragDue
    ? calculateRemainingSeconds(dragStartedAt, dragDurationSeconds, now)
    : null;

  return {
    ...normalized,
    entries,
    activeEntry,
    nextEntry,
    lastPassedEntries,
    stats: getPaidWarmupStats(entries),
    durationSeconds,
    remainingSeconds,
    isHalfTimeReached:
      remainingSeconds != null && remainingSeconds <= durationSeconds / 2,
    isOneMinuteRemaining:
      remainingSeconds != null && remainingSeconds <= 60,
    isExpired: remainingSeconds != null && remainingSeconds <= 0,
    isDragDue,
    dragStartedAt,
    dragDurationSeconds,
    dragRemainingSeconds,
  };
}

export function startPaidWarmupEntry(warmup, entryId, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);
  const targetEntry =
    normalized.entries.find((entry) => entry.id === entryId) ||
    normalized.entries.find((entry) => entry.status === "pending");

  if (!targetEntry) {
    return normalized;
  }

  return {
    ...normalized,
    activeEntryId: targetEntry.id,
    activeStartedAt: now.toISOString(),
  };
}

export function resetPaidWarmupTimer(warmup, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);

  if (!normalized.activeEntryId) {
    return normalized;
  }

  return {
    ...normalized,
    activeStartedAt: now.toISOString(),
  };
}

export function setPaidWarmupEntryStatus(warmup, entryId, status, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);
  const completedAt = now.toISOString();
  const isFinishedStatus = ["done", "no_show", "scratch"].includes(status);
  const nextEntries = normalized.entries.map((entry) =>
    entry.id === entryId
      ? { ...entry, status, completedAt: isFinishedStatus ? completedAt : null }
      : entry
  );

  return {
    ...normalized,
    entries: nextEntries,
    activeEntryId:
      normalized.activeEntryId === entryId ? null : normalized.activeEntryId,
    activeStartedAt:
      normalized.activeEntryId === entryId ? null : normalized.activeStartedAt,
  };
}

export function stopPaidWarmupTimer(warmup, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);
  const completedAt = now.toISOString();
  const nextEntries = normalized.activeEntryId
    ? normalized.entries.map((entry) =>
        entry.id === normalized.activeEntryId
          ? { ...entry, status: "done", completedAt }
          : entry
      )
    : normalized.entries;

  return {
    ...normalized,
    entries: nextEntries,
    activeEntryId: null,
    activeStartedAt: null,
  };
}

export function getPaidWarmupRemainingSeconds(warmup, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);

  if (!normalized.activeEntryId || !normalized.activeStartedAt) {
    return null;
  }

  return calculateRemainingSeconds(
    normalized.activeStartedAt,
    normalized.durationMinutesPerRider * 60,
    now
  );
}

export function getPaidWarmupDragRemainingSeconds(warmup, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);

  if (!normalized.dragInterval || !normalized.dragDurationMinutes) {
    return null;
  }

  return calculateRemainingSeconds(
    warmup?.dragStartedAt,
    normalized.dragDurationMinutes * 60,
    now
  );
}

export function formatPaidWarmupTimer(seconds) {
  if (seconds == null) return "—";

  const absoluteSeconds = Math.abs(Math.round(seconds));
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;
  const formatted = `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;

  return seconds < 0 ? `+${formatted}` : formatted;
}

export function getPaidWarmupTimerCueType(warmup, remainingSeconds) {
  if (remainingSeconds == null) return null;

  if (remainingSeconds <= 0) {
    return PAID_WARMUP_TIMER_CUES.FINISHED;
  }

  if (remainingSeconds <= 60) {
    return PAID_WARMUP_TIMER_CUES.ONE_MINUTE;
  }

  const durationSeconds =
    Number(warmup?.durationSeconds) ||
    normalizePaidWarmup(warmup).durationMinutesPerRider * 60;

  if (remainingSeconds <= durationSeconds / 2) {
    return PAID_WARMUP_TIMER_CUES.HALF_TIME;
  }

  return null;
}

function calculateRemainingSeconds(startedAt, durationSeconds, now) {
  const started = Date.parse(startedAt);

  if (!Number.isFinite(started)) {
    return durationSeconds;
  }

  return Math.round(durationSeconds - (now.getTime() - started) / 1000);
}

function findNextPendingEntry(entries, activeIndex) {
  const startIndex = activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    entries.slice(startIndex).find((entry) => entry.status === "pending") ||
    entries.find((entry) => entry.status === "pending") ||
    null
  );
}

function findLastPassedEntries(entries, activeIndex, count) {
  const sourceEntries = activeIndex > 0 ? entries.slice(0, activeIndex) : entries;

  return sourceEntries
    .filter((entry) => ["done", "no_show", "scratch"].includes(entry.status))
    .slice(-count)
    .reverse();
}
