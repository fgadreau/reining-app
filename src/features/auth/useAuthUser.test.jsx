import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useAuthUser } from "./useAuthUser";
import { clearLocalTestSession, saveLocalTestSession } from "./localTestAuth";

vi.mock("../cloud/supabaseClient", () => ({
  isSupabaseConfigured: () => false,
  getSupabaseClient: () => null,
}));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

test("loads the local scribe identity without a configured cloud client", async () => {
  saveLocalTestSession();
  const { result } = renderHook(() => useAuthUser());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toMatchObject({
    isConfigured: false,
    isAuthenticated: true,
    isLocalTestUser: true,
    user: { id: "local-test-user", email: "test@showscore.local" },
  });
});

test("observes local sign-in and sign-out without inventing an identity", async () => {
  const { result } = renderHook(() => useAuthUser());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.user).toBeNull();
  act(() => saveLocalTestSession());
  await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
  act(() => clearLocalTestSession());
  await waitFor(() => expect(result.current.user).toBeNull());
  expect(result.current.isConfigured).toBe(false);
});
