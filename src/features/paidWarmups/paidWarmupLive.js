import {
  getPaidWarmupStats,
  normalizePaidWarmup,
} from "./paidWarmupStorage";

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
  const isDragDue =
    !activeEntry &&
    Boolean(nextEntry) &&
    Boolean(normalized.dragInterval) &&
    completedBeforeNext > 0 &&
    completedBeforeNext % normalized.dragInterval === 0;

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

export function setPaidWarmupEntryStatus(warmup, entryId, status) {
  const normalized = normalizePaidWarmup(warmup);
  const nextEntries = normalized.entries.map((entry) =>
    entry.id === entryId ? { ...entry, status } : entry
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

export function stopPaidWarmupTimer(warmup) {
  const normalized = normalizePaidWarmup(warmup);

  return {
    ...normalized,
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

export function formatPaidWarmupTimer(seconds) {
  if (seconds == null) return "—";

  const absoluteSeconds = Math.abs(Math.round(seconds));
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;
  const formatted = `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;

  return seconds < 0 ? `+${formatted}` : formatted;
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
