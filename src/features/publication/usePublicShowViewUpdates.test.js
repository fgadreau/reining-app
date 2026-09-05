import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const {
  getSupabaseClientMock,
  isPublicShowViewRealtimeReadyMock,
  applyPublicShowViewRealtimeChangeMock,
  getPublicShowAnnouncerRevisionRepositoryMock,
  getPublicShowAnnouncerRevisionSnapshotMock,
  hasActivePublicAnnouncerSessionMock,
  shouldRefreshForAnnouncerRevisionsMock,
  shouldPublishPublicShowViewSnapshotMock,
  subscribePublicShowViewRepositoryMock,
} = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
  isPublicShowViewRealtimeReadyMock: vi.fn(),
  applyPublicShowViewRealtimeChangeMock: vi.fn(),
  getPublicShowAnnouncerRevisionRepositoryMock: vi.fn(),
  getPublicShowAnnouncerRevisionSnapshotMock: vi.fn(),
  hasActivePublicAnnouncerSessionMock: vi.fn(),
  shouldRefreshForAnnouncerRevisionsMock: vi.fn(),
  shouldPublishPublicShowViewSnapshotMock: vi.fn(),
  subscribePublicShowViewRepositoryMock: vi.fn(),
}));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

vi.mock("./publicViewRepository", () => ({
  applyPublicShowViewRealtimeChange: applyPublicShowViewRealtimeChangeMock,
  getPublicShowAnnouncerRevisionRepository:
    getPublicShowAnnouncerRevisionRepositoryMock,
  getPublicShowAnnouncerRevisionSnapshot:
    getPublicShowAnnouncerRevisionSnapshotMock,
  hasActivePublicAnnouncerSession: hasActivePublicAnnouncerSessionMock,
  isPublicShowViewRealtimeReady: isPublicShowViewRealtimeReadyMock,
  shouldPublishPublicShowViewSnapshot: shouldPublishPublicShowViewSnapshotMock,
  shouldRefreshForAnnouncerRevisions:
    shouldRefreshForAnnouncerRevisionsMock,
  subscribePublicShowViewRepository: subscribePublicShowViewRepositoryMock,
}));

import {
  createRefreshCoordinator,
  getActiveRevisionCheckDelay,
  getFallbackRefreshDelay,
  usePublicShowViewUpdates,
} from "./usePublicShowViewUpdates";

