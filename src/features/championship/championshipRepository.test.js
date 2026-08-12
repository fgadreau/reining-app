import { beforeEach, expect, test, vi } from "vitest";

const supabaseState = vi.hoisted(() => ({ client: null, privateRow: null }));

vi.mock("../cloud/supabaseClient", () => ({
  getSupabaseClient: () => supabaseState.client,
}));

import { saveChampionshipSeasonRepository } from "./championshipRepository";

beforeEach(() => {
  localStorage.clear();
  supabaseState.privateRow = null;
  supabaseState.client = {
    from(table) {
      if (table === "show_score_championship_seasons") {
        return {
          upsert(row) {
            supabaseState.privateRow = row;
            return {
              select() {
                return {
                  async maybeSingle() {
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
        };
      }

      return {
        async upsert() {
          return { error: null };
        },
      };
    },
    async rpc() {
      return { data: null, error: null };
    },
  };
});

test("saves a large season to the server when championship localStorage exceeds quota", async () => {
  const storagePrototype = Object.getPrototypeOf(localStorage);
  const originalSetItem = storagePrototype.setItem;
  const setItem = vi.spyOn(storagePrototype, "setItem").mockImplementation(function (key, value) {
    if (key === "showscore_championship_seasons_v1") {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    }
    return originalSetItem.call(this, key, value);
  });
  const rows = Array.from({ length: 2266 }, (_, index) => ({
    sourceRowNumber: index + 1,
    rider: `Rider ${index}`,
    horse: `Horse ${index}`,
    classCode: "3999",
  }));

  try {
    const saved = await saveChampionshipSeasonRepository({
      associationId: "aqr",
      title: "Championnat AQR",
      year: "2026",
      status: "published",
      imports: [{ id: "large-import", rows }],
      classes: [],
      classCount: 1,
      rowCount: rows.length,
    });

    expect(saved._localFirstSync.status).toBe("synced");
    expect(supabaseState.privateRow.season_payload.imports[0].rows).toHaveLength(2266);
  } finally {
    setItem.mockRestore();
  }
});
