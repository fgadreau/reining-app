import {
  isScoredRunComplete,
  recalculateRun,
  runHasVideoReview,
} from "./utils/scoring";
import {
  parseImportedDraw,
  parseImportedRuns,
} from "./features/classes/classSetupImport";
import { filterAssociationsBySearch } from "./features/associations/associationSearch";
import {
  getPublicationState,
  publishClass,
  PUBLICATION_STATUSES,
  unpublishClass,
} from "./features/publication/publicationRepository";
import {
  buildPublicClassView,
  buildPublicLiveClassView,
  sortPublicResults,
} from "./features/publication/publicViewRepository";
import { buildAnnouncerClassView } from "./features/live/liveViewRepository";
import {
  ASSOCIATION_ROLES,
  canAdminAssociation,
  canEditImportedDrawAssociation,
  canEditManualDrawAssociation,
  canManageAssociation,
  canScoreAssociation,
} from "./features/auth/accessRoles";
import {
  buildAssociationInvitationEmail,
  buildAssociationInvitationUrl,
} from "./features/auth/invitationLinks";
import {
  calculateClassTimingSummary,
  stampRunTiming,
} from "./features/classes/classTiming";
import {
  buildClassTimingRow,
  buildPatternTimingStats,
  calculateClassTimeSimulation,
} from "./features/classes/classTimeAnalytics";
import {
  isCustomPatternReady,
  normalizeCustomPattern,
  getPatternHeaders,
  getPatternManeuverDescription,
  TRAIL_CUSTOM_PATTERN_ID,
  WESTERN_HORSEMANSHIP_CUSTOM_PATTERN_ID,
  SHOWMANSHIP_CUSTOM_PATTERN_ID,
  OVERALL_FORM_EFFECTIVENESS_HEADER,
  patternHasRailAdjustment,
} from "./features/patterns/patternDefinitions";
import { getScoringOptionsForPattern } from "./features/scoring/scoringOptions";
import { buildProvisionalRanking } from "./features/scoring/provisionalRanking";

beforeEach(() => {
  localStorage.clear();
});

test("calculates a scored run total", () => {
  const run = recalculateRun({
    scores: ["+0.5", "0", "-0.5"],
    penalties: ["", "1", ""],
  });

  expect(run.penTotal).toBe("1.0");
  expect(run.scoreTotal).toBe("69.0");
});

test("treats special run statuses as complete scores", () => {
  expect(
    isScoredRunComplete(
      {
        backNumber: "411",
        scores: ["", "", ""],
        penalties: ["Scratch", "", ""],
      },
      3
    )
  ).toBe(true);

  expect(
    isScoredRunComplete(
      {
        backNumber: "4444",
        scores: ["", "", ""],
        penalties: ["Score 0", "", ""],
      },
      3
    )
  ).toBe(true);

  expect(
    isScoredRunComplete(
      {
        backNumber: "500",
        scores: ["", "", ""],
        penalties: ["No score", "", ""],
      },
      3
    )
  ).toBe(true);
});

test("blocks finalization while a run is under video review", () => {
  const run = recalculateRun({
    backNumber: "808",
    scores: ["+0.5", "0", "-0.5"],
    penalties: ["", "Révision vidéo", ""],
  });

  expect(run.scoreTotal).toBe("Review");
  expect(runHasVideoReview(run)).toBe(true);
  expect(isScoredRunComplete(run, 3)).toBe(false);
});

test("uses ranch riding patterns and penalties", () => {
  expect(getPatternHeaders("RR1").slice(-2)).toEqual(["STBK", "RHA"]);
  expect(getPatternHeaders("SFRR1").slice(-1)).toEqual(["RHA"]);
  expect(getPatternHeaders("1")).toEqual(getPatternHeaders("R1"));

  expect(getScoringOptionsForPattern("RR1")).toMatchObject({
    penaltyOptions: ["1", "3", "5"],
    statusPenaltyOptions: ["OP", "Score 0", "Révision vidéo"],
    penaltyDisabledHeaders: ["RHA"],
  });

  const offPatternRun = recalculateRun(
    {
      backNumber: "500",
      scores: ["0", "0", "0"],
      penalties: ["OP", "", "5"],
    },
    {
      penaltyDisabledIndexes: [2],
    }
  );

  expect(offPatternRun.penTotal).toBe("OP");
  expect(offPatternRun.scoreTotal).toBe("70.0 OP");
  expect(isScoredRunComplete(offPatternRun, 3)).toBe(true);
  expect(
    isScoredRunComplete(
      {
        backNumber: "500",
        scores: ["0", "", "0"],
        penalties: ["OP", "", ""],
      },
      3
    )
  ).toBe(false);
});

