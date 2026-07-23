import {
  compareMixedScheduleItemsByStart,
  normalizeClassStartTime,
} from "../classes/classSchedule";

export const LIVE_SCHEDULE_ITEM_TYPES = {
  CLASS: "class",
  PAID_WARMUP: "paid_warmup",
};

const NO_ARENA_KEY = "__no_arena__";

export function getScheduleArenaKey(arena) {
  return String(arena || "").trim().toLocaleLowerCase() || NO_ARENA_KEY;
}

export function isSameScheduleArena(firstArena, secondArena) {
  return getScheduleArenaKey(firstArena) === getScheduleArenaKey(secondArena);
}

export function isPaidWarmupScheduleComplete(warmup) {
  const entries = Array.isArray(warmup?.entries) ? warmup.entries : [];

  return (
    entries.length > 0 &&
    entries.every((entry) =>
      ["done", "no_show", "scratch"].includes(entry?.status)
    )
  );
}

export function isPaidWarmupScheduleLiveEligible(warmup) {
  return Boolean(warmup?.isPublicLive) && !isPaidWarmupScheduleComplete(warmup);
}

export function isScheduledLiveViewCurrent(item, now = new Date()) {
  if (
    item?.activeEntry ||
    item?.activeDragItem ||
    item?.activeRun ||
    item?.dragBreak?.isActive
  ) {
    return true;
  }

  const scheduleDayDate = String(item?.scheduleDayDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDayDate)) return true;

  return scheduleDayDate <= formatLocalScheduleDateKey(now);
}

export function partitionScheduledLiveViews(items, now = new Date()) {
  return (Array.isArray(items) ? items : []).reduce(
    (partition, item) => {
      const target = isScheduledLiveViewCurrent(item, now)
        ? partition.current
        : partition.upcoming;
      target.push(item);
      return partition;
    },
    { current: [], upcoming: [] }
  );
}

export function buildLiveScheduleItems({
  classes = [],
  paidWarmups = [],
  days = [],
} = {}) {
  const sourceItems = [
    ...(Array.isArray(classes) ? classes : []).map((classItem) =>
      buildLiveScheduleItem({
        type: LIVE_SCHEDULE_ITEM_TYPES.CLASS,
        item: classItem,
      })
    ),
    ...(Array.isArray(paidWarmups) ? paidWarmups : []).map((warmup) =>
      buildLiveScheduleItem({
        type: LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
        item: warmup,
      })
    ),
  ];

  return inferPaidWarmupArenas(sortLiveScheduleItems(sourceItems, days));
}

export function findScheduleItem(scheduleItems, type, itemId) {
  const normalizedType = String(type || "");
  const normalizedItemId = String(itemId || "");

  if (!normalizedType || !normalizedItemId) return null;

  return (
    (Array.isArray(scheduleItems) ? scheduleItems : []).find(
      (item) => item.type === normalizedType && item.itemId === normalizedItemId
    ) || null
  );
}

export function findNextScheduleItemInArena(scheduleItems, currentItem, arena) {
  const sourceItems = Array.isArray(scheduleItems) ? scheduleItems : [];
  const currentIndex = sourceItems.findIndex(
    (item) =>
      item.type === currentItem?.type && item.itemId === currentItem?.itemId
  );
  const targetArena = arena || currentItem?.effectiveArena || currentItem?.arena;

  if (currentIndex < 0) return null;

  return (
    sourceItems
      .slice(currentIndex + 1)
      .find((item) => isSameScheduleArena(item.effectiveArena, targetArena)) ||
    null
  );
}

export function findFirstPendingPaidWarmupBeforeItem(
  scheduleItems,
  targetItem
) {
  const sourceItems = Array.isArray(scheduleItems) ? scheduleItems : [];
  const targetIndex = sourceItems.findIndex(
    (item) => item.type === targetItem?.type && item.itemId === targetItem?.itemId
  );

  if (targetIndex < 0) return null;

  return (
    sourceItems
      .slice(0, targetIndex)
      .find(
        (item) =>
          item.type === LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP &&
          isSameScheduleArena(item.effectiveArena, targetItem.effectiveArena) &&
          isPaidWarmupScheduleLiveEligible(item.source)
      ) || null
  );
}

export function toPublicScheduleItem(scheduleItem) {
  if (!scheduleItem) return null;

  return {
    itemId: scheduleItem.itemId,
    itemType: scheduleItem.type,
    name: scheduleItem.name,
    arena: scheduleItem.effectiveArena || "",
    isPaidWarmup: scheduleItem.type === LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP,
  };
}

function buildLiveScheduleItem({ type, item }) {
  const scheduleStartTime = normalizeClassStartTime(
    item?.scheduleStartTime || item?.schedule_start_time || item?.scheduled_time
  );

  return {
    type,
    itemId: item?.id || "",
    dayId: item?.dayId || item?.day_id || "",
    showId: item?.showId || item?.show_id || "",
    name:
      item?.name ||
      (type === LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP ? "Paid warm up" : "Bloc"),
    arena: String(item?.arena || "").trim(),
    effectiveArena: String(item?.arena || "").trim(),
    sortOrder: item?.sortOrder || item?.sort_order || 1,
    scheduleStartMode: item?.scheduleStartMode || item?.schedule_start_mode || "",
    scheduleStartTime,
    source: item,
  };
}

function sortLiveScheduleItems(items, days) {
  const dayOrderById = new Map(
    (Array.isArray(days) ? days : []).map((day, index) => [
      day.id,
      {
        sortOrder: day.sortOrder || day.sort_order || index + 1,
        date: day.date || "",
      },
    ])
  );

  return [...items].sort((a, b) => {
    const firstDay = dayOrderById.get(a.dayId) || {};
    const secondDay = dayOrderById.get(b.dayId) || {};
    const daySort = (firstDay.sortOrder || 0) - (secondDay.sortOrder || 0);
    if (daySort !== 0) return daySort;

    const dateSort = String(firstDay.date || "").localeCompare(
      String(secondDay.date || "")
    );
    if (dateSort !== 0) return dateSort;

    return compareMixedScheduleItemsByStart(a, b);
  });
}

function inferPaidWarmupArenas(scheduleItems) {
  return scheduleItems.map((item, index) => {
    if (
      item.effectiveArena ||
      item.type !== LIVE_SCHEDULE_ITEM_TYPES.PAID_WARMUP
    ) {
      return item;
    }

    const nextClass = scheduleItems
      .slice(index + 1)
      .find(
        (candidate) =>
          candidate.type === LIVE_SCHEDULE_ITEM_TYPES.CLASS &&
          candidate.effectiveArena
      );
    const previousClass = [...scheduleItems]
      .slice(0, index)
      .reverse()
      .find(
        (candidate) =>
          candidate.type === LIVE_SCHEDULE_ITEM_TYPES.CLASS &&
          candidate.effectiveArena
      );

    return {
      ...item,
      effectiveArena:
        nextClass?.effectiveArena || previousClass?.effectiveArena || "",
    };
  });
}

function formatLocalScheduleDateKey(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
