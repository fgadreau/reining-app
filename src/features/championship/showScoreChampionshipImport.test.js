import { describe, expect, test } from "vitest";
import { buildClassResultGroups } from "../results/classResults";
import { resolveAssociationChampionshipClass } from "./associationClassDictionary";
import { buildChampionshipDatasetFromImports } from "./championshipStandings";
import {
  buildShowScoreChampionshipImportBatch,
  buildShowScoreChampionshipImportPreview,
  getShowScoreChampionshipSelectionSummary,
} from "./showScoreChampionshipImport";

const association = { shortName: "AQR" };

test.each([
  { status: "no_score", scoreTotal: "" },
  { status: "no_score", scoreTotal: "NS" },
  { status: "", scoreTotal: "NS" },
])("counts an unranked participant in championship points: %j", (noScore) => {
  const runs = [
    { id: "first", rider: "Alice", horse: "Horse A", status: "scored", scoreTotal: "72" },
    { id: "second", rider: "Bob", horse: "Horse B", status: "scored", scoreTotal: "71" },
    { id: "ns", rider: "Carol", horse: "Horse C", ...noScore },
  ].map((run, index) => ({
    ...run,
    draw: index + 1,
    // Repeated class codes and matching setup runs must not inflate the count.
    classCodes: ["105", "105"],
  }));
  const classData = {
    classItem: { id: "class-1", showId: "show-1", name: "Rookie" },
    day: { date: "2026-09-05" },
    setup: { runs, blockClasses: [{ code: "105", name: "Rookie" }] },
    official: {
      isSecretariatValidated: true,
      isFinalized: true,
      officialRuns: runs,
    },
  };
  const groups = buildClassResultGroups(classData);
  expect(groups).toHaveLength(1);
  expect(groups[0].entryCount).toBe(3);
  expect(groups[0].entries.map((entry) => entry.id)).toEqual(["first", "second"]);

  const preview = buildShowScoreChampionshipImportPreview({
    association,
    classDataItems: [classData],
    generatedAt: "2026-09-05T12:00:00.000Z",
  });
  expect(preview.classes[0]).toMatchObject({
    entryCount: 3, scoredCount: 2, rowCount: 2, canInclude: true,
  });
  expect(preview.rows).toHaveLength(2);
  expect(preview.includedRowCount).toBe(2);
  for (const row of preview.rows) {
    expect(row).toMatchObject({ entryCount: 3, rawEntryCount: "3", shownCount: 2 });
  }

  const batch = buildShowScoreChampionshipImportBatch({
    preview, id: "import-1", importedAt: "2026-09-05T12:00:00.000Z",
  });
  const dataset = buildChampionshipDatasetFromImports({ imports: [batch] });
  expect(dataset.classes).toHaveLength(1);
  expect(dataset.classes[0].teams.map((team) => team.totalPoints)).toEqual([3, 2]);
});

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