test("uses western riding patterns and disqualification scoring", () => {
  expect(getPatternHeaders("WR1")).toEqual([
    "WJOL",
    "LL/LE",
    "LC1",
    "LC2",
    "LC3",
    "LC4/LE",
    "CC1",
    "CC2",
    "LOL",
    "CC3",
    "CC4",
    "CTR/STBK",
  ]);
  expect(getPatternHeaders("Level 1 Western Riding #7")).toEqual([
    "WJOL",
    "RL",
    "CC1",
    "CC2",
    "CC3",
    "CIR/LC1",
    "LC2/CIR",
    "LOL",
    "STBK",
  ]);
  expect(getPatternManeuverDescription("LL/LE", "WR1")).toBe(
    "Lope left lead / Lope around end"
  );

  expect(getScoringOptionsForPattern("WR1")).toMatchObject({
    penaltyOptions: ["½", "1", "3", "5"],
    statusPenaltyOptions: ["Score 0", "Disqualification", "Révision vidéo"],
  });

  const disqualifiedRun = recalculateRun({
    backNumber: "600",
    scores: ["+0.5", "0"],
    penalties: ["1/2 Disqualification", ""],
  });

  expect(disqualifiedRun.penTotal).toBe("0.5 + Disqualification");
  expect(disqualifiedRun.scoreTotal).toBe("DQ");
  expect(isScoredRunComplete(disqualifiedRun, 2)).toBe(true);
});

test("uses trail custom patterns with six maneuver minimum", () => {
  const longDescription = "A".repeat(100);
  const customPattern = normalizeCustomPattern(
    {
      discipline: "trail",
      maneuvers: [
        { abbreviation: "GATE", description: "Gate" },
        { abbreviation: "BRDG", description: "Bridge with flowers" },
        { abbreviation: "BK", description: "Back through obstacle" },
        { abbreviation: "BOX", description: "Box turn" },
        { abbreviation: "LOG", description: "Lope over logs" },
        { abbreviation: "SIDE", description: longDescription },
      ],
    },
    TRAIL_CUSTOM_PATTERN_ID
  );

  expect(getPatternHeaders(TRAIL_CUSTOM_PATTERN_ID, customPattern)).toEqual([
    "GATE",
    "BRDG",
    "BK",
    "BOX",
    "LOG",
    "SIDE",
  ]);
  expect(
    getPatternManeuverDescription(
      "GATE",
      TRAIL_CUSTOM_PATTERN_ID,
      customPattern
    )
  ).toBe("Gate");
  expect(
    getPatternManeuverDescription(
      "BRDG",
      TRAIL_CUSTOM_PATTERN_ID,
      customPattern
    )
  ).toBe("Bridge with flowers");
  expect(customPattern.maneuvers[5].description).toHaveLength(80);
  expect(isCustomPatternReady(TRAIL_CUSTOM_PATTERN_ID, customPattern)).toBe(true);
  expect(getScoringOptionsForPattern(TRAIL_CUSTOM_PATTERN_ID, customPattern)).toMatchObject({
    penaltyOptions: ["½", "1", "3", "5"],
    statusPenaltyOptions: ["Score 0", "Disqualification", "Révision vidéo"],
  });
  expect(
    getPatternHeaders(
      TRAIL_CUSTOM_PATTERN_ID,
      normalizeCustomPattern({ discipline: "trail", maneuvers: [] }, TRAIL_CUSTOM_PATTERN_ID)
    )
  ).toHaveLength(6);
});

