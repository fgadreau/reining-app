import { renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

const {
  getSupabaseClientMock,
  isPublicShowViewRealtimeReadyMock,
  subscribePublicShowViewRepositoryMock,
} = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
  isPublicShowViewRealtimeReadyMock: vi.fn(),
  subscribePublicShowViewRepositoryMock: vi.fn(),
}));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

vi.mock("./publicViewRepository", () => ({
  applyPublicShowViewRealtimeChange: vi.fn(),
  isPublicShowViewRealtimeReady: isPublicShowViewRealtimeReadyMock,
  subscribePublicShowViewRepository: subscribePublicShowViewRepositoryMock,
}));

import {
  createRefreshCoordinator,
  getFallbackRefreshDelay,
  usePublicShowViewUpdates,
} from "./usePublicShowViewUpdates";

beforeEach(() => {
  getSupabaseClientMock.mockReset();
  isPublicShowViewRealtimeReadyMock.mockReset();
  subscribePublicShowViewRepositoryMock.mockReset();
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
