import { beforeEach, expect, test, vi } from "vitest";

const { getSupabaseClientMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
}));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: getSupabaseClientMock,
  isSupabaseConfigured: () => true,
}));

import { saveUserProfile, signOut } from "./authRepository";

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createSupabaseStub({ firstWrite } = {}) {
  const writes = [];
  let activeRow = null;

  return {
    writes,
    client: {
      from(table) {
        expect(table).toBe("user_profiles");

        const builder = {
          upsert(row) {
            activeRow = row;
            writes.push(row);
            return builder;
          },
          select() {
            return builder;
          },
          maybeSingle() {
            if (writes.length === 1 && firstWrite) {
              return firstWrite.promise;
            }

            return Promise.resolve({
              data: activeRow,
              error: null,
            });
          },
        };

        return builder;
      },
      auth: {
        signOut: vi.fn(() => Promise.resolve({ error: null })),
      },
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  getSupabaseClientMock.mockReset();
});

test("shares concurrent profile writes and only resyncs changed identity", async () => {
  const firstWrite = createDeferred();
  const supabase = createSupabaseStub({ firstWrite });
  getSupabaseClientMock.mockReturnValue(supabase.client);
  const user = {
    id: "user-deduplicated",
    email: "USER@example.com",
    user_metadata: { display_name: "Original Name" },
  };

  const writes = Array.from({ length: 6 }, () => saveUserProfile(user));

  expect(supabase.writes).toHaveLength(1);
  firstWrite.resolve({
    data: supabase.writes[0],
    error: null,
  });
  await Promise.all(writes);

  await saveUserProfile(user);
  expect(supabase.writes).toHaveLength(1);

  await saveUserProfile({
    ...user,
    user_metadata: { display_name: "Updated Name" },
  });
  expect(supabase.writes).toHaveLength(2);
  expect(supabase.writes[1]).toMatchObject({
    user_id: user.id,
    email: "user@example.com",
    display_name: "Updated Name",
  });

  await signOut();
  await saveUserProfile({
    ...user,
    user_metadata: { display_name: "Updated Name" },
  });
  expect(supabase.writes).toHaveLength(3);
});

test("allows a failed profile write to be retried", async () => {
  const firstWrite = createDeferred();
  const supabase = createSupabaseStub({ firstWrite });
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});
  getSupabaseClientMock.mockReturnValue(supabase.client);
  const user = {
    id: "user-retry",
    email: "retry@example.com",
    user_metadata: {},
  };

  const failedWrite = saveUserProfile(user);
  firstWrite.resolve({
    data: null,
    error: new Error("temporary failure"),
  });
  expect(await failedWrite).toBeNull();

  await saveUserProfile(user);

  expect(supabase.writes).toHaveLength(2);
  expect(consoleError).toHaveBeenCalledTimes(1);
  consoleError.mockRestore();
});
