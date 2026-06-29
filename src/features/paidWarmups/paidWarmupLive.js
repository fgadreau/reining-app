import {
  getPaidWarmupStats,
  normalizePaidWarmup,
} from "./paidWarmupStorage";
import {
  LIVE_QUEUE_ITEM_TYPES,
  buildLiveQueueItems,
  getLiveDragItemId,
  isLiveDragItem,
} from "../live/liveQueueItems";

export const PAID_WARMUP_TIMER_CUES = {
  HALF_TIME: "half_time",
  ONE_MINUTE: "one_minute",
  FINISHED: "finished",
};

const COMPLETED_DRAG_MARKER_PREFIX = "completed:";

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
  const durationSeconds = normalized.durationMinutesPerRider * 60;
  const remainingSeconds = activeEntry
    ? calculateRemainingSeconds(normalized.activeStartedAt, durationSeconds, now)
    : null;
  const completedBeforeNext = entries.filter((entry) =>
    ["done", "no_show", "scratch"].includes(entry.status)
  ).length;
  const firstPendingEntry =
    entries.find((entry) => entry.status === "pending") || null;
  const plannedDragItem = buildPaidWarmupDragItem({
    entries,
    completedBeforeNext,
    normalized,
  });
  const isPlannedDragCompleted =
    plannedDragItem &&
    normalized.activeEntryId === getCompletedDragMarker(plannedDragItem.id);
  const activeDragItem =
    plannedDragItem &&
    !activeEntry &&
    !isPlannedDragCompleted &&
    normalized.activeStartedAt
      ? {
          ...plannedDragItem,
          startedAt: normalized.activeStartedAt,
        }
      : null;
  const isDragPlanned =
    !activeEntry &&
    !isPlannedDragCompleted &&
    Boolean(firstPendingEntry) &&
    Boolean(normalized.dragInterval) &&
    completedBeforeNext > 0 &&
    completedBeforeNext % normalized.dragInterval === 0;
  const stagedEntry =
    !activeEntry && !isDragPlanned && !activeDragItem ? firstPendingEntry : null;
  const onCourseEntry = activeEntry || stagedEntry;
  const liveQueue = buildLiveQueueItems({
    items: entries,
    activeItem: onCourseEntry,
    activeDragItem,
    dragInterval: normalized.dragInterval,
    dragDurationMinutes: normalized.dragDurationMinutes,
    itemType: LIVE_QUEUE_ITEM_TYPES.ENTRY,
    isAvailable: isPaidWarmupEntryPending,
    isPassed: isPaidWarmupEntryCompleted,
  });
  const onCourseIndex = onCourseEntry
    ? entries.findIndex((entry) => entry.id === onCourseEntry.id)
    : -1;
  const upcomingEntries = liveQueue.upcomingLiveItems.filter(
    (item) => !isLiveDragItem(item)
  );
  const nextEntry = upcomingEntries[0] || null;
  const secondNextEntry = upcomingEntries[1] || null;
  const lastPassedEntries = findLastPassedEntries(entries, onCourseIndex, 2);
  const dragDurationSeconds = normalized.dragDurationMinutes * 60;
  const dragStartedAt = activeDragItem?.startedAt || null;
  const dragRemainingSeconds = activeDragItem
    ? calculateRemainingSeconds(dragStartedAt, dragDurationSeconds, now)
    : null;

  return {
    ...normalized,
    entries,
    activeEntry,
    stagedEntry,
    onCourseEntry,
    nextEntry,
    secondNextEntry,
    nextLiveItem: liveQueue.nextLiveItem,
    secondNextLiveItem: liveQueue.secondNextLiveItem,
    upcomingLiveItems: liveQueue.upcomingLiveItems,
    upcomingEntries,
    orderItems: liveQueue.orderItems,
    lastPassedEntries,
    stats: getPaidWarmupStats(entries),
    durationSeconds,
    remainingSeconds,
    isHalfTimeReached:
      remainingSeconds != null && remainingSeconds <= durationSeconds / 2,
    isOneMinuteRemaining:
      remainingSeconds != null && remainingSeconds <= 60,
    isExpired: remainingSeconds != null && remainingSeconds <= 0,
    isDragDue: Boolean(activeDragItem),
    isDragPlanned: Boolean(plannedDragItem && !isPlannedDragCompleted),
    plannedDragItem: isPlannedDragCompleted ? null : plannedDragItem,
    completedDragItem: isPlannedDragCompleted ? plannedDragItem : null,
    activeDragItem,
    dragStartedAt,
    dragDurationSeconds,
    dragRemainingSeconds,
  };
}

export function startPaidWarmupDrag(warmup, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);
  const liveView = buildPaidWarmupLiveView(normalized, now);

  if (!liveView.plannedDragItem || liveView.activeEntry) {
    return normalized;
  }

  return {
    ...normalized,
    activeEntryId: liveView.plannedDragItem.id,
    activeStartedAt: now.toISOString(),
  };
}

export function stopPaidWarmupDrag(warmup) {
  const normalized = normalizePaidWarmup(warmup);
  const liveView = buildPaidWarmupLiveView(normalized);

  if (!liveView.activeDragItem || !normalized.activeStartedAt) {
    return normalized;
  }

  return {
    ...normalized,
    activeEntryId: getCompletedDragMarker(liveView.activeDragItem.id),
    activeStartedAt: null,
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

function findLastPassedEntries(entries, activeIndex, count) {
  const sourceEntries =
    activeIndex >= 0 ? entries.slice(0, activeIndex) : entries;

  return sourceEntries
    .filter((entry) => ["done", "no_show", "scratch"].includes(entry.status))
    .slice(-count)
    .reverse();
}

function buildPaidWarmupDragItem({ entries, completedBeforeNext, normalized }) {
  const normalizedDragInterval = Number.parseInt(normalized.dragInterval, 10);

  if (
    !Number.isFinite(normalizedDragInterval) ||
    normalizedDragInterval <= 0 ||
    completedBeforeNext <= 0 ||
    completedBeforeNext % normalizedDragInterval !== 0 ||
    !entries.some(isPaidWarmupEntryPending)
  ) {
    return null;
  }

  const afterIndex = findLastIndex(entries, isPaidWarmupEntryCompleted);
  const afterItem = entries[afterIndex];

  return {
    type: LIVE_QUEUE_ITEM_TYPES.DRAG,
    id: getLiveDragItemId(afterItem, afterIndex),
    itemId: getLiveDragItemId(afterItem, afterIndex),
    afterIndex,
    afterDraw: afterItem?.order || afterIndex + 1,
    durationMinutes: normalized.dragDurationMinutes,
    durationSeconds: normalized.dragDurationMinutes * 60,
  };
}

function getCompletedDragMarker(dragId) {
  return `${COMPLETED_DRAG_MARKER_PREFIX}${dragId}`;
}

function isPaidWarmupEntryPending(entry) {
  return entry?.status === "pending";
}

function isPaidWarmupEntryCompleted(entry) {
  return ["done", "no_show", "scratch"].includes(entry?.status);
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }

  return -1;
}
