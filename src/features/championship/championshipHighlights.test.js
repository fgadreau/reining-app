import { describe, expect, it } from "vitest";
import { buildChampionshipTitles, buildChampionshipFunFacts, buildChampionshipDatasetFromCsv } from "./championshipStandings";
import { generateChampionshipPdf } from "../../utils/generateChampionshipPdf";

const standings = (points) => ({ id: "fiction", name: "Classe fictive", events: [], teams: points.map((totalPoints, index) => ({
  teamKey: `duo-${index}`, rider: `Cavalier ${index}`, horse: `Cheval ${index}`, totalPoints, rank: index + 1, details: [],
})) });
const titles = (points, status = "final") => [...buildChampionshipTitles(standings(points), status).values()];

describe("final championship titles", () => {
  it("uses distinct point totals rather than numeric ranks", () => {
    expect(titles([50, 48, 46])).toEqual(["champion", "reserveChampion"]);
    expect(titles([50, 50, 48, 48])).toEqual(["coChampion", "coChampion", "coReserveChampion", "coReserveChampion"]);
    expect(titles([50, 50, 48])).toEqual(["coChampion", "coChampion", "reserveChampion"]);
    expect(titles([50, 48, 48])).toEqual(["champion", "coReserveChampion", "coReserveChampion"]);
  });
  it("does not invent a second total", () => {
    expect(titles([50, 50])).toEqual(["coChampion", "coChampion"]);
    expect(titles([50])).toEqual(["champion"]);
    expect(titles([])).toEqual([]);
  });
  it.each(["published", "draft", undefined, "FINAL"])("has no titles for %s", (status) => {
    expect(buildChampionshipTitles(standings([50, 48]), status).size).toBe(0);
  });
  it("uses unrounded totals and existing tolerance", () => {
    expect(titles([50, 50 - 1e-10, 49.99999])).toEqual(["coChampion", "coChampion", "reserveChampion"]);
  });
  it("excludes inadmissible and DQ-only duos, retaining valid contributions", () => {
    const entry = standings([60, 55, 54, 50, 48, 0]);
    entry.teams[0].disqualified = true;
    entry.teams[1].eligible = false;
    entry.teams[2].details = [{ disqualified: true }];
    entry.teams[3].details = [{ disqualified: true }, { points: 50 }];
    expect([...buildChampionshipTitles(entry, "final")]).toEqual([["duo-3", "champion"], ["duo-4", "reserveChampion"]]);
  });
  it("prints translated titles only in final PDFs, keeping ranks", () => {
    for (const language of ["fr", "en"]) {
      for (const status of ["final", "published", "draft"]) {
        const doc = generateChampionshipPdf({ language, season: { status, classes: [standings([50, 50, 48, 48])] } });
        const content = doc.output();
        expect(content.includes("Co-champion")).toBe(status === "final");
        expect(content.includes(language === "fr" ? "Co-réserve Champion" : "Co-reserve Champion")).toBe(status === "final");
        expect(content).toContain("#3");
      }
    }
  });
});

const row = (rider, horse, points = 10, extra = {}) => ({ rider, horse, points, placeNum: 1, totalScore: 72, ...extra });
const dataset = (...events) => ({ classes: events.map((results, index) => ({ name: `Classe ${index}`, events: [{ eventKey: `event-${index}`, label: `Étape ${index}`, results }] })) });

describe("season highlights", () => {
  it("counts all included results across classes and stages, including zero points and DQ", () => {
    const facts = buildChampionshipFunFacts(dataset(
      [row("Alice", "Horse", 0, { memberNrha: "123", horseNrha: "456" }), row("Bob", "Other", 0, { disqualified: true })],
      [row("Alice", "Horse"), row("ALICE", "HORSE"), row("New name", "New horse name", 0, { memberNrha: "123", horseNrha: "456" })],
    ));
    expect(facts.counts).toEqual({ riders: 2, horses: 2, duos: 2 });
  });
  it("uses resolved persisted keys and does not merge ambiguous names", () => {
    const facts = buildChampionshipFunFacts(dataset([
      row("Same", "Horse", 0, { teamKey: "member:A|horse-id:X" }),
      row("Same", "Horse", 0, { teamKey: "member:B|horse-id:Y" }),
      row("Same", "Horse", 0),
    ]));
    expect(facts.counts).toEqual({ riders: 3, horses: 3, duos: 3 });
  });
  it("combines all tied point holders, preserving repeated occurrence contexts", () => {
    const facts = buildChampionshipFunFacts(dataset([row("A", "X"), row("B", "Y")], [row("A", "X"), row("B", "Y")]));
    expect(facts.combinedPointLeaders).toHaveLength(2);
    expect(facts.combinedPointLeaders[0]).toMatchObject({ totalPoints: 20, classCount: 2 });
    expect(facts.combinedPointLeaders[0].contributions.map((item) => item.showLabel)).toEqual(["Étape 0", "Étape 1"]);
    expect(facts.mostPodiums).toHaveLength(2);
    expect(facts.mostClasses).toHaveLength(2);
  });
  it("does not combine points earned with another partner", () => {
    const facts = buildChampionshipFunFacts(dataset([row("A", "X", 20), row("A", "Y", 5), row("B", "X", 5)]));
    expect(facts.combinedPointLeaders).toEqual([]);
    expect(facts.topRiderPoints[0].totalPoints).toBe(25);
    expect(facts.topHorsePoints[0].totalPoints).toBe(25);
    expect(facts.topTeamPoints[0].totalPoints).toBe(20);
  });
  it("does not hide an additional tied rider when other records share a duo", () => {
    const facts = buildChampionshipFunFacts(dataset([row("A", "X", 20), row("B", "Y", 10), row("B", "Z", 10)]));
    expect(facts.topRiderPoints).toHaveLength(2);
    expect(facts.combinedPointLeaders).toEqual([]);
  });
  it("excludes DQ from every performance record and hides incomparable raw scores", () => {
    const facts = buildChampionshipFunFacts(dataset([row("DQ", "DQ", 100, { disqualified: true, totalScore: 230 }), row("CSV DQ", "DQ", 200, { rawPlaceNum: "DQ" }), row("A", "X", 5)], [row("A", "X", 0, { totalScore: 220 })]));
    expect(facts.topRiderPoints.map((entry) => entry.rider)).toEqual(["A"]);
    expect(facts.topHorsePoints.map((entry) => entry.horse)).toEqual(["X"]);
    expect(facts.topTeamPoints[0].totalPoints).toBe(5);
    expect(facts.mostClasses[0].classCount).toBe(2);
    expect(facts.mostPodiums[0].podiumCount).toBe(2);
    for (const key of ["highestScore", "highestReiningScore", "highestRanchRidingScore", "bestProgression"]) expect(facts[key]).toEqual([]);
  });
  it("counts CSV non-point earners omitted from class standings", () => {
    const season = buildChampionshipDatasetFromCsv({ csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,EntryCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,PlaceNum,TotalScore,PatternNum,ShownCount,BackNum,MoneyWon",
      "S1,May,Open,1100,12,1,1,Horse A,H1,Alice,R1,1,72",
      "S1,May,Open,1100,12,1,1,Horse B,H2,Bob,R2,12,60",
      "S1,May,Intermediate Open,1110,12,1,1,Horse A,H1,Alice,R1,1,72",
    ].join("\n") });
    expect(season.classes.flatMap((entry) => entry.teams).every((team) => team.rider === "Alice")).toBe(true);
    expect(buildChampionshipFunFacts(season).counts).toEqual({ riders: 2, horses: 2, duos: 2 });
  });
});
