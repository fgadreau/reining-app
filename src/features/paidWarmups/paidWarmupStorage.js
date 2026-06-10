import { createId } from "../../utils/createId";
import { normalizeClassScheduleStart } from "../classes/classSchedule";

const STORAGE_KEY = "reining_paid_warmups_v1";

export const DEFAULT_PAID_WARMUP_DURATION_MINUTES = 5;
export const PAID_WARMUP_STATUSES = ["pending", "done", "no_show", "scratch"];

export const PAID_WARMUP_STATUS_LABELS = {
  pending: "À venir",
  done: "Passé",
  no_show: "No show",
  scratch: "Scratch",
};

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erreur lecture paid warmups:", error);
    return [];
  }
}

function saveAll(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Erreur sauvegarde paid warmups:", error);
  }
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeNullablePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizePaidWarmupEntry(entry, index = 0) {
  const status = PAID_WARMUP_STATUSES.includes(entry?.status)
    ? entry.status
    : "pending";

  return {
    id: entry?.id || createId("paid_warmup_entry"),
    order: normalizePositiveInteger(entry?.order, index + 1),
    rider: entry?.rider || entry?.name || "",
    status,
    completedAt: entry?.completedAt || null,
  };
}

export function normalizePaidWarmupEntries(entries) {
  return (Array.isArray(entries) ? entries : []).map((entry, index) => ({
    ...normalizePaidWarmupEntry(entry, index),
    order: index + 1,
  }));
}

export function movePaidWarmupEntry(entries, entryId, targetIndex) {
  const normalizedEntries = normalizePaidWarmupEntries(entries);
  const fromIndex = normalizedEntries.findIndex((entry) => entry.id === entryId);

  if (fromIndex < 0 || normalizedEntries.length <= 1) {
    return normalizedEntries;
  }

  const parsedTargetIndex = Number(targetIndex);
  const boundedTargetIndex = Number.isFinite(parsedTargetIndex)
    ? Math.max(0, Math.min(parsedTargetIndex, normalizedEntries.length - 1))
    : fromIndex;
  const nextEntries = [...normalizedEntries];
  const [movedEntry] = nextEntries.splice(fromIndex, 1);

  nextEntries.splice(boundedTargetIndex, 0, movedEntry);

  return normalizePaidWarmupEntries(nextEntries);
}

export function insertPaidWarmupEntryAfter(entries, afterEntryId, entry = {}) {
  const normalizedEntries = normalizePaidWarmupEntries(entries);
  const foundAfterIndex = afterEntryId
    ? normalizedEntries.findIndex((current) => current.id === afterEntryId)
    : normalizedEntries.length - 1;
  const afterIndex =
    foundAfterIndex >= 0 ? foundAfterIndex : normalizedEntries.length - 1;
  const insertIndex = Math.max(0, afterIndex + 1);
  const nextEntry = normalizePaidWarmupEntry(
    {
      ...entry,
      id: entry?.id || createId("paid_warmup_entry"),
      status: entry?.status || "pending",
    },
    insertIndex
  );
  const nextEntries = [...normalizedEntries];

  nextEntries.splice(insertIndex, 0, nextEntry);

  return normalizePaidWarmupEntries(nextEntries);
}

export function normalizePaidWarmup(item) {
  const entries = normalizePaidWarmupEntries(item?.entries);
  const scheduleStart = normalizeClassScheduleStart(item);

  return {
    id: item?.id || createId("paid_warmup"),
    associationId: item?.associationId || "",
    showId: item?.showId || "",
    dayId: item?.dayId || "",
    name: item?.name || "Paid warm up",
    arena: String(item?.arena || "").trim(),
    durationMinutesPerRider: normalizePositiveInteger(
      item?.durationMinutesPerRider,
      DEFAULT_PAID_WARMUP_DURATION_MINUTES
    ),
    dragInterval: normalizeNullablePositiveInteger(item?.dragInterval),
    dragDurationMinutes: normalizeNonNegativeInteger(item?.dragDurationMinutes, 8),
    scheduleStartMode: scheduleStart.startMode,
    scheduleStartTime: scheduleStart.startTime,
    isPublicLive: Boolean(item?.isPublicLive),
    activeEntryId: item?.activeEntryId || null,
    activeStartedAt: item?.activeStartedAt || null,
    entries,
    sortOrder: normalizePositiveInteger(item?.sortOrder, 1),
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || new Date().toISOString(),
  };
}