test("uses AQHA performance custom patterns with F&E scoring", () => {
  const customPattern = normalizeCustomPattern(
    {
      discipline: "western_horsemanship",
      name: "Pattern with rail",
      maneuvers: [
        { abbreviation: "WJ", description: "Walk jog transition" },
        { abbreviation: "LL", description: "Left lead lope" },
      ],
    },
    WESTERN_HORSEMANSHIP_CUSTOM_PATTERN_ID
  );

  expect(
    getPatternHeaders(WESTERN_HORSEMANSHIP_CUSTOM_PATTERN_ID, customPattern)
  ).toEqual(["WJ", "LL", OVERALL_FORM_EFFECTIVENESS_HEADER]);
  expect(
    getPatternManeuverDescription(
      OVERALL_FORM_EFFECTIVENESS_HEADER,
      WESTERN_HORSEMANSHIP_CUSTOM_PATTERN_ID,
      customPattern
    )
  ).toBe("Overall form and effectiveness");
  expect(
    patternHasRailAdjustment(
      WESTERN_HORSEMANSHIP_CUSTOM_PATTERN_ID,
      customPattern
    )
  ).toBe(true);
  expect(patternHasRailAdjustment(SHOWMANSHIP_CUSTOM_PATTERN_ID)).toBe(false);

  const scoringOptions = getScoringOptionsForPattern(
    WESTERN_HORSEMANSHIP_CUSTOM_PATTERN_ID,
    customPattern
  );

  expect(scoringOptions.scoreOptions).toEqual(
    expect.arrayContaining(["-3", "-2.5", "0", "+2.5", "+3"])
  );
  expect(scoringOptions.scoreOptionsByHeader[OVERALL_FORM_EFFECTIVENESS_HEADER]).toEqual(
    expect.arrayContaining(["0", "2.5", "5"])
  );
  expect(scoringOptions).toMatchObject({
    penaltyOptions: ["3", "5", "10"],
    statusPenaltyOptions: ["Disqualification", "Révision vidéo"],
    penaltyDisabledHeaders: [OVERALL_FORM_EFFECTIVENESS_HEADER],
  });

  const scoredRun = recalculateRun(
    {
      backNumber: "100",
      scores: ["+1", "4.5"],
      penalties: ["3", "10"],
    },
    {
      penaltyDisabledIndexes: [1],
    }
  );

  expect(scoredRun.penTotal).toBe("3.0");
  expect(scoredRun.scoreTotal).toBe("72.5");

  const tenPenaltyRun = recalculateRun({
    scores: ["0"],
    penalties: ["10"],
  });

  expect(tenPenaltyRun.penTotal).toBe("10.0");
  expect(tenPenaltyRun.scoreTotal).toBe("60.0");

  const disqualifiedRun = recalculateRun(
    {
      backNumber: "101",
      scores: ["0", "5"],
      penalties: ["Disqualification", ""],
    },
    {
      penaltyDisabledIndexes: [1],
    }
  );

  expect(disqualifiedRun.scoreTotal).toBe("DQ");
});

test("builds provisional rankings for rail adjustment classes", () => {
  const ranking = buildProvisionalRanking([
    { id: "run-1", draw: 1, backNumber: "101", rider: "A", scoreTotal: "71.0" },
    { id: "run-2", draw: 2, backNumber: "102", rider: "B", scoreTotal: "72.5" },
    { id: "run-3", draw: 3, backNumber: "103", rider: "C", scoreTotal: "DQ" },
  ]);

  expect(ranking.map((run) => run.id)).toEqual(["run-2", "run-1", "run-3"]);
  expect(ranking.map((run) => run.rank)).toEqual([1, 2, 3]);
});

test("filters associations by short name or full name", () => {
  const associations = [
    { id: "aqr", name: "Association Québécoise de Reining", shortName: "AQR" },
    { id: "nrc", name: "National Reining Classic", shortName: "NRC" },
  ];

  expect(
    filterAssociationsBySearch(associations, "aqr").map((item) => item.id)
  ).toEqual(["aqr"]);
  expect(
    filterAssociationsBySearch(associations, "quebecoise").map((item) => item.id)
  ).toEqual(["aqr"]);
  expect(
    filterAssociationsBySearch(associations, "classic").map((item) => item.id)
  ).toEqual(["nrc"]);
});

