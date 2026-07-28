import { expect, test } from "vitest";
import {
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
