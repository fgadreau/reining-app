import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import { I18nProvider } from "../features/i18n/I18nProvider";
import ShowDayTabs, { useShowDaySelection } from "./ShowDayTabs";

const days = [
  { id: "day-1", date: "2026-08-04", label: "Mardi" },
  { id: "day-2", date: "2026-08-05", label: "Mercredi" },
];

function TabsHarness() {
  const selection = useShowDaySelection(days);

  return (
    <ShowDayTabs
      days={selection.days}
      activeDayId={selection.activeDayId}
      onChange={selection.selectDay}
      countsByDayId={{ "day-1": 2, "day-2": 4 }}
    />
  );
}

describe("ShowDayTabs", () => {
  test("switches the active day through an in-page tab", () => {
    render(
      <MemoryRouter initialEntries={["/?day=day-1"]}>
        <I18nProvider>
          <TabsHarness />
        </I18nProvider>
      </MemoryRouter>
    );

    const firstDay = screen.getByRole("tab", { name: /Mardi/ });
    const secondDay = screen.getByRole("tab", { name: /Mercredi/ });
    expect(firstDay.getAttribute("aria-selected")).toBe("true");
    expect(secondDay.textContent).toContain("4");

    fireEvent.click(secondDay);

    expect(firstDay.getAttribute("aria-selected")).toBe("false");
    expect(secondDay.getAttribute("aria-selected")).toBe("true");
  });
});
