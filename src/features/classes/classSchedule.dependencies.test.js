import { expect, test } from "vitest";
import { sortScheduleItemsByDependencies } from "./classSchedule";
import { buildLiveScheduleItems, findNextScheduleItemInArena } from "../schedule/liveSchedule";

test("places an explicitly linked block directly after its predecessor", () => {
  const ordered = sortScheduleItemsByDependencies([
    { id: "later-by-number", name: "Unrelated", sortOrder: 2 },
    { id: "follower", name: "Follower", sortOrder: 90, followsBlockId: "anchor" },
    { id: "anchor", name: "Anchor", sortOrder: 1, scheduleStartMode: "fixed", scheduleStartTime: "08:00" },
  ]);

  expect(ordered.map((item) => item.id)).toEqual([
    "anchor",
    "follower",
    "later-by-number",
  ]);
});

test("keeps an explicit dependency chain in ShowScore live progression", () => {
  const schedule = buildLiveScheduleItems({
    days: [{ id: "day-1", sortOrder: 1, date: "2026-08-04" }],
    classes: [
      { id: "unrelated", dayId: "day-1", arena: "Main", name: "Unrelated", sortOrder: 2 },
      { id: "third", dayId: "day-1", arena: "Main", name: "Third", sortOrder: 100, followsBlockId: "second" },
      { id: "second", dayId: "day-1", arena: "Main", name: "Second", sortOrder: 90, followsBlockId: "first" },
      { id: "first", dayId: "day-1", arena: "Main", name: "First", sortOrder: 1, scheduleStartMode: "fixed", scheduleStartTime: "08:00" },
    ],
  });

  expect(schedule.map((item) => item.itemId)).toEqual([
    "first",
    "second",
    "third",
    "unrelated",
  ]);
  expect(findNextScheduleItemInArena(schedule, schedule[0], "Main")?.itemId).toBe("second");
});