test("parses imported draw rows in draw order", () => {
  const runs = parseImportedRuns(`
    2, 202, Marie Roy, Custom Whiz, Luc Roy
    1, 101, Felix Gadreau, Smart Spook, Jean Tremblay
  `);

  expect(runs).toMatchObject([
    {
      order: 1,
      backNumber: "101",
      rider: "Felix Gadreau",
      horse: "Smart Spook",
      owner: "Jean Tremblay",
    },
    {
      order: 2,
      backNumber: "202",
      rider: "Marie Roy",
      horse: "Custom Whiz",
      owner: "Luc Roy",
    },
  ]);
});

test("parses show-management CSV draws and detects tractor drags", () => {
  const importedDraw = parseImportedDraw(`Position,#Dossard Équipe,#Dossard Rider1,#Dossard Rider2,#Dossard Horse1,#Dossard Horse2,Rider1,Cheval1,Rider2,Cheval2,Mère Cheval1,Père Cheval1,Origine Cheval1,Résultats
1,8841,,,8805,,Michel Sandijck,HR Gunna Trash Ya,,,,,,,
2,8183,,,2595,,Marie-Laurence Perreault,Sweet August Gun,,,,,,,
Tractor,,,,,,,,,,,,,
3,8088,,,2648,,Alice Fauret-Blanquart,AKD SmartLittleAngel,,,,,,Scratched
4,3619,,,2597,,Matthew Hudson,HR Turn Up the Heat,,,,,,,`);

  expect(importedDraw.dragInterval).toBe(2);
  expect(importedDraw.dragBreaks).toBe(1);
  expect(importedDraw.runs).toHaveLength(4);
  expect(importedDraw.runs[0]).toMatchObject(
    {
      order: 1,
      backNumber: "8805",
      rider: "Michel Sandijck",
      horse: "HR Gunna Trash Ya",
    }
  );
  expect(
    importedDraw.runs.find((run) => run.rider === "Alice Fauret-Blanquart")
  ).toMatchObject(
    {
      order: 3,
      backNumber: "2648",
      owner: "Scratched",
    }
  );
});

test("publishes and unpublishes a class publication state", () => {
  expect(getPublicationState("class-1").status).toBe("hidden");

  publishClass("class-1", "secretary-1");

  const published = getPublicationState("class-1");
  expect(published.status).toBe("published");
  expect(published.publishedBy).toBe("secretary-1");
  expect(published.publishedAt).toEqual(expect.any(String));

  unpublishClass("class-1");

  const hidden = getPublicationState("class-1");
  expect(hidden.status).toBe("hidden");
  expect(hidden.publishedAt).toBeNull();
});

test("sorts public results by numeric score before special results", () => {
  const runs = sortPublicResults([
    { id: "run-1", draw: 1, scoreTotal: "68.5" },
    { id: "run-2", draw: 2, scoreTotal: "SCR" },
    { id: "run-3", draw: 3, scoreTotal: "71.0" },
  ]);

  expect(runs.map((run) => run.id)).toEqual(["run-3", "run-1", "run-2"]);
  expect(runs.map((run) => run.rank)).toEqual([1, 2, 3]);
});

test("publishes scoresheets in draw order with manoeuvre details", () => {
  const classView = buildPublicClassView({
    classItem: {
      id: "class-1",
      name: "Novice Horse",
      pattern: "RR1",
    },
    setup: {
      pattern: "RR1",
    },
    publication: {
      status: PUBLICATION_STATUSES.PUBLISHED,
      publishedAt: "2026-05-24T14:00:00.000Z",
    },
    official: {
      isSecretariatValidated: true,
      officialRuns: [
        {
          id: "run-2",
          draw: 2,
          backNumber: "202",
          rider: "Marie Roy",
          horse: "Custom Whiz",
          scores: ["0"],
          penalties: ["1"],
          scoreTotal: "69.0",
          penTotal: "1.0",
        },
        {
          id: "run-1",
          draw: 1,
          backNumber: "101",
          rider: "Felix Gadreau",
          horse: "Smart Spook",
          scores: ["+0.5"],
          penalties: [""],
          scoreTotal: "70.5",
          penTotal: "0.0",
        },
      ],
    },
    scoringRuns: [],
  });

  expect(classView.runs.map((run) => run.draw)).toEqual([1, 2]);
  expect(classView.runs[0].rank).toBeUndefined();
  expect(classView.runs[0].manoeuvres[0]).toMatchObject({
    name: "W",
    description: "Walk",
    score: "+0.5",
    penalty: "",
  });
});