beforeEach(() => {
  getSupabaseClientMock.mockReset();
  isPublicShowViewRealtimeReadyMock.mockReset();
  applyPublicShowViewRealtimeChangeMock.mockReset();
  getPublicShowAnnouncerRevisionRepositoryMock.mockReset();
  getPublicShowAnnouncerRevisionSnapshotMock.mockReset();
  getPublicShowAnnouncerRevisionSnapshotMock.mockImplementation(
    (view) => view?.markers || []
  );
  hasActivePublicAnnouncerSessionMock.mockImplementation(
    (view) => Boolean(view?.announcerActive)
  );
  shouldRefreshForAnnouncerRevisionsMock.mockImplementation(
    (left, right) => JSON.stringify(left) !== JSON.stringify(right)
  );
  shouldPublishPublicShowViewSnapshotMock.mockReset();
  shouldPublishPublicShowViewSnapshotMock.mockReturnValue(true);
  subscribePublicShowViewRepositoryMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

test("serializes refreshes and keeps only one trailing refresh", async () => {
  const first = createDeferred();
  const second = createDeferred();
  const loads = [first, second];
  let activeLoadCount = 0;
  let maxActiveLoadCount = 0;
  const load = vi.fn(async () => {
    const deferred = loads[load.mock.calls.length - 1];
    activeLoadCount += 1;
    maxActiveLoadCount = Math.max(maxActiveLoadCount, activeLoadCount);
    const value = await deferred.promise;
    activeLoadCount -= 1;
    return value;
  });
  const onData = vi.fn();
  const onError = vi.fn();
  const coordinator = createRefreshCoordinator({ load, onData, onError });

  const activeRefresh = coordinator.run();
  coordinator.run();
  coordinator.run();

  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(1);

  first.resolve("first");
  await activeRefresh;
  await vi.waitFor(() => {
    expect(load).toHaveBeenCalledTimes(2);
  });

  second.resolve("second");
  await vi.waitFor(() => {
    expect(onData).toHaveBeenCalledTimes(2);
  });

  expect(maxActiveLoadCount).toBe(1);
  expect(onData).toHaveBeenNthCalledWith(1, "first");
  expect(onData).toHaveBeenNthCalledWith(2, "second");
  expect(onError).not.toHaveBeenCalled();
});

test("does not publish data or run a queued refresh after stop", async () => {
  const deferred = createDeferred();
  const load = vi.fn(() => deferred.promise);
  const onData = vi.fn();
  const onError = vi.fn();
  const coordinator = createRefreshCoordinator({ load, onData, onError });

  const activeRefresh = coordinator.run();
  coordinator.run();
  coordinator.stop();
  deferred.resolve("ignored");
  await activeRefresh;

  expect(load).toHaveBeenCalledTimes(1);
  expect(onData).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});

test("keeps the healthy realtime safety refresh sparse and jittered", () => {
  expect(
    getFallbackRefreshDelay({
      hasRealtime: true,
      isRealtimeSubscribed: true,
      random: () => 0.5,
    })
  ).toBe(600_000);
  expect(
    getFallbackRefreshDelay({
      fallbackRefreshMs: 300_000,
      hasRealtime: true,
      isRealtimeSubscribed: true,
      random: () => 0,
    })
  ).toBe(240_000);
  expect(
    getFallbackRefreshDelay({
      fallbackRefreshMs: 300_000,
      hasRealtime: true,
      isRealtimeSubscribed: true,
      random: () => 1,
    })
  ).toBe(360_000);
});

test("reconciles active sessions before 35 seconds and keeps idle reads sparse", () => {
  expect(
    getActiveRevisionCheckDelay(() => 0)
  ).toBe(16_000);
  expect(
    getActiveRevisionCheckDelay(() => 1)
  ).toBe(24_000);
  expect(
    getFallbackRefreshDelay({
      hasRealtime: true,
      isRealtimeSubscribed: true,
      random: () => 0.5,
    })
  ).toBe(600_000);
});

test("backs off disconnected fallback reads and keeps local mode responsive", () => {
  expect(
    getFallbackRefreshDelay({
      hasRealtime: true,
      isRealtimeSubscribed: false,
      reconnectAttempt: 1,
      random: () => 0.5,
    })
  ).toBe(5_000);
  expect(
    getFallbackRefreshDelay({
      hasRealtime: true,
      isRealtimeSubscribed: false,
      reconnectAttempt: 5,
      random: () => 0.5,
    })
  ).toBe(60_000);
  expect(
    getFallbackRefreshDelay({
      hasRealtime: false,
      reconnectAttempt: 10,
      random: () => 1,
    })
  ).toBe(5_000);
});

test("waits for the complete public view before creating one realtime channel", () => {
  const unsubscribe = vi.fn();
  const load = vi.fn();
  const onData = vi.fn();
  getSupabaseClientMock.mockReturnValue({});
  isPublicShowViewRealtimeReadyMock.mockImplementation(
    (data) => data?.realtimeReady === true
  );
  subscribePublicShowViewRepositoryMock.mockReturnValue(unsubscribe);

  const { rerender, unmount } = renderHook(
    ({ classIds, data }) =>
      usePublicShowViewUpdates({
        showId: "show-1",
        classIds,
        data,
        load,
        onData,
      }),
    {
      initialProps: {
        classIds: [],
        data: { realtimeReady: false },
      },
    }
  );

  expect(subscribePublicShowViewRepositoryMock).not.toHaveBeenCalled();

  rerender({
    classIds: ["class-1"],
    data: { realtimeReady: true },
  });

  expect(subscribePublicShowViewRepositoryMock).toHaveBeenCalledOnce();
  expect(subscribePublicShowViewRepositoryMock).toHaveBeenCalledWith(
    "show-1",
    ["class-1"],
    expect.any(Function),
    expect.any(Function)
  );

  unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

test("does not fully reload when the lightweight active check is unchanged", async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const unsubscribe = vi.fn();
  const refreshedView = {
    realtimeReady: true,
    revision: 2,
    liveClass: { classId: "class-1" },
    announcerActive: true,
    markers: [{ key: "scoring:class-1", value: "2" }],
  };
  const load = vi.fn().mockResolvedValue(refreshedView);
  const onData = vi.fn();
  getSupabaseClientMock.mockReturnValue({});
  getPublicShowAnnouncerRevisionRepositoryMock.mockResolvedValue(
    refreshedView.markers
  );
  isPublicShowViewRealtimeReadyMock.mockReturnValue(true);
  subscribePublicShowViewRepositoryMock.mockImplementation(
    (_showId, _classIds, _onChange, onStatus) => {
      onStatus("SUBSCRIBED");
      return unsubscribe;
    }
  );

  const { unmount } = renderHook(() =>
    usePublicShowViewUpdates({
      showId: "show-1",
      classIds: ["class-1"],
      data: refreshedView,
      load,
      onData,
    })
  );

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(load).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(20_000);
  });
  expect(getPublicShowAnnouncerRevisionRepositoryMock).toHaveBeenCalledOnce();
  expect(load).toHaveBeenCalledTimes(1);
  expect(onData).toHaveBeenLastCalledWith(refreshedView);
  unmount();
});

test("fully reloads when the lightweight revision advances", async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const current = {
    realtimeReady: true,
    liveClass: { classId: "class-1" },
    announcerActive: true,
    markers: [{ key: "scoring:class-1", value: "1" }],
  };
  const refreshed = {
    ...current,
    markers: [{ key: "scoring:class-1", value: "2" }],
  };
  const load = vi.fn().mockResolvedValueOnce(current).mockResolvedValue(refreshed);
  getSupabaseClientMock.mockReturnValue({});
  isPublicShowViewRealtimeReadyMock.mockReturnValue(true);
  getPublicShowAnnouncerRevisionRepositoryMock.mockResolvedValue(
    refreshed.markers
  );
  subscribePublicShowViewRepositoryMock.mockImplementation(
    (_showId, _classIds, _onChange, onStatus) => {
      onStatus("SUBSCRIBED");
      return vi.fn();
    }
  );

  const { unmount } = renderHook(() =>
    usePublicShowViewUpdates({
      showId: "show-1",
      classIds: ["class-1"],
      data: current,
      load,
      onData: vi.fn(),
    })
  );
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(load).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(20_000));

  expect(getPublicShowAnnouncerRevisionRepositoryMock).toHaveBeenCalledOnce();
  expect(load).toHaveBeenCalledTimes(2);
  unmount();
});

