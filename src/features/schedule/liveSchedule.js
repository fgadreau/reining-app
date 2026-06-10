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
          !isPaidWarmupScheduleComplete(item.source)
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
    scheduleStartTime: item?.scheduleStartTime || item?.schedule_start_time || "",
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

    const itemSort = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (itemSort !== 0) return itemSort;

    return String(a.name || "").localeCompare(String(b.name || ""));
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