test("publishes custom trail scoresheets with obstacle descriptions", () => {
  const customPattern = normalizeCustomPattern(
    {
      discipline: "trail",
      maneuvers: [
        { abbreviation: "GATE", description: "Gate" },
        { abbreviation: "BRDG", description: "Bridge" },
        { abbreviation: "BK", description: "Back through obstacle" },
        { abbreviation: "BOX", description: "Box turn" },
        { abbreviation: "LOG", description: "Lope over logs" },
        { abbreviation: "SIDE", description: "Side pass" },
      ],
    },
    TRAIL_CUSTOM_PATTERN_ID
  );
  const classView = buildPublicClassView({
    classItem: {
      id: "class-trail",
      name: "Trail Amateur",
      pattern: TRAIL_CUSTOM_PATTERN_ID,
      customPattern,
    },
    setup: {
      pattern: TRAIL_CUSTOM_PATTERN_ID,
      customPattern,
    },
    publication: {
      status: PUBLICATION_STATUSES.PUBLISHED,
      publishedAt: "2026-05-24T14:00:00.000Z",
    },
    official: {
      isSecretariatValidated: true,
      customPattern,
      officialRuns: [
        {
          id: "run-1",
          draw: 1,
          backNumber: "101",
          rider: "Felix Gadreau",
          horse: "Trail Horse",
          scores: ["+1"],
          penalties: ["½"],
          scoreTotal: "70.5",
          penTotal: "0.5",
        },
      ],
    },
    scoringRuns: [],
  });

  expect(classView.pattern).toBe("Trail / Obstacle Western");
  expect(classView.runs[0].manoeuvres[0]).toMatchObject({
    name: "GATE",
    description: "Gate",
    score: "+1",
    penalty: "½",
  });
});

test("keeps public results hidden until secretariat validation", () => {
  const classData = {
    classItem: {
      id: "class-1",
      name: "Open",
    },
    setup: {},
    publication: {
      status: PUBLICATION_STATUSES.PUBLISHED,
    },
    official: {
      isFinalized: true,
      isSecretariatValidated: false,
    },
    scoringRuns: [
      {
        id: "run-1",
        draw: 1,
        scoreTotal: "72.0",
        note: "Penalty explained to participant.",
      },
    ],
  };

  expect(buildPublicClassView(classData)).toBeNull();

  expect(
    buildPublicClassView({
      ...classData,
      official: {
        ...classData.official,
        isSecretariatValidated: true,
      },
    })?.runs
  ).toMatchObject([
    {
      note: "Penalty explained to participant.",
    },
  ]);
});

test("public live view exposes active, next, and last passed runs", () => {
  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-live",
      name: "Novice Horse",
      pattern: "2",
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE,
    },
    scoringSession: {
      activeManoeuvre: {
        draw: 4,
      },
      runs: [
        {
          id: "run-1",
          draw: 1,
          backNumber: "101",
          rider: "Rider 1",
          scoreTotal: "71.0",
          scores: ["0", "+0.5"],
          penalties: ["", ""],
        },
        {
          id: "run-2",
          draw: 2,
          backNumber: "202",
          rider: "Rider 2",
          scoreTotal: "72.0",
          scores: ["+0.5", "0"],
          penalties: ["1", ""],
        },
        {
          id: "run-3",
          draw: 3,
          backNumber: "303",
          rider: "Rider 3",
          scoreTotal: "70.5",
          note: "Penalty note.",
          scores: ["0", "+0.5"],
          penalties: ["", "2"],
        },
        {
          id: "run-4",
          draw: 4,
          backNumber: "404",
          rider: "Rider 4",
          scoreTotal: "",
        },
        {
          id: "run-5",
          draw: 5,
          backNumber: "505",
          rider: "Rider 5",
          scoreTotal: "",
        },
      ],
    },
  });

  expect(classView.activeRun.draw).toBe(4);
  expect(classView.nextRun.draw).toBe(5);
  expect(classView.lastPassedRuns.map((run) => run.draw)).toEqual([3, 2]);
  expect(classView.lastPassedRuns[0].manoeuvres[1]).toMatchObject({
    score: "+0.5",
    penalty: "2",
  });
  expect(classView.lastPassedRuns[0].note).toBe("Penalty note.");
});

