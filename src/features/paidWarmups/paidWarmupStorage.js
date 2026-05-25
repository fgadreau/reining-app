import { createId } from "../../utils/createId";

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
  };
}

export function normalizePaidWarmup(item) {
  const entries = Array.isArray(item?.entries)
    ? item.entries.map((entry, index) => normalizePaidWarmupEntry(entry, index))
    : [];

  return {
    id: item?.id || createId("paid_warmup"),
    associationId: item?.associationId || "",
    showId: item?.showId || "",
    dayId: item?.dayId || "",
    name: item?.name || "Paid warm up",
    durationMinutesPerRider: normalizePositiveInteger(
      item?.durationMinutesPerRider,
      DEFAULT_PAID_WARMUP_DURATION_MINUTES
    ),
    dragInterval: normalizeNullablePositiveInteger(item?.dragInterval),
    dragDurationMinutes: normalizeNonNegativeInteger(item?.dragDurationMinutes, 8),
    isPublicLive: Boolean(item?.isPublicLive),
    activeEntryId: item?.activeEntryId || null,
    activeStartedAt: item?.activeStartedAt || null,
    entries,
    sortOrder: normalizePositiveInteger(item?.sortOrder, 1),
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || new Date().toISOString(),
  };
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
