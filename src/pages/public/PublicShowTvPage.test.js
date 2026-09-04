import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  getAssociation: vi.fn(),
  getCachedView: vi.fn(() => ({ classIds: [] })),
  getView: vi.fn(),
}));

vi.mock("../../features/publication/publicViewRepository", async (importOriginal) => {
  const original = await importOriginal();

  return {
    ...original,
    getPublicAssociationRepository: repositoryMocks.getAssociation,
    getPublicShowView: repositoryMocks.getCachedView,
    getPublicShowViewRepository: repositoryMocks.getView,
  };
});

vi.mock("../../features/publication/usePublicShowViewUpdates", () => ({
  usePublicShowViewUpdates: vi.fn(),
}));

vi.mock("../../features/tvDisplay/tvDisplayShortCode", () => ({
  rememberTvDisplayShortcut: vi.fn(),
}));

import {
  CompetitionVideoPanel,
  getTvWarmupTimerState,
  pickTvLiveItem,
  pickTvUpcomingItem,
} from "./PublicShowTvPage";
import PublicShowTvPage from "./PublicShowTvPage";
import { I18nProvider } from "../../features/i18n/I18nProvider";

beforeEach(() => {
  repositoryMocks.getAssociation.mockResolvedValue({
    id: "association-1",
    name: "Association test",
  });
  repositoryMocks.getCachedView.mockReturnValue({ classIds: [] });
  repositoryMocks.getView.mockImplementation(async (showId) => ({
    classIds: [],
    liveClasses: [],
    livePaidWarmups: [],
    show: {
      id: showId,
      associationId: "association-1",
      name: showId === "show-2" ? "Derby de Québec" : "Classique automnale",
      tvDisplayVideoArena: "101",
      tvDisplayVideoPath: `https://example.com/${showId}.mp4`,
    },
  }));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderTvRoute(initialEntry) {
  const router = createMemoryRouter(
    [
      {
        path: "/public/:associationId/shows/:showId/tv",
        element: React.createElement(PublicShowTvPage),
      },
    ],
    { initialEntries: [initialEntry] }
  );

  render(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(RouterProvider, { router })
    )
  );
  return router;
}

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

test("identifies the show while competition video waits for live publication", async () => {
  renderTvRoute("/public/association-1/shows/show-1/tv?mode=competition&arena=101");

  const showName = await screen.findByText("Classique automnale");

  expect(showName.hasAttribute("data-tv-competition-show-name")).toBe(true);
  expect(screen.getByText(/Les données du passage apparaîtront ici/)).toBeTruthy();
  expect(screen.getByText(/Run data will appear here/)).toBeTruthy();
  expect(document.querySelector("[data-tv-competition-video]")).toBeTruthy();
});

test("updates the competition waiting identity after a show route change", async () => {
  const router = renderTvRoute(
    "/public/association-1/shows/show-1/tv?mode=competition&arena=101"
  );
  await screen.findByText("Classique automnale");

  await act(() =>
    router.navigate(
      "/public/association-1/shows/show-2/tv?mode=competition&arena=101"
    )
  );

  await waitFor(() => {
    expect(
      document.querySelector("[data-tv-competition-show-name]")?.textContent
    ).toBe("Derby de Québec");
  });
});

test("keeps the competition live strip unchanged once a competitor is live", () => {
  render(
    React.createElement(CompetitionVideoPanel, {
      videoUrl: "https://example.com/arena.mp4",
      showName: "Classique automnale",
      liveItem: {
        kind: "class",
        item: {
          activeRun: { rider: "Camille Roy", horse: "Silver Star" },
          lastPassedRuns: [],
        },
      },
    })
  );

  expect(screen.getByText("Camille Roy")).toBeTruthy();
  expect(
    document.querySelector("[data-tv-competition-show-name]")
  ).toBeNull();
  expect(screen.queryByText(/Les données du passage apparaîtront ici/)).toBeNull();
});

test("leaves the general TV mode on its existing welcome layout", async () => {
  renderTvRoute("/public/association-1/shows/show-1/tv?arena=101");

  expect(await screen.findAllByText("Classique automnale")).toHaveLength(2);
  expect(document.querySelector("[data-tv-layout='competition-video']")).toBeNull();
  expect(document.querySelector("[data-tv-competition-show-name]")).toBeNull();
  expect(document.querySelector(".tv-header")).toBeTruthy();
});
