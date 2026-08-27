import { beforeEach, expect, test, vi } from "vitest";

const { getSupabaseClientMock } = vi.hoisted(() => ({
  getSupabaseClientMock: vi.fn(),
}));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: getSupabaseClientMock,
}));

import {
  getClassSetupRepository,
  getClassSetupsForClassesRepository,
  saveClassSetupRepository,
} from "./classSetupRepository";
import { saveClassSetup } from "./classSetupStorage";

function createSupabaseStub({ failUpserts = 0 } = {}) {
  const rows = new Map();
  const upserts = [];
  let remainingFailedUpserts = failUpserts;

  const client = {
    from(table) {
      expect(table).toBe("show_score_block_setups");
      const query = { filter: null };

      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          query.filter = { column, values: [value] };
          return builder;
        },
        in(column, values) {
          query.filter = { column, values };
          return builder;
        },
        async maybeSingle() {
          const row = rows.get(query.filter?.values?.[0]) || null;
          return { data: row, error: null };
        },
        async upsert(row) {
          upserts.push(row);

          if (remainingFailedUpserts > 0) {
            remainingFailedUpserts -= 1;
            return { data: null, error: new Error("offline") };
          }

          rows.set(row.block_id, row);
          return { data: row, error: null };
        },
        then(resolve, reject) {
          const values = query.filter?.values || [];
          const data = values.map((id) => rows.get(id)).filter(Boolean);
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };

      return builder;
    },
  };

  return { client, rows, upserts };
}

function createImportedDraw() {
  return {
    pattern: "10",
    isDrawImported: true,
    runs: [
      {
        id: "run-1",
        order: 1,
        backNumber: "101",
        rider: "Rider One",
        horse: "Horse One",
      },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
  getSupabaseClientMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

test("keeps a failed setup save pending and retries it on the next load", async () => {
  const supabase = createSupabaseStub({ failUpserts: 1 });
  getSupabaseClientMock.mockReturnValue(supabase.client);

  await saveClassSetupRepository("class-1", createImportedDraw());

  expect(supabase.rows.has("class-1")).toBe(false);

  const recovered = await getClassSetupRepository("class-1");

  expect(recovered.isDrawImported).toBe(true);
  expect(recovered.runs).toHaveLength(1);
  expect(supabase.upserts).toHaveLength(2);
  expect(supabase.rows.get("class-1")?.is_draw_imported).toBe(true);
});

test("backfills a legacy imported draw when its cloud setup row is missing", async () => {
  const supabase = createSupabaseStub();
  getSupabaseClientMock.mockReturnValue(supabase.client);
  saveClassSetup("class-2", createImportedDraw());

  await getClassSetupRepository("class-2");

  expect(supabase.upserts).toHaveLength(1);
  expect(supabase.rows.get("class-2")?.runs).toHaveLength(1);
});

test("backfills missing imported draws during batched class hydration", async () => {
  const supabase = createSupabaseStub();
  getSupabaseClientMock.mockReturnValue(supabase.client);
  saveClassSetup("class-3", createImportedDraw());

  const setups = await getClassSetupsForClassesRepository(["class-3"]);

  expect(setups["class-3"].isDrawImported).toBe(true);
  expect(supabase.upserts).toHaveLength(1);
  expect(supabase.rows.get("class-3")?.is_draw_imported).toBe(true);
});

test("does not publish an empty local default as a recovered draw", async () => {
  const supabase = createSupabaseStub();
  getSupabaseClientMock.mockReturnValue(supabase.client);

  await getClassSetupRepository("class-empty");

  expect(supabase.upserts).toHaveLength(0);
});