test("public live without scores keeps runs visible and hides scoring details", () => {
  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-live-no-score",
      name: "Open Trail",
      arena: "Manège 2",
      pattern: "2",
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
    },
    scoringSession: {
      activeManoeuvre: {
        draw: 2,
      },
      runs: [
        {
          id: "run-1",
          draw: 1,
          rider: "Rider 1",
          horse: "Horse 1",
          scoreTotal: "72.0",
          note: "Score note",
          scores: ["+0.5"],
          penalties: ["1"],
        },
        {
          id: "run-2",
          draw: 2,
          rider: "Rider 2",
          horse: "Horse 2",
          scoreTotal: "",
        },
        {
          id: "run-3",
          draw: 3,
          rider: "Rider 3",
          horse: "Horse 3",
          scoreTotal: "",
        },
      ],
    },
  });

  expect(classView.arena).toBe("Manège 2");
  expect(classView.showScores).toBe(false);
  expect(classView.activeRun.draw).toBe(2);
  expect(classView.nextRun.draw).toBe(3);
  expect(classView.latestScore).toBeNull();
  expect(classView.lastPassedRuns[0]).toMatchObject({
    draw: 1,
    rider: "Rider 1",
    scoreTotal: "",
    note: "",
  });
  expect(classView.lastPassedRuns[0].manoeuvres[0]).toMatchObject({
    score: "",
    penalty: "",
  });
});

test("public live class remains visible without scoring session runs", () => {
  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-live-empty",
      name: "Open Ranch",
      arena: "Outdoor",
      pattern: "2",
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_SCORING,
    },
    scoringSession: null,
  });

  expect(classView).toMatchObject({
    classId: "class-live-empty",
    className: "Open Ranch",
    arena: "Outdoor",
    showScores: true,
    activeRun: null,
    nextRun: null,
    latestScore: null,
  });
});

test("public live view exposes a drag break before the next run", () => {
  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-live",
      name: "Novice Horse",
      pattern: "2",
    },
    setup: {
      dragInterval: 2,
      dragDurationMinutes: 8,
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE,
    },
    scoringSession: {
      activeManoeuvre: null,
      runs: [
        {
          id: "run-1",
          draw: 1,
          scoreTotal: "71.0",
          completedAt: "2026-05-25T14:00:00.000Z",
        },
        {
          id: "run-2",
          draw: 2,
          scoreTotal: "72.0",
          completedAt: "2026-05-25T14:03:00.000Z",
        },
        {
          id: "run-3",
          draw: 3,
          scoreTotal: "",
        },
      ],
    },
  });

  expect(classView.activeRun).toBeNull();
  expect(classView.nextRun.draw).toBe(3);
  expect(classView.dragBreak).toMatchObject({
    isActive: true,
    startedAt: "2026-05-25T14:03:00.000Z",
    durationMinutes: 8,
    durationSeconds: 480,
  });
  expect(classView.dragBreak.nextRun.draw).toBe(3);
});