export function calculatePaidWarmupScheduleSummary(warmup, now = new Date()) {
  const normalized = normalizePaidWarmup(warmup);
  const entries = normalized.entries;
  const completedEntries = entries.filter((entry) =>
    ["done", "no_show", "scratch"].includes(entry.status)
  ).length;
  const activeEntry =
    normalized.activeEntryId &&
    entries.find((entry) => entry.id === normalized.activeEntryId);
  const remainingEntries = entries.filter((entry) => {
    if (activeEntry && entry.id === activeEntry.id) return true;
    return !["done", "no_show", "scratch"].includes(entry.status);
  }).length;
  const totalDragBreaks = normalized.dragInterval
    ? Math.floor(Math.max(entries.length - 1, 0) / normalized.dragInterval)
    : 0;
  const completedDragBreaks =
    normalized.dragInterval && completedEntries > 0
      ? Math.floor(Math.max(completedEntries - 1, 0) / normalized.dragInterval)
      : 0;
  const remainingDragBreaks = Math.max(totalDragBreaks - completedDragBreaks, 0);
  const durationSeconds = normalized.durationMinutesPerRider * 60;
  const activeRemainingSeconds = activeEntry
    ? calculateActivePaidWarmupRemainingSeconds(
        normalized.activeStartedAt,
        durationSeconds,
        now
      )
    : null;
  const remainingWholeEntries = activeEntry
    ? Math.max(remainingEntries - 1, 0)
    : remainingEntries;
  const remainingSeconds =
    (activeRemainingSeconds == null
      ? remainingEntries * durationSeconds
      : Math.max(activeRemainingSeconds, 0) +
        remainingWholeEntries * durationSeconds) +
    remainingDragBreaks * normalized.dragDurationMinutes * 60;

  return {
    completedRuns: completedEntries,
    runCount: entries.length,
    remainingRuns: remainingEntries,
    averageRunSeconds: durationSeconds,
    remainingDragBreaks,
    remainingSeconds,
  };
}

function calculateActivePaidWarmupRemainingSeconds(startedAt, durationSeconds, now) {
  const started = Date.parse(startedAt);

  if (!Number.isFinite(started)) {
    return durationSeconds;
  }

  return Math.round(durationSeconds - (now.getTime() - started) / 1000);
}

export function loadPaidWarmups() {
  return loadAll().map(normalizePaidWarmup);
}

export function savePaidWarmups(items) {
  saveAll(Array.isArray(items) ? items.map(normalizePaidWarmup) : []);
}

export function getPaidWarmupById(id) {
  return loadPaidWarmups().find((item) => item.id === id) || null;
}

export function getPaidWarmupsByDayId(dayId) {
  return loadPaidWarmups()
    .filter((item) => item.dayId === dayId)
    .sort((a, b) => {
      const sortOrder = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (sortOrder !== 0) return sortOrder;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

export function savePaidWarmup(item) {
  const all = loadPaidWarmups();
  const existing = all.find((current) => current.id === item.id);
  const now = new Date().toISOString();
  const nextItem = normalizePaidWarmup({
    ...item,
    createdAt: existing?.createdAt || item?.createdAt || now,
    updatedAt: now,
  });

  const next = existing
    ? all.map((current) => (current.id === nextItem.id ? nextItem : current))
    : [...all, nextItem];

  saveAll(next);
  return nextItem;
}

export function deletePaidWarmup(id) {
  saveAll(loadPaidWarmups().filter((item) => item.id !== id));
}

export function getPaidWarmupStats(entries) {
  const sourceEntries = Array.isArray(entries) ? entries : [];

  return sourceEntries.reduce(
    (stats, entry) => {
      stats.total += 1;

      if (entry.status === "done") stats.done += 1;
      if (entry.status === "no_show") stats.noShow += 1;
      if (entry.status === "scratch") stats.scratch += 1;
      if (!entry.status || entry.status === "pending") stats.pending += 1;

      return stats;
    },
    {
      total: 0,
      pending: 0,
      done: 0,
      noShow: 0,
      scratch: 0,
    }
  );
}
