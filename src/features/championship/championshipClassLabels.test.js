import { describe, expect, test } from "vitest";
import {
  applyChampionshipClassLabels,
  normalizeChampionshipClassLabels,
} from "./championshipClassLabels";

describe("championship class display labels", () => {
  test("changes only class presentation data", () => {
    const source = {
      teamCount: 1,
      classes: [
        {
          id: "nrha-open",
          name: "Omnium NRHA (Open)",
          teams: [{ rank: 1, totalPoints: 10 }],
          events: [{ eventKey: "show|1100|go|1", totalPoints: 10 }],
        },
      ],
    };

    const result = applyChampionshipClassLabels(source, {
      "nrha-open": "Omnium — classement annuel",
    });

    expect(result.classes[0].name).toBe("Omnium — classement annuel");
    expect(result.classes[0].originalName).toBe("Omnium NRHA (Open)");
    expect(result.classes[0].teams).toEqual(source.classes[0].teams);
    expect(result.classes[0].events).toEqual(source.classes[0].events);
  });

  test("restores the original label when an override is removed", () => {
    const renamed = applyChampionshipClassLabels(
      { classes: [{ id: "custom:7777", name: "Classe locale" }] },
      { "custom:7777": "Classe locale affichée" }
    );

    expect(applyChampionshipClassLabels(renamed, {}).classes[0].name).toBe(
      "Classe locale"
    );
  });

  test("drops empty labels", () => {
    expect(
      normalizeChampionshipClassLabels({ one: "  Nouveau nom  ", two: " " })
    ).toEqual({ one: "Nouveau nom" });
  });
});