test("scopes secretary access to attached associations", () => {
  const memberships = [
    {
      userId: "user-1",
      associationId: "association-1",
      role: ASSOCIATION_ROLES.SECRETARY,
    },
    {
      userId: "user-1",
      associationId: "association-2",
      role: ASSOCIATION_ROLES.SCRIBE,
    },
  ];

  expect(canManageAssociation(memberships, "association-1")).toBe(true);
  expect(canAdminAssociation(memberships, "association-1")).toBe(false);
  expect(canScoreAssociation(memberships, "association-1")).toBe(true);
  expect(canManageAssociation(memberships, "association-2")).toBe(false);
  expect(canScoreAssociation(memberships, "association-2")).toBe(true);
  expect(canEditManualDrawAssociation(memberships, "association-2")).toBe(true);
  expect(canEditImportedDrawAssociation(memberships, "association-2")).toBe(false);
});

test("announcer latest score follows publication state", () => {
  const classData = {
    classItem: {
      id: "class-1",
      name: "Open",
    },
    setup: {},
    publication: {
      status: PUBLICATION_STATUSES.HIDDEN,
    },
    scoringRuns: [
      {
        id: "run-1",
        draw: 1,
        scoreTotal: "72.0",
      },
    ],
  };

  expect(buildAnnouncerClassView(classData).latestScore).toBeNull();

  expect(
    buildAnnouncerClassView({
      ...classData,
      publication: {
        status: PUBLICATION_STATUSES.LIVE_SCORING,
      },
    }).latestScore.scoreTotal
  ).toBe("72.0");

  expect(
    buildAnnouncerClassView({
      ...classData,
      publication: {
        status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
      },
    }).latestScore
  ).toBeNull();
});

test("announcer live view exposes active, next, and recent completed runs", () => {
  const classData = {
    classItem: {
      id: "class-1",
      name: "Open",
      pattern: "2",
    },
    setup: {},
    publication: {
      status: PUBLICATION_STATUSES.LIVE,
    },
    scoringRuns: [
      {
        id: "run-1",
        draw: 1,
        backNumber: "101",
        rider: "Rider 1",
        scoreTotal: "71.0",
        scores: ["0", "+0.5"],
        penalties: ["", ""],
      },
      {
        id: "run-2",
        draw: 2,
        backNumber: "202",
        rider: "Rider 2",
        isActive: true,
        scoreTotal: "Review",
        scores: ["+1", ""],
        penalties: ["Révision vidéo", ""],
      },
      {
        id: "run-3",
        draw: 3,
        backNumber: "303",
        rider: "Rider 3",
        scoreTotal: "",
        scores: [],
        penalties: [],
      },
    ],
  };

  const classView = buildAnnouncerClassView(classData);

  expect(classView.activeRun.draw).toBe(2);
  expect(classView.nextRun.draw).toBe(3);
  expect(classView.latestScore.draw).toBe(1);
  expect(classView.lastPassedRuns.map((run) => run.draw)).toEqual([1]);
  expect(classView.lastPassedRuns[0].manoeuvres[0]).toMatchObject({
    name: "RSLL",
    score: "0",
  });

  const fourthRunActiveView = buildAnnouncerClassView({
    ...classData,
    publication: {
      status: PUBLICATION_STATUSES.HIDDEN,
    },
    scoringRuns: [
      {
        id: "run-1",
        draw: 1,
        backNumber: "101",
        rider: "Rider 1",
        scoreTotal: "71.0",
      },
      {
        id: "run-2",
        draw: 2,
        backNumber: "202",
        rider: "Rider 2",
        scoreTotal: "72.0",
        scores: ["+0.5", "0"],
        penalties: ["1", ""],
      },
      {
        id: "run-3",
        draw: 3,
        backNumber: "303",
        rider: "Rider 3",
        scoreTotal: "70.5",
        scores: ["0", "+0.5"],
        penalties: ["", "2"],
      },
      {
        id: "run-4",
        draw: 4,
        backNumber: "404",
        rider: "Rider 4",
        isActive: true,
        scoreTotal: "",
      },
    ],
  });

  expect(fourthRunActiveView.lastPassedRuns.map((run) => run.draw)).toEqual([
    3,
    2,
  ]);
  expect(fourthRunActiveView.latestScore).toBeNull();
  expect(fourthRunActiveView.lastPassedRuns[0].scoreTotal).toBe("70.5");
  expect(fourthRunActiveView.lastPassedRuns[0].manoeuvres[1]).toMatchObject({
    score: "+0.5",
    penalty: "2",
  });
});

