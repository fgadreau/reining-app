import { beforeEach, expect, test, vi } from "vitest";
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  client: null,
}));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: () => supabaseMocks.client,
}));

vi.mock("../publication/publicationCloudRepository", () => ({
  advanceArenaLivePaidWarmupAfterCompletionRepository: vi.fn(),
  advanceArenaLiveClassAfterCompletionRepository: vi.fn(),
}));

import { savePaidWarmupLiveRepository } from "./paidWarmupRepository";
import { getPaidWarmupById } from "./paidWarmupStorage";
import { stopPaidWarmupTimer } from "./paidWarmupLive";
import { useSavePaidWarmupUpdate } from "../../pages/association/AnnouncerDashboardPage";
import { advanceArenaLivePaidWarmupAfterCompletionRepository } from "../publication/publicationCloudRepository";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

function createSupabase({ rpcResult }) {
  const insertedRows = [];
  const updatedRows = [];
  const insert = vi.fn(async (row) => {
    insertedRows.push(row);
    return { error: null };
  });
  const select = vi.fn(async () => ({ data: [{ id: "warmup-1" }], error: null }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn((row) => {
    updatedRows.push(row);
    return { eq };
  });
  const from = vi.fn(() => ({ insert, update }));
  const rpc = vi.fn(() => rpcResult);

  return {
    client: { from, rpc },
    insert,
    insertedRows,
    rpc,
    update,
    updatedRows,
  };
}

function completedWarmup() {
  return {
    id: "warmup-1",
    associationId: "association-1",
    showId: "show-1",
    dayId: "day-1",
    name: "Warm-up test",
    arena: "101",
    durationMinutesPerRider: 5,
    isPublicLive: false,
    activeEntryId: null,
    activeStartedAt: null,
    entries: [
      {
        id: "entry-1",
        rider: "Marie",
        status: "done",
        completedAt: "2026-09-04T16:24:17.462Z",
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  supabaseMocks.client = null;
});

afterEach(cleanup);

test("persists one closed payload when the live RPC responds slowly", async () => {
  const deferred = createDeferred();
  const supabase = createSupabase({ rpcResult: deferred.promise });
  supabaseMocks.client = supabase.client;

  const saving = savePaidWarmupLiveRepository(completedWarmup());

  expect(supabase.rpc).toHaveBeenCalledWith(
    "save_show_score_paid_warmup_live",
    expect.objectContaining({
      target_active_entry_id: null,
      target_active_started_at: null,
      target_is_public_live: false,
      target_entries: [expect.objectContaining({ status: "done" })],
    })
  );
  expect(supabase.update).not.toHaveBeenCalled();
  expect(getPaidWarmupById("warmup-1")).toMatchObject({
    activeStartedAt: null,
    isPublicLive: false,
  });

  deferred.resolve({ data: null, error: null });
  await expect(saving).resolves.toMatchObject({
    activeEntryId: null,
    activeStartedAt: null,
    isPublicLive: false,
  });
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});

test.each([
  "Could not find save_show_score_paid_warmup_live",
  "Could not find the function with the supplied parameters in the schema cache",
])("rejects PGRST202 without any direct table write: %s", async (message) => {
  const error = { code: "PGRST202", message };
  const supabase = createSupabase({
    rpcResult: Promise.resolve({
      data: null,
      error,
    }),
  });
  supabaseMocks.client = supabase.client;

  await expect(
    savePaidWarmupLiveRepository(completedWarmup())
  ).rejects.toBe(error);
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.client.from).not.toHaveBeenCalled();
});

test("double stop advances the queue once after a slow save and never republishes", async () => {
  const saving = createDeferred();
  const advancing = createDeferred();
  const refreshing = createDeferred();
  const supabase = createSupabase({ rpcResult: saving.promise });
  supabaseMocks.client = supabase.client;
  advanceArenaLivePaidWarmupAfterCompletionRepository.mockReturnValue(advancing.promise);
  const refresh = vi.fn(() => refreshing.promise);
  const setView = vi.fn();
  const generation = { current: 0 };
  const { result, rerender } = renderHook(() =>
    useSavePaidWarmupUpdate("show-1", refresh, setView, generation)
  );
  const active = {
    ...completedWarmup(),
    isPublicLive: true,
    activeEntryId: "entry-1",
    activeStartedAt: "2026-09-04T16:20:00.000Z",
    entries: [{ id: "entry-1", rider: "Marie", status: "pending" }],
  };
  const stop = () => result.current(
    stopPaidWarmupTimer(active, new Date("2026-09-04T16:25:00.000Z")),
    active.isPublicLive
  );
  await act(async () => { await stop(); await stop(); });
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(advanceArenaLivePaidWarmupAfterCompletionRepository).not.toHaveBeenCalled();

  await act(async () => { saving.resolve({ data: null, error: null }); });
  expect(advanceArenaLivePaidWarmupAfterCompletionRepository).toHaveBeenCalledTimes(1);
  expect(advanceArenaLivePaidWarmupAfterCompletionRepository).toHaveBeenCalledWith({
    showId: "show-1", arena: "101", paidWarmupId: "warmup-1",
  });
  rerender();
  // A stale click while advancement or refresh is pending is still coalesced.
  await act(async () => { await stop(); advancing.resolve(null); });
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  await act(async () => { await stop(); refreshing.resolve(null); });

  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(advanceArenaLivePaidWarmupAfterCompletionRepository).toHaveBeenCalledTimes(1);
  expect(supabase.client.from).not.toHaveBeenCalled();
  expect(supabase.rpc.mock.calls[0][1]).toMatchObject({
    target_is_public_live: false,
    target_active_entry_id: null,
    target_active_started_at: null,
    target_entries: [expect.objectContaining({ status: "done" })],
  });
  expect(getPaidWarmupById("warmup-1")).toMatchObject({
    isPublicLive: false, activeEntryId: null, activeStartedAt: null,
    entries: [expect.objectContaining({ status: "done" })],
  });
});

test("keeps double stop submissions idempotently non-public", async () => {
  const deferredFirst = createDeferred();
  const deferredSecond = createDeferred();
  const supabase = createSupabase({ rpcResult: deferredFirst.promise });
  supabase.rpc
    .mockImplementationOnce(() => deferredFirst.promise)
    .mockImplementationOnce(() => deferredSecond.promise);
  supabaseMocks.client = supabase.client;

  const first = savePaidWarmupLiveRepository(completedWarmup());
  const second = savePaidWarmupLiveRepository(completedWarmup());

  expect(
    supabase.rpc.mock.calls.every(
      ([, payload]) => payload.target_is_public_live === false
    )
  ).toBe(true);
  deferredSecond.resolve({ data: null, error: null });
  deferredFirst.resolve({ data: null, error: null });
  await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  expect(
    supabase.rpc.mock.calls.some(
      ([, payload]) => payload.target_is_public_live === true
    )
  ).toBe(false);
});

test("surfaces a real save error without scheduling a later public payload", async () => {
  const supabase = createSupabase({
    rpcResult: Promise.resolve({
      data: null,
      error: { code: "42501", message: "permission denied" },
    }),
  });
  supabaseMocks.client = supabase.client;

  await expect(
    savePaidWarmupLiveRepository(completedWarmup())
  ).rejects.toMatchObject({
    code: "42501",
  });
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
  expect(supabase.update).not.toHaveBeenCalled();
  expect(getPaidWarmupById("warmup-1")).toMatchObject({
    activeStartedAt: null,
    isPublicLive: false,
  });
  expect(
    supabase.rpc.mock.calls.some(
      ([, payload]) => payload.target_is_public_live === true
    )
  ).toBe(false);
});
