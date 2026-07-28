import { expect, test } from "vitest";
import { isScheduledLiveViewCurrent } from "./liveSchedule";

const FIXED_WARMUP = {
  id: "paid-warmup-17h",
  scheduleDayDate: "2026-07-28",
  scheduleStartMode: "fixed",
  scheduleStartAt: "2026-07-28T17:00:00.000Z",
  stagedEntry: {
    id: "entry-1",
    rider: "Mireille Labrecque",
  },
};

test("keeps a fixed paid warmup upcoming until its scheduled time", () => {
  expect(
    isScheduledLiveViewCurrent(
      FIXED_WARMUP,
      new Date("2026-07-28T16:59:59.000Z")
    )
  ).toBe(false);

  expect(
    isScheduledLiveViewCurrent(
      FIXED_WARMUP,
      new Date("2026-07-28T17:00:00.000Z")
    )
  ).toBe(true);
});

test("lets real activity override a fixed start time", () => {
  expect(
    isScheduledLiveViewCurrent(
      {
        ...FIXED_WARMUP,
        activeEntry: {
          id: "entry-1",
          rider: "Mireille Labrecque",
        },
      },
      new Date("2026-07-28T16:30:00.000Z")
    )
  ).toBe(true);
});

test("keeps the previous behavior when no fixed start is configured", () => {
  expect(
    isScheduledLiveViewCurrent(
      {
        ...FIXED_WARMUP,
        scheduleStartMode: "after_previous",
      },
      new Date("2026-07-28T16:30:00.000Z")
    )
  ).toBe(true);
});