test("builds invitation links for invited users", () => {
  const url = buildAssociationInvitationUrl("http://localhost:3001/", {
    token: "invite-token",
    email: "scribe@example.com",
  });

  expect(url).toBe(
    "http://localhost:3001/login?invite=invite-token&email=scribe%40example.com"
  );
});

test("builds invitation email content without leaving the app", () => {
  const email = buildAssociationInvitationEmail({
    origin: "https://showscore.app",
    associationName: "AQR",
    invitation: {
      token: "invite-token",
      email: "scribe@example.com",
    },
  });

  expect(email).toMatchObject({
    to: "scribe@example.com",
    subject: "Invitation ShowScore",
    invitationUrl:
      "https://showscore.app/login?invite=invite-token&email=scribe%40example.com",
  });
  expect(email.body).toContain("AQR");
  expect(email.body).toContain(email.invitationUrl);
});

test("tracks run timing and estimates remaining class time with drags", () => {
  const started = stampRunTiming(
    recalculateRun({
      backNumber: "101",
      scores: ["0", ""],
      penalties: ["", ""],
    }),
    2,
    "2026-05-22T14:00:00.000Z"
  );
  const completed = stampRunTiming(
    recalculateRun({
      ...started,
      scores: ["0", "+0.5"],
    }),
    2,
    "2026-05-22T14:03:00.000Z"
  );

  const summary = calculateClassTimingSummary({
    runs: [
      completed,
      { backNumber: "102", scores: ["", ""], penalties: ["", ""] },
      { backNumber: "103", scores: ["", ""], penalties: ["", ""] },
    ],
    maneuverCount: 2,
    dragInterval: 2,
    dragDurationMinutes: 8,
    now: new Date("2026-05-22T14:03:00.000Z"),
  });

  expect(completed.durationSeconds).toBe(180);
  expect(summary.averageRunSeconds).toBe(180);
  expect(summary.remainingRuns).toBe(2);
  expect(summary.remainingDragBreaks).toBe(1);
  expect(summary.remainingSeconds).toBe(840);
});

test("summarizes class timing by pattern", () => {
  const classRows = [
    {
      classItem: {
        id: "class-a",
        name: "Open A",
        pattern: "5",
      },
      setup: {
        pattern: "5",
        runs: [{ id: "a-1" }, { id: "a-2" }, { id: "a-3" }],
        dragInterval: 2,
        dragDurationMinutes: 8,
      },
      scoringRuns: [
        {
          id: "a-1",
          backNumber: "101",
          scores: Array(8).fill("0"),
          penalties: Array(8).fill(""),
          durationSeconds: 120,
        },
      ],
    },
    {
      classItem: {
        id: "class-b",
        name: "Open B",
        pattern: "5",
      },
      setup: {
        pattern: "5",
        runs: [{ id: "b-1" }],
      },
      scoringRuns: [
        {
          id: "b-1",
          backNumber: "102",
          scores: Array(8).fill("0"),
          penalties: Array(8).fill(""),
          durationSeconds: 180,
        },
      ],
    },
  ];

  const stats = buildPatternTimingStats(classRows);
  const timingRow = buildClassTimingRow({
    classData: classRows[0],
    now: new Date("2026-05-22T14:05:00.000Z"),
    patternAverageRunSeconds: stats[0].averageRunSeconds,
  });

  expect(stats[0]).toMatchObject({
    pattern: "Reining #5",
    classCount: 2,
    timedRunCount: 1,
    averageRunSeconds: 180,
    medianRunSeconds: 180,
  });
  expect(timingRow.remainingRuns).toBe(2);
  expect(timingRow.remainingDragBreaks).toBe(1);
  expect(timingRow.remainingSeconds).toBe(840);

  expect(
    calculateClassTimeSimulation({
      participantCount: 10,
      averageRunSeconds: stats[0].averageRunSeconds,
      dragInterval: 4,
      dragDurationMinutes: 8,
    })
  ).toMatchObject({
    dragBreaks: 2,
    totalSeconds: 2760,
  });
});