test.each(["CHANNEL_ERROR", "TIMED_OUT"])(
  "reconciles after %s without creating another subscription",
  async (status) => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    let statusCallback;
    const load = vi.fn().mockResolvedValue({ realtimeReady: true });
    getSupabaseClientMock.mockReturnValue({});
    isPublicShowViewRealtimeReadyMock.mockReturnValue(true);
    subscribePublicShowViewRepositoryMock.mockImplementation(
      (_showId, _classIds, _onChange, onStatus) => {
        statusCallback = onStatus;
        return unsubscribe;
      }
    );

    const { unmount } = renderHook(() =>
      usePublicShowViewUpdates({
        showId: "show-1",
        classIds: [],
        data: { realtimeReady: true },
        load,
        onData: vi.fn(),
      })
    );

    act(() => statusCallback(status));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(load).toHaveBeenCalledOnce();
    expect(subscribePublicShowViewRepositoryMock).toHaveBeenCalledOnce();
    unmount();
  }
);

test("keeps a slow complete refresh for non-announcer sources", async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const view = { realtimeReady: true, liveClass: { classId: "class-1" } };
  const load = vi.fn().mockResolvedValue(view);
  getSupabaseClientMock.mockReturnValue({});
  isPublicShowViewRealtimeReadyMock.mockReturnValue(true);
  subscribePublicShowViewRepositoryMock.mockImplementation(
    (_showId, _classIds, _onChange, onStatus) => {
      onStatus("SUBSCRIBED");
      return vi.fn();
    }
  );

  const { unmount } = renderHook(() =>
    usePublicShowViewUpdates({
      showId: "show-1",
      classIds: ["class-1"],
      data: view,
      load,
      onData: vi.fn(),
    })
  );
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(load).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTimeAsync(600_000));

  expect(load).toHaveBeenCalledTimes(2);
  expect(getPublicShowAnnouncerRevisionRepositoryMock).not.toHaveBeenCalled();
  unmount();
});

