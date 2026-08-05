import { expect, test } from "vitest";
import {
  getTvWarmupTimerState,
  pickTvLiveItem,
  pickTvUpcomingItem,
} from "./PublicShowTvPage";

const todayWarmup = {
  id: "warmup-today",
  name: "Paid warm up 40x",
  arena: "101",
  scheduleDayDate: "2026-07-28",
  scheduleStartMode: "fixed",
  scheduleStartAt: "2026-07-28T17:00:00.000Z",
  stagedEntry: {
    id: "today-entry-1",
    rider: "Mireille Labrecque",
  },
};

const tomorrowWarmup = {
  id: "warmup-tomorrow",
  name: "Paid warm up 48x",
  arena: "101",
  scheduleDayDate: "2026-07-29",
  scheduleStartMode: "fixed",
  scheduleStartAt: "2026-07-29T07:00:00.000Z",
  stagedEntry: {
    id: "tomorrow-entry-1",
    rider: "Cavalière demain",
  },
};

test("keeps today's warmup ahead when tomorrow is also authorized", () => {
  const publicView = {
    liveClasses: [],
    livePaidWarmups: [todayWarmup, tomorrowWarmup],
  };
  const beforeTodayStart = new Date("2026-07-28T16:00:00.000Z");

  expect(pickTvLiveItem(publicView, "101", beforeTodayStart)).toBeNull();
  expect(
    pickTvUpcomingItem(publicView, "101", beforeTodayStart)
  ).toMatchObject({
    kind: "paidWarmup",
    item: {
      id: "warmup-today",
    },
  });
});

test("lets tomorrow's warmup take over early only when it is really started", () => {
  const publicView = {
    liveClasses: [],
    livePaidWarmups: [
      todayWarmup,
      {
        ...tomorrowWarmup,
        activeEntry: tomorrowWarmup.stagedEntry,
      },
    ],
  };

  expect(
    pickTvLiveItem(
      publicView,
      "101",
      new Date("2026-07-28T16:00:00.000Z")
    )
  ).toMatchObject({
    kind: "paidWarmup",
    item: {
      id: "warmup-tomorrow",
    },
  });
});

test("builds the rider countdown shown on general and competition TVs", () => {
  const warmup = {
    activeEntryId: "entry-1",
    activeEntry: { id: "entry-1", rider: "Cavalière chrono" },
    activeStartedAt: "2026-07-28T17:00:00.000Z",
    durationMinutesPerRider: 5,
    entries: [{ id: "entry-1", rider: "Cavalière chrono", status: "pending" }],
  };

  expect(
    getTvWarmupTimerState(warmup, new Date("2026-07-28T17:02:30.000Z"))
  ).toEqual({
    cue: "half_time",
    formatted: "2:30",
    kind: "rider",
    remainingSeconds: 150,
  });
});

test("builds the drag countdown and ignores a staged warmup", () => {
  const dragWarmup = {
    activeEntryId: "drag-1",
    activeStartedAt: "2026-07-28T17:00:00.000Z",
    activeDragItem: { id: "drag-1", startedAt: "2026-07-28T17:00:00.000Z" },
    dragStartedAt: "2026-07-28T17:00:00.000Z",
    dragInterval: 1,
    dragDurationMinutes: 10,
    dragDurationSeconds: 600,
    durationMinutesPerRider: 5,
    entries: [],
  };

  expect(
    getTvWarmupTimerState(dragWarmup, new Date("2026-07-28T17:09:00.000Z"))
  ).toMatchObject({
    cue: "one_minute",
    formatted: "1:00",
    kind: "drag",
    remainingSeconds: 60,
  });
  expect(
    getTvWarmupTimerState({ ...todayWarmup, activeStartedAt: null })
  ).toBeNull();
});
