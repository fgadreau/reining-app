import { describe, expect, test } from "vitest";
import {
  filterShowDaySections,
  getShowDayQueryPath,
  resolveActiveShowDayId,
} from "./showDayNavigation";

const days = [
  { id: "day-2", date: "2026-08-05", label: "Mercredi" },
  { id: "day-1", date: "2026-08-04", label: "Mardi" },
  { id: "day-3", date: "2026-08-06", label: "Jeudi" },
];

describe("show day navigation", () => {
  test("keeps an explicitly selected day", () => {
    expect(resolveActiveShowDayId(days, "day-2", "2026-08-04")).toBe(
      "day-2"
    );
  });

  test("defaults to today, then the next day, then the last day", () => {
    expect(resolveActiveShowDayId(days, "", "2026-08-04")).toBe("day-1");
    expect(resolveActiveShowDayId(days, "", "2026-08-05")).toBe("day-2");
    expect(resolveActiveShowDayId(days, "", "2026-08-10")).toBe("day-3");
  });

  test("filters already loaded sections without refetching them", () => {
    const sections = days.map((day) => ({ day, rows: [day.id] }));
    expect(filterShowDaySections(sections, "day-2")).toEqual([
      { day: days[0], rows: ["day-2"] },
    ]);
  });

  test("carries the selected day between management views", () => {
    expect(getShowDayQueryPath("/shows/show-1/secretariat", "day 2")).toBe(
      "/shows/show-1/secretariat?day=day%202"
    );
  });
});
