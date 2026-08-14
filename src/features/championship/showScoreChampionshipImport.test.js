import { describe, expect, test } from "vitest";
import { resolveAssociationChampionshipClass } from "./associationClassDictionary";
import { buildChampionshipDatasetFromImports } from "./championshipStandings";
import {
  buildShowScoreChampionshipImportBatch,
  buildShowScoreChampionshipImportPreview,
  getShowScoreChampionshipSelectionSummary,
} from "./showScoreChampionshipImport";

const association = { shortName: "AQR" };

describe("association-managed championship classes", () => {
  test("an unknown source code can become a custom championship class", () => {
    const match = resolveAssociationChampionshipClass({
      association,
      code: "NEW-42",
      name: "Classe invitée",
      classMappings: {
        "NEW-42": {
          enabled: true,
          custom: true,
          label: "Classe spéciale",
        },
      },
    });

    expect(match).toMatchObject({
      status: "matched",
      championshipClassId: "custom:NEW-42",
      championshipClassCode: "NEW-42",
      championshipClassName: "Classe spéciale",
    });
  });

  test("an explicit mapping can override a default exclusion", () => {
    const match = resolveAssociationChampionshipClass({
      association,
      code: "5393",
      name: "Novice Horse NP - AQR",
      classMappings: {
        5393: {
          enabled: true,
          custom: true,
          label: "Novice Horse NP – championnat",
        },
      },
    });

    expect(match.status).toBe("matched");
    expect(match.championshipClassName).toBe(
      "Novice Horse NP – championnat"
    );
  });

  test("custom mapped ShowScore rows are selectable and imported", () => {
    const preview = buildShowScoreChampionshipImportPreview({
      association,
      classMappings: {
        7777: {
          enabled: true,
          custom: true,
          label: "Classe locale",
        },
      },
      classDataItems: [
        {
          classItem: { id: "class-1", showId: "show-1", name: "Locale" },
          show: { id: "show-1", name: "Show test" },
          day: { date: "2026-08-14" },
          official: {
            isSecretariatValidated: true,
            isFinalized: true,
            officialRuns: [
              {
                id: "run-1",
                classCodes: ["7777"],
                rider: "Test Rider",
                horse: "Test Horse",
                rank: 1,
                scoreTotal: 72,
              },
            ],
          },
          setup: {
            blockClasses: [{ code: "7777", name: "Locale" }],
          },
        },
      ],
    });

    expect(preview.classes[0]).toMatchObject({
      canInclude: true,
      championshipClassId: "custom:7777",
      championshipClassName: "Classe locale",
    });
    expect(getShowScoreChampionshipSelectionSummary(preview)).toMatchObject({
      selectedClassCount: 1,
      selectedRowCount: 1,
    });
    const importBatch = buildShowScoreChampionshipImportBatch({ preview });
    expect(importBatch.rows[0]).toMatchObject({
      ignoredForChampionship: false,
      championshipClassId: "custom:7777",
    });
    expect(buildChampionshipDatasetFromImports({ imports: [importBatch] }).classes[0])
      .toMatchObject({
        id: "custom:7777",
        name: "Classe locale",
      });
  });
});
