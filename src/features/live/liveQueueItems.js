export const LIVE_QUEUE_ITEM_TYPES = {
  DRAG: "drag",
  ENTRY: "entry",
  RUN: "run",
};

export function isLiveDragItem(item) {
  return item?.type === LIVE_QUEUE_ITEM_TYPES.DRAG;
}

export function buildLiveQueueItems({
  items,
  activeItem = null,
  activeDragItem = null,
  dragInterval,
  dragDurationMinutes,
  itemType = LIVE_QUEUE_ITEM_TYPES.RUN,
  isAvailable,
  isPassed,
  getItemId = defaultGetItemId,
}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedDragInterval = normalizeDragInterval(dragInterval);
  const normalizedDragDurationMinutes =
    normalizeDragDurationMinutes(dragDurationMinutes);
  const activeIndex = findItemIndex(normalizedItems, activeItem, getItemId);
  const activeDragIndex = Number.isInteger(activeDragItem?.afterIndex)
    ? activeDragItem.afterIndex
    : -1;
  const completedCount = normalizedItems.filter((item) => isPassed(item)).length;
  const lastPassedIndex = findLastIndex(normalizedItems, (item) =>
    isPassed(item)
  );
  const startIndex =
    activeIndex >= 0
      ? activeIndex + 1
      : activeDragIndex >= 0
        ? activeDragIndex + 1
        : 0;
  const upcomingItems = [];

  if (
    !activeDragItem &&
    shouldAddDragAfterIndex({
      index: activeIndex,
      items: normalizedItems,
      dragInterval: normalizedDragInterval,
      isAvailable,
    })
  ) {
    upcomingItems.push(
      buildDragItem({
        afterItem: normalizedItems[activeIndex],
        afterIndex: activeIndex,
        durationMinutes: normalizedDragDurationMinutes,
      })
    );
  } else if (
    !activeDragItem &&
    activeIndex < 0 &&
    completedCount > 0 &&
    normalizedDragInterval &&
    completedCount % normalizedDragInterval === 0 &&
    hasAvailableAfter(normalizedItems, lastPassedIndex, isAvailable)
  ) {
    upcomingItems.push(
      buildDragItem({
        afterItem: normalizedItems[lastPassedIndex],
        afterIndex: lastPassedIndex,
        durationMinutes: normalizedDragDurationMinutes,
      })
    );
  }

  for (let index = startIndex; index < normalizedItems.length; index += 1) {
    const item = normalizedItems[index];

    if (!isAvailable(item)) continue;

    upcomingItems.push(buildEntryItem(item, itemType, getItemId));

    if (
      shouldAddDragAfterIndex({
        index,
        items: normalizedItems,
        dragInterval: normalizedDragInterval,
        isAvailable,
      })
    ) {
      upcomingItems.push(
        buildDragItem({
          afterItem: item,
          afterIndex: index,
          durationMinutes: normalizedDragDurationMinutes,
        })
      );
    }
  }

  const nextLiveItems = upcomingItems.map((item, index) => ({
    ...item,
    liveOrderStatus:
      index === 0 ? "preparation" : index === 1 ? "waiting" : "upcoming",
  }));
  const orderItems = buildLiveOrderItems({
    items: normalizedItems,
    activeItem,
    activeDragItem,
    nextLiveItems,
    dragInterval: normalizedDragInterval,
    dragDurationMinutes: normalizedDragDurationMinutes,
    itemType,
    isAvailable,
    isPassed,
    getItemId,
  });

  return {
    nextLiveItem: nextLiveItems[0] || null,
    secondNextLiveItem: nextLiveItems[1] || null,
    upcomingLiveItems: nextLiveItems,
    orderItems,
  };
}

