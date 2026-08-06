import { expect, test, vi } from "vitest";
import {
  createRefreshCoordinator,
  getFallbackRefreshDelay,
} from "./usePublicShowViewUpdates";

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
