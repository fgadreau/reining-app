import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getQueuedAnnouncerLiveMutations } from "./announcerLiveSyncQueue";

const neverResolvingRequest = new Promise(() => {});
const abortSignal = vi.fn(() => neverResolvingRequest);

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: () => ({
    rpc: () => ({ abortSignal }),
  }),
}));

describe("announcer live repository", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    abortSignal.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test("returns the local save without waiting for an unreachable cloud", async () => {
    const { saveAnnouncerLiveSessionRepository } = await import(
      "./announcerLiveRepository"
    );
    const statuses = [];

    const result = await saveAnnouncerLiveSessionRepository(
      "class-offline",
      { classId: "class-offline", runs: [] },
      { onStatusChange: (status) => statuses.push(status) }
    );

    expect(result.classId).toBe("class-offline");
    expect(getQueuedAnnouncerLiveMutations()).toHaveLength(1);
    expect(statuses).toEqual(["local", "syncing"]);
    expect(abortSignal).toHaveBeenCalledOnce();
  });
});