test("does not publish an old GET completed after a newer realtime event", async () => {
  vi.useFakeTimers();
  const deferred = createDeferred();
  const current = { realtimeReady: true, revision: 1 };
  const realtime2 = { realtimeReady: true, revision: 2 };
  const realtime3 = { realtimeReady: true, revision: 3 };
  const staleRest = { realtimeReady: true, revision: 1 };
  const freshRest = { realtimeReady: true, revision: 3 };
  const onData = vi.fn();
  const load = vi
    .fn()
    .mockReturnValueOnce(deferred.promise)
    .mockResolvedValue(freshRest);
  let onChange;
  let onStatus;
  getSupabaseClientMock.mockReturnValue({});
  isPublicShowViewRealtimeReadyMock.mockReturnValue(true);
  applyPublicShowViewRealtimeChangeMock.mockImplementation(
    (_latest, payload) =>
      payload.event_seq === 2 ? realtime2 : realtime3
  );
  subscribePublicShowViewRepositoryMock.mockImplementation(
    (_showId, _classIds, nextOnChange, nextOnStatus) => {
      onChange = nextOnChange;
      onStatus = nextOnStatus;
      return vi.fn();
    }
  );

  const { unmount } = renderHook(() =>
    usePublicShowViewUpdates({
      showId: "show-1",
      classIds: [],
      data: current,
      load,
      onData,
    })
  );

  act(() => onStatus("SUBSCRIBED"));
  await act(async () => vi.advanceTimersByTimeAsync(300));
  act(() => onChange({ event_seq: 2 }));
  act(() => onChange({ event_seq: 3 }));
  deferred.resolve(staleRest);
  await act(async () => deferred.promise);
  await act(async () => Promise.resolve());

  expect(onData).toHaveBeenCalledWith(realtime2);
  expect(onData).toHaveBeenCalledWith(realtime3);
  expect(onData).not.toHaveBeenCalledWith(staleRest);
  expect(onData).toHaveBeenCalledWith(freshRest);
  expect(load).toHaveBeenCalledTimes(2);
  unmount();
});

test("cleans up timers, subscription and pending async results on unmount", async () => {
  vi.useFakeTimers();
  const deferred = createDeferred();
  const unsubscribe = vi.fn();
  const onData = vi.fn();
  let statusCallback;
  getSupabaseClientMock.mockReturnValue({});
  isPublicShowViewRealtimeReadyMock.mockReturnValue(true);
  subscribePublicShowViewRepositoryMock.mockImplementation(
    (_showId, _classIds, _onChange, onStatus) => {
      statusCallback = onStatus;
      return unsubscribe;
    }
  );

  const { unmount } = renderHook(() =>
    usePublicShowViewUpdates({
      showId: "show-1",
      classIds: [],
      data: {
        realtimeReady: true,
        announcerActive: true,
        markers: [{ classId: "class-1", revision: 1 }],
      },
      load: () => deferred.promise,
      onData,
    })
  );
  act(() => statusCallback("SUBSCRIBED"));
  await act(async () => vi.advanceTimersByTimeAsync(300));
  unmount();
  deferred.resolve({ realtimeReady: true, revision: 2 });
  await act(async () => deferred.promise);
  await act(async () => vi.runAllTimersAsync());

  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(onData).not.toHaveBeenCalled();
  expect(getPublicShowAnnouncerRevisionRepositoryMock).not.toHaveBeenCalled();
});

