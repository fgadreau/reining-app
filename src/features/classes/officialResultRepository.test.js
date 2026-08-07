import { describe, expect, test } from "vitest";
import { assertHspScoredRunSync } from "./officialResultRepository";

describe("approbation annonceur vers HSP", () => {
  test("accepte une synchronisation complète", () => {
    expect(
      assertHspScoredRunSync({
        ok: true,
        syncedCount: 2,
        skippedCount: 0,
        error: null,
      })
    ).toMatchObject({ ok: true, syncedCount: 2 });
  });

  test("refuse une fausse réussite quand HSP ne peut pas recevoir les résultats", () => {
    expect(() =>
      assertHspScoredRunSync({
        ok: false,
        syncedCount: 0,
        skippedCount: 2,
        error: "permission denied for scored_runs",
      })
    ).toThrow(
      "Les résultats ont été approuvés, mais leur synchronisation vers HSP a échoué: permission denied for scored_runs"
    );
  });
});