function buildLiveOrderItems({
  items,
  activeItem,
  activeDragItem,
  nextLiveItems,
  dragInterval,
  dragDurationMinutes,
  itemType,
  isAvailable,
  isPassed,
  getItemId,
}) {
  const activeIndex = findItemIndex(items, activeItem, getItemId);
  const orderItems = [];

  items.forEach((item, index) => {
    orderItems.push({
      ...buildEntryItem(item, itemType, getItemId),
      liveOrderStatus: getEntryOrderStatus({
        item,
        activeItem,
        nextLiveItems,
        isPassed,
        getItemId,
      }),
    });

    if (
      shouldAddDragAfterIndex({
        index,
        items,
        dragInterval,
        isAvailable: () => true,
      })
    ) {
      const dragItem = buildDragItem({
        afterItem: item,
        afterIndex: index,
        durationMinutes: dragDurationMinutes,
      });

      orderItems.push({
        ...dragItem,
        liveOrderStatus: getDragOrderStatus({
          dragItem,
          activeDragItem,
          nextLiveItems,
          activeIndex,
          afterIndex: index,
          items,
          isPassed,
        }),
      });
    }
  });

  return orderItems;
}

function getEntryOrderStatus({
  item,
  activeItem,
  nextLiveItems,
  isPassed,
  getItemId,
}) {
  if (isSameItem(item, activeItem, getItemId)) return "active";

  const liveItem = nextLiveItems.find(
    (candidate) =>
      candidate.type !== LIVE_QUEUE_ITEM_TYPES.DRAG &&
      candidate.itemId === getItemId(item)
  );

  if (liveItem) return liveItem.liveOrderStatus;
  if (isPassed(item)) return "passed";
  return "upcoming";
}

function getDragOrderStatus({
  dragItem,
  activeDragItem,
  nextLiveItems,
  activeIndex,
  afterIndex,
  items,
  isPassed,
}) {
  if (activeDragItem?.id === dragItem.id) return "active";

  const liveItem = nextLiveItems.find((candidate) => candidate.id === dragItem.id);

  if (liveItem) return liveItem.liveOrderStatus;
  if (activeIndex > afterIndex) return "passed";

  const nextItem = items[afterIndex + 1];
  if (nextItem && isPassed(nextItem)) return "passed";

  return "upcoming";
}

function buildEntryItem(item, itemType, getItemId) {
  return {
    ...item,
    type: itemType,
    item,
    itemId: getItemId(item),
  };
}

function buildDragItem({ afterItem, afterIndex, durationMinutes }) {
  const afterId = getLiveDragItemId(afterItem, afterIndex);

  return {
    type: LIVE_QUEUE_ITEM_TYPES.DRAG,
    id: afterId,
    itemId: afterId,
    afterIndex,
    afterDraw: afterItem?.draw || afterItem?.order || afterIndex + 1,
    durationMinutes,
    durationSeconds: durationMinutes * 60,
  };
}

export function getLiveDragItemId(afterItem, afterIndex) {
  const afterId = defaultGetItemId(afterItem) || afterIndex + 1;

  return `drag-after-${afterId}`;
}

function shouldAddDragAfterIndex({ index, items, dragInterval, isAvailable }) {
  if (!dragInterval || index < 0) return false;
  if ((index + 1) % dragInterval !== 0) return false;

  return hasAvailableAfter(items, index, isAvailable);
}

function hasAvailableAfter(items, index, isAvailable) {
  return items.slice(index + 1).some((item) => isAvailable(item));
}

function findItemIndex(items, targetItem, getItemId) {
  if (!targetItem) return -1;

  const targetId = getItemId(targetItem);

  return items.findIndex((item) => getItemId(item) === targetId);
}

function isSameItem(item, targetItem, getItemId) {
  if (!item || !targetItem) return false;

  return getItemId(item) === getItemId(targetItem);
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }

  return -1;
}

function defaultGetItemId(item) {
  return String(item?.id || item?.draw || item?.order || "");
}

function normalizeDragInterval(value) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeDragDurationMinutes(value) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) && number >= 0 ? number : 8;
}