test("ignores a lightweight probe resolved after unmount", async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const probe = createDeferred();
  const view = {
    realtimeReady: true,
    announcerActive: true,
    markers: [{ classId: "class-1", revision: 1 }],
  };
  const load = vi.fn().mockResolvedValue(view);
  getSupabaseClientMock.mockReturnValue({});
  isPublicShowViewRealtimeReadyMock.mockReturnValue(true);
  getPublicShowAnnouncerRevisionRepositoryMock.mockReturnValue(probe.promise);
  subscribePublicShowViewRepositoryMock.mockImplementation(
    (_showId, _classIds, _onChange, onStatus) => {
      onStatus("SUBSCRIBED");
      return vi.fn();
    }
  );

  const { unmount } = renderHook(() =>
    usePublicShowViewUpdates({
      showId: "show-1",
      classIds: ["class-1"],
      data: view,
      load,
      onData: vi.fn(),
    })
  );
  await act(async () => vi.advanceTimersByTimeAsync(300));
  await act(async () => vi.advanceTimersByTimeAsync(20_000));
  expect(getPublicShowAnnouncerRevisionRepositoryMock).toHaveBeenCalledOnce();
  unmount();
  probe.resolve([{ classId: "class-1", revision: 2 }]);
  await act(async () => probe.promise);

  expect(load).toHaveBeenCalledOnce();
});

test("ignores a show-1 GET resolved after switching to show-2", async () => {
  vi.useFakeTimers();
  const show1Request = createDeferred();
  const show1 = { realtimeReady: true, showId: "show-1" };
  const show2 = { realtimeReady: true, showId: "show-2" };
  const onData = vi.fn();
  getSupabaseClientMock.mockReturnValue({});
  isPublicShowViewRealtimeReadyMock.mockReturnValue(true);
  subscribePublicShowViewRepositoryMock.mockImplementation(
    (_showId, _classIds, _onChange, onStatus) => {
      onStatus("SUBSCRIBED");
      return vi.fn();
    }
  );

  const { rerender, unmount } = renderHook(
    ({ showId, data, load }) =>
      usePublicShowViewUpdates({
        showId,
        classIds: [],
        data,
        load,
        onData,
      }),
    {
      initialProps: {
        showId: "show-1",
        data: show1,
        load: () => show1Request.promise,
      },
    }
  );
  await act(async () => vi.advanceTimersByTimeAsync(300));

  rerender({ showId: "show-2", data: show2, load: async () => show2 });
  await act(async () => vi.advanceTimersByTimeAsync(300));
  show1Request.resolve(show1);
  await act(async () => show1Request.promise);

  expect(onData).toHaveBeenCalledTimes(1);
  expect(onData).toHaveBeenCalledWith(show2);
  unmount();
});

test("keeps general TV, arena TV, competition TV and overlay on the shared hook", () => {
  const tvSource = readFileSync(
    join(process.cwd(), "src/pages/public/PublicShowTvPage.jsx"),
    "utf8"
  );
  const overlaySource = readFileSync(
    join(process.cwd(), "src/pages/public/PublicShowOverlayPage.jsx"),
    "utf8"
  );

  expect(tvSource).toContain("usePublicShowViewUpdates({");
  expect(tvSource).toContain('requestedDisplayMode === "competition"');
  expect(tvSource).toContain("selectedArena");
  expect(overlaySource).toContain("usePublicShowViewUpdates({");
});
