import { expect, test, vi } from "vitest";
import { createRefreshCoordinator } from "./usePublicShowViewUpdates";

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
