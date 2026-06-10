import {
  formatScoreValue,
  isScoredRunComplete,
  parseScoreValue,
  recalculateRun,
  runHasVideoReview,
} from "./utils/scoring";
import {
  parseImportedDraw,
  parseImportedRuns,
  parsePositionedPdfPages,
} from "./features/classes/classSetupImport";
import { filterAssociationsBySearch } from "./features/associations/associationSearch";
import { normalizeAssociationWebsiteUrl } from "./features/associations/associationProfile";
import {
  detectBrowserLanguage,
  getInitialLanguage,
  normalizeLanguage,
  translate,
} from "./features/i18n/i18n";
import {
  buildAssociationPublicSeo,
  buildShowPublicSeo,
} from "./features/seo/publicSeo";
import {
  buildLivestreamEmbed,
  hasPublicLivestream,
} from "./features/livestream/livestreamEmbed";
import {
  getPublicationState,
  publishClass,
  PUBLICATION_STATUSES,
  unpublishClass,
} from "./features/publication/publicationRepository";
import {
  buildPublicClassView,
  buildPublicLiveClassView,
  getPublicShowView,
  sortPublicResults,
} from "./features/publication/publicViewRepository";
import {
  buildClassResultGroups,
  normalizeResultGroups,
} from "./features/results/classResults";
import {
  getClassResultPublication,
  RESULT_PUBLICATION_STATUSES,
} from "./features/results/resultPublicationRepository";
import { validateOfficialResultRepository } from "./features/classes/officialResultRepository";
import { buildAnnouncerClassView } from "./features/live/liveViewRepository";
import {
  PAID_WARMUP_TIMER_CUES,
  buildPaidWarmupLiveView,
  getPaidWarmupTimerCueType,
} from "./features/paidWarmups/paidWarmupLive";
import {
  calculatePaidWarmupScheduleSummary,
  insertPaidWarmupEntryAfter,
  movePaidWarmupEntry,
  savePaidWarmup,
} from "./features/paidWarmups/paidWarmupStorage";
import {
  SHOW_SCHEDULE_ITEM_TYPES,
  buildShowScheduleSections,
} from "./features/schedule/showSchedule";
import { saveDays } from "./features/days/dayStorage";
import { saveClasses } from "./features/classes/classStorage";
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
import { getDefaultShowRouteForRoles } from "./features/auth/showRoleRouting";
import { buildAnalyticsSummary } from "./features/analytics/analyticsRepository";
import { getPageEventContext } from "./features/analytics/analyticsRouteContext";
import {
  calculateClassTimingSummary,
  stampRunTiming,
} from "./features/classes/classTiming";
import { getScoreRuleLines } from "./features/scoring/scoringRuleText";
import {
  buildClassTimingRow,
  buildDayScheduleRows,
  buildDayScheduleSummary,
  buildPatternTimingStats,
  calculateClassTimeSimulation,
} from "./features/classes/classTimeAnalytics";
import {
  CLASS_START_MODE_AFTER_PREVIOUS,
  CLASS_START_MODE_FIXED,
  normalizeClassScheduleDetails,
} from "./features/classes/classSchedule";
import {
  isCustomPatternReady,
  normalizeCustomPattern,
  getPatternDisplayName,
  getPatternHeaders,
  getPatternManeuverDescription,
  NO_PATTERN_ID,
  TRAIL_CUSTOM_PATTERN_ID,
  WESTERN_HORSEMANSHIP_CUSTOM_PATTERN_ID,
  SHOWMANSHIP_CUSTOM_PATTERN_ID,
  OVERALL_FORM_EFFECTIVENESS_HEADER,
  patternHasRailAdjustment,
} from "./features/patterns/patternDefinitions";
import { getScoringOptionsForPattern } from "./features/scoring/scoringOptions";
import { buildProvisionalRanking } from "./features/scoring/provisionalRanking";
import {
  buildCombinedJudgeScore,
  classUsesCombinedJudgeScore,
} from "./features/scoring/multiJudgeScoring";
import { normalizeClassJudges } from "./features/classes/classJudges";
import {
  buildMultiJudgeOfficialRuns,
  getJudgeSignatureEntries,
} from "./features/scoring/multiJudgeOfficialData";
import { saveActiveManoeuvre } from "./features/scoring/scoringRepository";
import {
  canReloadForAppUpdate,
  isScribeScoringPath,
} from "./features/pwa/appUpdateSafety";

beforeEach(() => {
  localStorage.clear();
});

test("calculates a scored run total", () => {
  const run = recalculateRun({
    scores: ["+0.5", "0", "-0.5"],
    penalties: ["", "1", ""],
  });

  expect(run.penTotal).toBe("1");
  expect(run.scoreTotal).toBe("69");
});

test("calculates and formats fractional maneuver scores", () => {
  const run = recalculateRun({
    scores: ["+1½", "0", "-½"],
    penalties: ["", "", ""],
  });

  expect(parseScoreValue("+½")).toBe(0.5);
  expect(parseScoreValue("-1½")).toBe(-1.5);
  expect(formatScoreValue("+0.5")).toBe("+½");
  expect(formatScoreValue("-1.5")).toBe("-1½");
  expect(run.scoreTotal).toBe("71");
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
  expect(offPatternRun.scoreTotal).toBe("70 OP");
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

  expect(disqualifiedRun.penTotal).toBe("½ + Disqualification");
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
    expect.arrayContaining(["-3", "-2½", "0", "+2½", "+3"])
  );
  expect(scoringOptions.scoreOptionsByHeader[OVERALL_FORM_EFFECTIVENESS_HEADER]).toEqual(
    expect.arrayContaining(["0", "2½", "5"])
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

  expect(scoredRun.penTotal).toBe("3");
  expect(scoredRun.scoreTotal).toBe("72½");

  const tenPenaltyRun = recalculateRun({
    scores: ["0"],
    penalties: ["10"],
  });

  expect(tenPenaltyRun.penTotal).toBe("10");
  expect(tenPenaltyRun.scoreTotal).toBe("60");

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

test("PDF score rules follow the class scoring scale", () => {
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

  expect(getScoreRuleLines("2")).toEqual(
    expect.arrayContaining([
      expect.stringContaining("-1½ Extremely Poor"),
    ])
  );
  expect(
    getScoreRuleLines(WESTERN_HORSEMANSHIP_CUSTOM_PATTERN_ID, customPattern)
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining("-3 Extremely Poor"),
      expect.stringContaining("F&E / Overall form and effectiveness"),
    ])
  );
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

test("normalizes association website urls for public links", () => {
  expect(normalizeAssociationWebsiteUrl("showscore.app")).toBe(
    "https://showscore.app"
  );
  expect(normalizeAssociationWebsiteUrl("https://showscore.app")).toBe(
    "https://showscore.app"
  );
  expect(normalizeAssociationWebsiteUrl("")).toBe("");
});

test("builds livestream embeds from public video links", () => {
  expect(buildLivestreamEmbed("https://youtu.be/abc123").embedUrl).toContain(
    "youtube-nocookie.com/embed/abc123"
  );
  expect(
    buildLivestreamEmbed("https://www.youtube.com/watch?v=abc123").embedUrl
  ).toContain("youtube-nocookie.com/embed/abc123");
  expect(buildLivestreamEmbed("https://vimeo.com/123456").embedUrl).toBe(
    "https://player.vimeo.com/video/123456"
  );
  expect(
    buildLivestreamEmbed('<iframe src="https://example.com/player"></iframe>')
  ).toMatchObject({
    canEmbed: true,
    embedUrl: "https://example.com/player",
  });
  expect(buildLivestreamEmbed("https://example.com/live")).toMatchObject({
    canEmbed: false,
    externalUrl: "https://example.com/live",
  });
  expect(
    hasPublicLivestream({
      isLivestreamPublic: true,
      livestreamUrl: "https://youtu.be/abc123",
    })
  ).toBe(true);
  expect(
    hasPublicLivestream({
      isLivestreamPublic: false,
      livestreamUrl: "https://youtu.be/abc123",
    })
  ).toBe(false);
});

test("detects and translates the interface language", () => {
  const storage = {
    getItem: () => "en-CA",
    setItem: () => {},
  };

  expect(normalizeLanguage("fr-CA")).toBe("fr");
  expect(normalizeLanguage("es")).toBe("");
  expect(
    detectBrowserLanguage({
      languages: ["es-MX", "en-US"],
      language: "fr-CA",
    })
  ).toBe("en");
  expect(getInitialLanguage({ storage, navigatorLike: { language: "fr-CA" } })).toBe(
    "en"
  );
  expect(translate("en", "nav.publicShowcase")).toBe("Public showcase");
  expect(translate("en", "public.results.liveActive", { count: 2 })).toBe(
    "Active live feeds in the showcase: 2"
  );
  expect(translate("en", "missing.key")).toBe("missing.key");
});

test("builds public SEO titles and descriptions", () => {
  const t = (key, params) => translate("fr", key, params);
  const associationSeo = buildAssociationPublicSeo({
    association: { name: "Association Reining Quebec" },
    t,
  });
  const showSeo = buildShowPublicSeo({
    association: { name: "Association Reining Quebec" },
    show: { name: "Classique de printemps" },
    t,
  });

  expect(associationSeo.title).toBe(
    "Association Reining Quebec | Shows publics | ShowScore"
  );
  expect(associationSeo.description).toContain("Association Reining Quebec");
  expect(showSeo.title).toBe(
    "Classique de printemps | Association Reining Quebec | ShowScore"
  );
  expect(showSeo.description).toContain("Classique de printemps");
});

test("combines retained judge scores without averaging", () => {
  expect(classUsesCombinedJudgeScore("1")).toBe(true);
  expect(classUsesCombinedJudgeScore("TRAIL_CUSTOM")).toBe(false);

  const combined = buildCombinedJudgeScore([
    { judgeId: "judge-1", scoreTotal: "70.0" },
    { judgeId: "judge-2", scoreTotal: "71.0" },
    { judgeId: "judge-3", scoreTotal: "72.0" },
    { judgeId: "judge-4", scoreTotal: "73.0" },
    { judgeId: "judge-5", scoreTotal: "74.0" },
  ]);

  expect(combined.scoreTotal).toBe("216");
  expect(combined.retainedJudges.map((judge) => judge.judgeId)).toEqual([
    "judge-2",
    "judge-3",
    "judge-4",
  ]);
  expect(combined.droppedJudges.map((judge) => judge.judgeId)).toEqual([
    "judge-1",
    "judge-5",
  ]);
});

test("keeps judge name spaces while editing but trims persisted names", () => {
  const draftJudges = normalizeClassJudges(
    {
      judges: [{ id: "judge-1", name: "Jean Tremblay ", order: 1 }],
    },
    { trimNames: false }
  );
  const persistedJudges = normalizeClassJudges({
    judges: draftJudges,
  });

  expect(draftJudges[0].name).toBe("Jean Tremblay ");
  expect(persistedJudges[0].name).toBe("Jean Tremblay");
});

test("builds combined judge PDF rows by draw and keeps signatures", () => {
  const classData = {
    setup: {
      judgeName: "Legacy judge",
      judges: [
        { id: "judge-1", name: "Judge A", order: 1 },
        { id: "judge-2", name: "Judge B", order: 2 },
        { id: "judge-3", name: "Judge C", order: 3 },
      ],
      runs: [
        { id: "run-1", draw: 1, backNumber: "101", rider: "Rider 1" },
        { id: "run-2", draw: 2, backNumber: "202", rider: "Rider 2" },
      ],
    },
    judgeSessions: [
      {
        judgeId: "judge-1",
        judgeName: "Judge A",
        judgeSignature: "data:image/png;base64,a",
        judgeSignedAt: "2026-01-01T10:00:00.000Z",
        finalized: true,
        runs: [
          { id: "run-1", draw: 1, scoreTotal: "70.0" },
          { id: "run-2", draw: 2, scoreTotal: "71.0" },
        ],
      },
      {
        judgeId: "judge-2",
        judgeName: "Judge B",
        judgeSignature: "data:image/png;base64,b",
        judgeSignedAt: "2026-01-01T10:01:00.000Z",
        finalized: true,
        runs: [
          { id: "run-1", draw: 1, scoreTotal: "69.5" },
          { id: "run-2", draw: 2, scoreTotal: "70.5" },
        ],
      },
      {
        judgeId: "judge-3",
        judgeName: "Judge C",
        judgeSignature: "data:image/png;base64,c",
        judgeSignedAt: "2026-01-01T10:02:00.000Z",
        finalized: true,
        runs: [
          { id: "run-1", draw: 1, scoreTotal: "71.0" },
          { id: "run-2", draw: 2, scoreTotal: "72.0" },
        ],
      },
    ],
  };

  const runs = buildMultiJudgeOfficialRuns(classData);
  expect(runs.map((run) => `${run.draw}:${run.judgeName}:${run.scoreTotal}`))
    .toEqual([
      "1:Judge A:70.0",
      "1:Judge B:69.5",
      "1:Judge C:71.0",
      "2:Judge A:71.0",
      "2:Judge B:70.5",
      "2:Judge C:72.0",
    ]);

  expect(getJudgeSignatureEntries(classData)).toMatchObject([
    { judgeName: "Judge A", judgeSignature: "data:image/png;base64,a" },
    { judgeName: "Judge B", judgeSignature: "data:image/png;base64,b" },
    { judgeName: "Judge C", judgeSignature: "data:image/png;base64,c" },
  ]);
});

test("public scoresheets keep judge names on combined judge rows", () => {
  const classView = buildPublicClassView({
    classItem: {
      id: "class-multi-public",
      name: "Open Reining",
      pattern: "R1",
    },
    setup: {
      pattern: "R1",
    },
    publication: {
      status: PUBLICATION_STATUSES.PUBLISHED,
      publishedAt: "2026-05-24T14:00:00.000Z",
    },
    official: {
      isSecretariatValidated: true,
      judgeName: "Multi-juges",
      officialRuns: [
        {
          id: "run-1",
          draw: 1,
          judgeId: "judge-2",
          judgeName: "Judge B",
          judgeOrder: 2,
          backNumber: "101",
          scoreTotal: "70.0",
        },
        {
          id: "run-1",
          draw: 1,
          judgeId: "judge-1",
          judgeName: "Judge A",
          judgeOrder: 1,
          backNumber: "101",
          scoreTotal: "71.0",
        },
        {
          id: "run-2",
          draw: 2,
          judgeId: "judge-1",
          judgeName: "Judge A",
          judgeOrder: 1,
          backNumber: "202",
          scoreTotal: "72.0",
        },
      ],
    },
    scoringRuns: [],
  });

  expect(classView.isMultiJudge).toBe(true);
  expect(classView.judgeNames).toEqual(["Judge A", "Judge B"]);
  expect(
    classView.runs.map((run) => `${run.draw}:${run.judgeName}:${run.scoreTotal}`)
  ).toEqual(["1:Judge A:71", "1:Judge B:70", "2:Judge A:72"]);
});

test("parses imported draw rows in draw order", () => {
  const runs = parseImportedRuns(`
    2, 202, Marie Roy, Custom Whiz, Luc Roy
    -1, 303, Late Entry, First Horse, Late Owner
    1, 101, Felix Gadreau, Smart Spook, Jean Tremblay
  `);

  expect(runs).toMatchObject([
    {
      order: 1,
      draw: -1,
      backNumber: "303",
      rider: "Late Entry",
      horse: "First Horse",
      owner: "Late Owner",
    },
    {
      order: 2,
      draw: 1,
      backNumber: "101",
      rider: "Felix Gadreau",
      horse: "Smart Spook",
      owner: "Jean Tremblay",
    },
    {
      order: 3,
      draw: 2,
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

test("parses imported draw class codes when a code column is present", () => {
  const importedDraw = parseImportedDraw(`
    1, 101, Open Rider, Shiney Horse, Owner One, , "NHO,NH2,OPEN"
    2, 202, Non Pro Rider, Smart Horse, Owner Two, , "NHNP,NONP"
  `);

  expect(importedDraw.runs).toHaveLength(2);
  expect(importedDraw.runs[0].classCodes).toEqual(["NHO", "NH2", "OPEN"]);
  expect(importedDraw.runs[1].classCodes).toEqual(["NHNP", "NONP"]);
});

test("parses Funware positioned PDF class codes with spaces and split headers", () => {
  const importedDraw = parsePositionedPdfPages([
    [
      {
        cells: [
          { x: 36, text: "Showbill #:" },
          { x: 92, text: "105" },
          { x: 128, text: "Class:" },
          { x: 161, text: "5300" },
          { x: 205, text: "NRHA - Rookie Level 1 [ROK 1 ]" },
        ],
      },
      {
        cells: [
          { x: 112, text: "Held with:" },
          { x: 161, text: "5301" },
          { x: 197, text: "NRHA" },
          { x: 233, text: "Prime Time Rookie [PTR]" },
        ],
      },
      {
        cells: [
          { x: 161, text: "5310" },
          { x: 197, text: "NRHA" },
          { x: 233, text: "Rookie Level 2 [ROK2]" },
        ],
      },
      {
        cells: [
          { x: 161, text: "5395" },
          { x: 197, text: "AQR" },
          { x: 233, text: "Aqr Rookie Sliding D [D CLAS]" },
        ],
      },
      {
        cells: [
          { x: 161, text: "5399" },
          { x: 197, text: "AQR" },
          { x: 233, text: "Debutant I / Beginner I [DEB-I]" },
        ],
      },
      {
        cells: [
          { x: 161, text: "5400" },
          { x: 197, text: "AQR" },
          { x: 233, text: "Debutant II / Beginner II [DEB-II]" },
        ],
      },
      {
        cells: [
          { x: 161, text: "5406" },
          { x: 197, text: "AQR" },
          { x: 233, text: "Sr 1st Yr Green [DE1-" },
        ],
      },
      {
        cells: [{ x: 161, text: "SR]" }],
      },
      {
        cells: [
          { x: 50, text: "-1" },
          { x: 141, text: "One Ofa Morning Star" },
          { x: 317, text: "AMELIE DESCHENES" },
        ],
      },
      {
        cells: [{ x: 317, text: "DE1-SR" }],
      },
      {
        cells: [
          { x: 108, text: "2585" },
          { x: 141, text: "AMELIE DESCHENES" },
        ],
      },
      {
        cells: [
          { x: 54, text: "1" },
          { x: 141, text: "GrDunit" },
          { x: 317, text: "KAREN MERCIER / Levis" },
        ],
      },
      {
        cells: [{ x: 317, text: "ROK2,DEB-II,ROK 1 ,D CLAS" }],
      },
      {
        cells: [
          { x: 108, text: "4030" },
          { x: 141, text: "ELENA DORE" },
        ],
      },
    ],
  ]);

  expect(importedDraw.blockClasses).toEqual([
    {
      code: "ROK 1",
      name: "Rookie Level 1",
      classNumber: "5300",
      association: "NRHA",
    },
    {
      code: "PTR",
      name: "Prime Time Rookie",
      classNumber: "5301",
      association: "NRHA",
    },
    {
      code: "ROK2",
      name: "Rookie Level 2",
      classNumber: "5310",
      association: "NRHA",
    },
    {
      code: "D CLAS",
      name: "Aqr Rookie Sliding D",
      classNumber: "5395",
      association: "AQR",
    },
    {
      code: "DEB-I",
      name: "Debutant I / Beginner I",
      classNumber: "5399",
      association: "AQR",
    },
    {
      code: "DEB-II",
      name: "Debutant II / Beginner II",
      classNumber: "5400",
      association: "AQR",
    },
    {
      code: "DE1-SR",
      name: "Sr 1st Yr Green",
      classNumber: "5406",
      association: "AQR",
    },
  ]);
  expect(importedDraw.runs).toHaveLength(2);
  expect(importedDraw.runs[0]).toMatchObject({
    draw: -1,
    backNumber: "2585",
    rider: "AMELIE DESCHENES",
    classCodes: ["DE1-SR"],
  });
  expect(importedDraw.runs[1]).toMatchObject({
    draw: 1,
    backNumber: "4030",
    rider: "ELENA DORE",
    classCodes: ["ROK2", "DEB-II", "ROK 1", "D CLAS"],
  });
});

test("parses Funware split leading-hyphen classes and scratched owners", () => {
  const importedDraw = parsePositionedPdfPages([
    [
      {
        cells: [
          { x: 36, text: "Showbill #:" },
          { x: 92, text: "121" },
          { x: 128, text: "Class:" },
          { x: 161, text: "3100" },
          { x: 205, text: "NRHA - Youth 13 & Under [Y13]" },
        ],
      },
      {
        cells: [
          { x: 112, text: "Held with:" },
          { x: 161, text: "5396" },
          { x: 197, text: "AQR" },
          { x: 233, text: "Young Rider 14-21 [JC1421]" },
        ],
      },
      {
        cells: [
          { x: 161, text: "5397" },
          { x: 197, text: "AQR" },
          { x: 233, text: "Youth Beginner [-" },
        ],
      },
      {
        cells: [{ x: 161, text: "18AQR]" }],
      },
      {
        cells: [
          { x: 161, text: "5407" },
          { x: 197, text: "AQR" },
          { x: 233, text: "1st Yr Green Youth" },
        ],
      },
      {
        cells: [{ x: 161, text: "[DE1-J]" }],
      },
      {
        cells: [
          { x: 54, text: "1" },
          { x: 141, text: "RM WILD CHIKA PEP" },
          { x: 317, text: "MARCO GAUDETTE / ST-LIBOIRE, QC" },
        ],
      },
      {
        cells: [{ x: 317, text: "JC1421,-18AQR" }],
      },
      {
        cells: [
          { x: 108, text: "4038" },
          { x: 141, text: "MADISON GAUDETTE" },
        ],
      },
      {
        cells: [
          { x: 54, text: "2" },
          { x: 141, text: "ITS A SMART WHIZ" },
          { x: 317, text: "MARTIN BRISEBOIS / ST-" },
        ],
      },
      {
        cells: [
          { x: 46, text: "Scratched" },
          { x: 108, text: "2563" },
          { x: 141, text: "NAOMIE BRISEBOIS" },
          { x: 317, text: "APOLLINAIRE, QC" },
        ],
      },
      {
        cells: [{ x: 317, text: "JC1421" }],
      },
    ],
  ]);

  expect(importedDraw.blockClasses).toEqual([
    {
      code: "Y13",
      name: "Youth 13 & Under",
      classNumber: "3100",
      association: "NRHA",
    },
    {
      code: "JC1421",
      name: "Young Rider 14-21",
      classNumber: "5396",
      association: "AQR",
    },
    {
      code: "-18AQR",
      name: "Youth Beginner",
      classNumber: "5397",
      association: "AQR",
    },
    {
      code: "DE1-J",
      name: "1st Yr Green Youth",
      classNumber: "5407",
      association: "AQR",
    },
  ]);
  expect(importedDraw.runs[0]).toMatchObject({
    draw: 1,
    backNumber: "4038",
    rider: "MADISON GAUDETTE",
    classCodes: ["JC1421", "-18AQR"],
  });
  expect(importedDraw.runs[1]).toMatchObject({
    draw: 2,
    backNumber: "2563",
    rider: "NAOMIE BRISEBOIS",
    owner: "MARTIN BRISEBOIS / ST- APOLLINAIRE, QC - Scratched",
    classCodes: ["JC1421"],
  });
});

test("parses REO positioned PDF draws with owners and division codes", () => {
  const importedDraw = parsePositionedPdfPages([
    [
      {
        cells: [
          { x: 227, text: "CNYRHA2026 Draw Report" },
        ],
      },
      {
        cells: [
          {
            x: 127,
            text: "Draw for Class 04 ROOKIE on 6-5-2026 (Pattern 18)",
          },
        ],
      },
      {
        cells: [
          { x: 32, text: "Draw" },
          { x: 68, text: "Entry" },
          { x: 139, text: "Horse / Owner 1" },
          { x: 297, text: "Rider / Owner 2" },
          { x: 454, text: "Scores / Divisions Entered" },
        ],
      },
      {
        cells: [
          { x: 45, text: "1" },
          { x: 71, text: "343" },
          { x: 139, text: "WHO DAT HOT CHIC" },
          { x: 297, text: "MADILYNNE KRISTINE LANNON |____|" },
        ],
      },
      {
        cells: [
          { x: 139, text: "CHAD LANNON" },
          { x: 454, text: "5300 / 5310" },
        ],
      },
      {
        cells: [
          { x: 80, text: "(M)" },
          { x: 139, text: "WIMPYS LITTLE STEP" },
          { x: 297, text: "HOT CHIC DREAMS" },
        ],
      },
      {
        cells: [
          { x: 45, text: "2" },
          { x: 71, text: "312" },
          { x: 139, text: "YANKEE GUNNA SMOKE" },
          { x: 297, text: "LEXI PORTER" },
          { x: 454, text: "|____|" },
        ],
      },
      {
        cells: [
          { x: 139, text: "SHANE PORTER" },
          { x: 297, text: "KATE GRIFFIN" },
          { x: 454, text: "5301" },
        ],
      },
      {
        cells: [
          { x: 66, text: "Entries" },
          { x: 139, text: "Division" },
          { x: 297, text: "Total Purse" },
          { x: 454, text: "Places" },
        ],
      },
      {
        cells: [
          { x: 84, text: "19" },
          { x: 139, text: "5300 ROOKIE" },
          { x: 297, text: "$ 200.00" },
          { x: 457, text: "5" },
        ],
      },
      {
        cells: [
          { x: 84, text: "12" },
          { x: 139, text: "5301 PT ROOKIE" },
          { x: 297, text: "$ 100.00" },
          { x: 457, text: "3" },
        ],
      },
      {
        cells: [
          { x: 84, text: "17" },
          { x: 139, text: "5310 ROOKIE II" },
          { x: 297, text: "$ 100.00" },
          { x: 457, text: "4" },
        ],
      },
    ],
  ]);

  expect(importedDraw.runs).toHaveLength(2);
  expect(importedDraw.runs[0]).toMatchObject({
    order: 1,
    draw: 1,
    backNumber: "343",
    rider: "MADILYNNE KRISTINE LANNON",
    horse: "WHO DAT HOT CHIC",
    owner: "CHAD LANNON",
    classCodes: ["5300", "5310"],
  });
  expect(importedDraw.runs[1]).toMatchObject({
    order: 2,
    draw: 2,
    backNumber: "312",
    rider: "LEXI PORTER",
    horse: "YANKEE GUNNA SMOKE",
    owner: "SHANE PORTER / KATE GRIFFIN",
    classCodes: ["5301"],
  });
  expect(importedDraw.blockClasses).toEqual([
    {
      code: "5300",
      name: "ROOKIE",
      classNumber: "5300",
      association: "REO",
    },
    {
      code: "5301",
      name: "PT ROOKIE",
      classNumber: "5301",
      association: "REO",
    },
    {
      code: "5310",
      name: "ROOKIE II",
      classNumber: "5310",
      association: "REO",
    },
  ]);
});

test("parses REO PDF draws when text fragments split columns", () => {
  const importedDraw = parsePositionedPdfPages([
    [
      {
        cells: [{ x: 227, text: "CNYRHA2026 Draw Report" }],
      },
      {
        cells: [
          {
            x: 151,
            text: "Draw for Class 04 ROOKIE on 6-5-2026 (Pattern 18)",
          },
        ],
      },
      {
        cells: [
          { x: 32, text: "Draw" },
          { x: 68, text: "Entry" },
          { x: 139, text: "Horse / Owner 1" },
          { x: 297, text: "Rider / Owner 2" },
          { x: 454, text: "Scores / Divisions Entered" },
        ],
      },
      {
        cells: [
          { x: 39, text: "11" },
          { x: 71, text: "265" },
          { x: 139, text: "CHICS" },
          { x: 170, text: "DREAM OF LACE" },
          { x: 297, text: "NICOLE" },
          { x: 335, text: "M." },
          { x: 352, text: "PETRANCHUK" },
          { x: 454, text: "|____|" },
          { x: 494, text: "5310" },
        ],
      },
      {
        cells: [
          { x: 139, text: "DEVINNE" },
          { x: 183, text: "RYAN" },
          { x: 219, text: "BENNETT" },
        ],
      },
      {
        cells: [
          { x: 80, text: "(M)" },
          { x: 139, text: "CHIC DREAMIN" },
          { x: 297, text: "BOOMIN IN LACE" },
        ],
      },
      {
        cells: [
          { x: 39, text: "12" },
          { x: 71, text: "347" },
          { x: 139, text: "GATA CUSTOM VINTAGE" },
          { x: 297, text: "DENISE ANN" },
          { x: 360, text: "LOMASCOLO |____| 5301 / 5310" },
        ],
      },
      {
        cells: [
          { x: 139, text: "DENISE ANN" },
          { x: 210, text: "LOMASCOLO" },
        ],
      },
      {
        cells: [
          { x: 66, text: "Entries" },
          { x: 139, text: "Division" },
          { x: 297, text: "Total Purse" },
          { x: 454, text: "Places" },
        ],
      },
      {
        cells: [
          { x: 89, text: "6" },
          { x: 139, text: "5301" },
          { x: 173, text: "PT ROOKIE" },
          { x: 297, text: "$ 100.00" },
          { x: 457, text: "3" },
        ],
      },
      {
        cells: [
          { x: 84, text: "14" },
          { x: 139, text: "5310" },
          { x: 173, text: "ROOKIE II" },
          { x: 297, text: "$ 298.33" },
          { x: 457, text: "5" },
        ],
      },
    ],
  ]);

  expect(importedDraw.runs).toHaveLength(2);
  expect(importedDraw.runs[0]).toMatchObject({
    draw: 11,
    backNumber: "265",
    rider: "NICOLE M. PETRANCHUK",
    horse: "CHICS DREAM OF LACE",
    owner: "DEVINNE RYAN BENNETT",
    classCodes: ["5310"],
  });
  expect(importedDraw.runs[1]).toMatchObject({
    draw: 12,
    backNumber: "347",
    rider: "DENISE ANN LOMASCOLO",
    horse: "GATA CUSTOM VINTAGE",
    owner: "DENISE ANN LOMASCOLO",
    classCodes: ["5301", "5310"],
  });
  expect(importedDraw.blockClasses).toEqual([
    {
      code: "5301",
      name: "PT ROOKIE",
      classNumber: "5301",
      association: "REO",
    },
    {
      code: "5310",
      name: "ROOKIE II",
      classNumber: "5310",
      association: "REO",
    },
  ]);
});

test("builds independent result groups by imported class code", () => {
  const groups = buildClassResultGroups({
    classItem: {
      id: "block-1",
      name: "Novice Horse Block",
      classCode: "BLOCK",
      pattern: "pattern-8",
    },
    setup: {
      pattern: "pattern-8",
      blockClasses: [
        { code: "NHO", name: "Novice Horse Open" },
        { code: "NH2", name: "Novice Horse Level 2" },
      ],
      runs: [
        {
          id: "run-1",
          draw: 1,
          backNumber: "101",
          rider: "Open Rider",
          horse: "Horse One",
          classCodes: ["NHO", "NH2"],
        },
        {
          id: "run-2",
          draw: 2,
          backNumber: "202",
          rider: "Level Two Rider",
          horse: "Horse Two",
          classCodes: ["NH2"],
        },
      ],
    },
    official: {
      isSecretariatValidated: true,
      officialRuns: [
        { id: "run-1", draw: 1, scoreTotal: "72.0" },
        { id: "run-2", draw: 2, scoreTotal: "70.5" },
      ],
    },
    scoringRuns: [],
  });

  expect(groups.map((group) => group.code)).toEqual(["NH2", "NHO"]);
  expect(groups.find((group) => group.code === "NHO").entries).toHaveLength(1);
  expect(groups.find((group) => group.code === "NH2").entries).toMatchObject([
    { rank: 1, backNumber: "101", scoreTotal: "72" },
    { rank: 2, backNumber: "202", scoreTotal: "70½" },
  ]);

  const normalizedGroups = normalizeResultGroups(groups);
  expect(
    normalizedGroups.find((group) => group.code === "NH2").entries
  ).toMatchObject([
    { rank: 1, backNumber: "101", scoreTotal: "72" },
    { rank: 2, backNumber: "202", scoreTotal: "70½" },
  ]);
  expect(
    normalizeResultGroups([
      {
        id: "legacy",
        code: "LEG",
        entries: [
          { id: "legacy-1", backNumber: "101", scoreTotal: "72" },
          { id: "legacy-2", backNumber: "202", scoreTotal: "70.5" },
        ],
      },
    ])[0].entries
  ).toMatchObject([{ rank: 1 }, { rank: 2 }]);
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
    score: "+½",
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

test("secretariat validation publishes the public scoresheet without publishing class results", async () => {
  const classData = {
    classItem: {
      id: "class-auto-publication",
      name: "Open",
      pattern: "R1",
    },
    setup: {
      pattern: "R1",
    },
    official: {
      isFinalized: true,
      judgeName: "Judge A",
      judgeSignature: "data:image/png;base64,signature",
      finalizedAt: "2026-06-09T12:00:00.000Z",
      judgeSignedAt: "2026-06-09T12:00:00.000Z",
    },
    scoringRuns: [
      {
        id: "run-1",
        draw: 1,
        backNumber: "101",
        rider: "Felix Gadreau",
        horse: "Smart Spook",
        scores: ["0"],
        penalties: [""],
        scoreTotal: "70",
        penTotal: "0",
      },
    ],
  };

  const officialResult = await validateOfficialResultRepository({
    classData,
    validatedAt: "2026-06-09T13:00:00.000Z",
  });
  const scoresheetPublication = getPublicationState("class-auto-publication");
  const resultPublication = getClassResultPublication("class-auto-publication");

  expect(officialResult.secretariatValidatedAt).toBe(
    "2026-06-09T13:00:00.000Z"
  );
  expect(scoresheetPublication.status).toBe(PUBLICATION_STATUSES.PUBLISHED);
  expect(scoresheetPublication.publishedBy).toBe("secretariat");
  expect(resultPublication.status).toBe(RESULT_PUBLICATION_STATUSES.HIDDEN);
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
        {
          id: "run-6",
          draw: 6,
          backNumber: "606",
          rider: "Rider 6",
          scoreTotal: "",
        },
      ],
    },
  });

  expect(classView.activeRun.draw).toBe(4);
  expect(classView.nextRun.draw).toBe(5);
  expect(classView.secondNextRun.draw).toBe(6);
  expect(classView.orderRuns.map((run) => run.liveOrderStatus)).toEqual([
    "passed",
    "passed",
    "passed",
    "active",
    "preparation",
    "waiting",
  ]);
  expect(classView.passedRuns.map((run) => run.draw)).toEqual([3, 2, 1]);
  expect(classView.lastPassedRuns.map((run) => run.draw)).toEqual([3, 2]);
  expect(classView.lastPassedRuns[0].manoeuvres[1]).toMatchObject({
    score: "+½",
    penalty: "2",
  });
  expect(classView.lastPassedRuns[0].note).toBe("Penalty note.");
});

test("multi-judge public live aggregates active run and completed score", () => {
  const scores = getPatternHeaders("1").map(() => "0");
  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-live-multi",
      name: "Open Futurity",
      pattern: "1",
    },
    setup: {
      pattern: "1",
      judges: [
        { id: "judge-1", name: "Judge A", order: 1 },
        { id: "judge-2", name: "Judge B", order: 2 },
        { id: "judge-3", name: "Judge C", order: 3 },
      ],
      runs: [
        { id: "run-1", draw: 1, backNumber: "101", rider: "Rider 1" },
        { id: "run-2", draw: 2, backNumber: "202", rider: "Rider 2" },
        { id: "run-3", draw: 3, backNumber: "303", rider: "Rider 3" },
      ],
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_SCORING,
    },
    scoringSession: {
      activeManoeuvre: { draw: 3 },
    },
    judgeSessions: [
      {
        judgeId: "judge-1",
        activeManoeuvre: { draw: 2 },
        updatedAt: "2026-01-01T10:02:00.000Z",
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            scores,
            penalties: [],
            scoreTotal: "70.0",
            completedAt: "2026-01-01T10:00:00.000Z",
          },
        ],
      },
      {
        judgeId: "judge-2",
        activeManoeuvre: { draw: 2 },
        updatedAt: "2026-01-01T10:03:00.000Z",
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            scores,
            penalties: [],
            scoreTotal: "71.0",
            completedAt: "2026-01-01T10:01:00.000Z",
          },
        ],
      },
      {
        judgeId: "judge-3",
        activeManoeuvre: { draw: 2 },
        updatedAt: "2026-01-01T10:04:00.000Z",
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            scores,
            penalties: [],
            scoreTotal: "72.0",
            completedAt: "2026-01-01T10:02:00.000Z",
          },
        ],
      },
    ],
  });

  expect(classView.activeRun.draw).toBe(2);
  expect(classView.nextRun.draw).toBe(3);
  expect(classView.latestScore.scoreTotal).toBe("213");
  expect(classView.latestScore.judgeScores).toEqual([
    { judgeId: "judge-1", judgeName: "Judge A", scoreTotal: "70" },
    { judgeId: "judge-2", judgeName: "Judge B", scoreTotal: "71" },
    { judgeId: "judge-3", judgeName: "Judge C", scoreTotal: "72" },
  ]);
  expect(classView.orderRuns.map((run) => run.liveOrderStatus)).toEqual([
    "passed",
    "active",
    "preparation",
  ]);
});

test("multi-judge public live disables detailed scoring and sums two judges", () => {
  const scores = getPatternHeaders("1").map(() => "0");
  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-live-multi-two",
      name: "Open Futurity",
      pattern: "1",
    },
    setup: {
      pattern: "1",
      judges: [
        { id: "judge-1", name: "Judge A", order: 1 },
        { id: "judge-2", name: "Judge B", order: 2 },
      ],
      runs: [
        { id: "run-1", draw: 1, backNumber: "101", rider: "Rider 1" },
        { id: "run-2", draw: 2, backNumber: "202", rider: "Rider 2" },
      ],
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE,
    },
    judgeSessions: [
      {
        judgeId: "judge-1",
        activeManoeuvre: { draw: 2 },
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            scores,
            penalties: [],
            scoreTotal: "70.0",
          },
        ],
      },
      {
        judgeId: "judge-2",
        activeManoeuvre: { draw: 2 },
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            scores,
            penalties: [],
            scoreTotal: "71.0",
          },
        ],
      },
    ],
  });

  expect(classView.showScores).toBe(true);
  expect(classView.showScoreDetails).toBe(false);
  expect(classView.activeRun.draw).toBe(2);
  expect(classView.latestScore.scoreTotal).toBe("141");
  expect(classView.latestScore.judgeScores).toEqual([
    { judgeId: "judge-1", judgeName: "Judge A", scoreTotal: "70" },
    { judgeId: "judge-2", judgeName: "Judge B", scoreTotal: "71" },
  ]);
  expect(classView.lastPassedRuns[0].manoeuvres[0].score).toBe("");
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

test("public live view uses setup order before scoring starts", () => {
  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-live-setup-order",
      name: "Green Reiner",
      pattern: "2",
    },
    setup: {
      runs: [
        { id: "setup-run-1", draw: 1, backNumber: "101", rider: "Rider 1" },
        { id: "setup-run-2", draw: 2, backNumber: "202", rider: "Rider 2" },
        { id: "setup-run-3", draw: 3, backNumber: "303", rider: "Rider 3" },
      ],
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
    },
    scoringSession: null,
  });

  expect(classView.nextRun.draw).toBe(1);
  expect(classView.secondNextRun.draw).toBe(2);
  expect(classView.orderRuns.map((run) => run.liveOrderStatus)).toEqual([
    "preparation",
    "waiting",
    "upcoming",
  ]);
});

test("public live scoring shows completed totals only", () => {
  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-live-completed-score",
      name: "Open Reining",
      pattern: "2",
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_SCORING,
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
          backNumber: "101",
          scoreTotal: "70.0",
          penTotal: "",
          note: "Completed note",
          scores: Array(7).fill("0"),
          penalties: Array(7).fill(""),
        },
        {
          id: "run-2",
          draw: 2,
          rider: "Rider 2",
          backNumber: "202",
          scoreTotal: "70.5",
          scores: ["+0.5", ""],
          penalties: ["", ""],
        },
      ],
    },
  });

  expect(classView.showScores).toBe(true);
  expect(classView.showScoreDetails).toBe(false);
  expect(classView.activeRun.scoreTotal).toBe("");
  expect(classView.latestScore.draw).toBe(1);
  expect(classView.lastPassedRuns[0]).toMatchObject({
    draw: 1,
    scoreTotal: "70",
    penTotal: "",
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

test("supports schedule-only classes without scoring patterns", () => {
  expect(getPatternDisplayName(NO_PATTERN_ID)).toBe("Sans patron");
  expect(getPatternHeaders(NO_PATTERN_ID)).toEqual([]);

  const classView = buildPublicLiveClassView({
    classItem: {
      id: "class-schedule-only",
      name: "Leadline",
      pattern: NO_PATTERN_ID,
      arena: "Main arena",
    },
    setup: {
      pattern: NO_PATTERN_ID,
      scheduleDetails: {
        participantCount: "30",
        sectionCount: "3",
        sectionSize: "10",
        completedSectionCount: 2,
        hasFinal: true,
        finalCompleted: false,
        isCompleted: false,
        note: "Finale à la suite",
      },
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
    },
    scoringSession: {
      activeManoeuvre: { draw: 1 },
      runs: [{ draw: 1, rider: "Should not display" }],
    },
  });

  expect(classView).toMatchObject({
    isScheduleOnly: true,
    showScores: false,
    activeRun: null,
    nextRun: null,
    runCount: 30,
      scheduleDetails: {
        participantCount: "30",
        sectionCount: "3",
        sectionSize: "10",
        completedSectionCount: 2,
        hasFinal: true,
        finalCompleted: false,
        isCompleted: false,
        note: "Finale à la suite",
      },
  });

  const announcerView = buildAnnouncerClassView({
    classItem: {
      id: "class-schedule-only",
      name: "Leadline",
      pattern: NO_PATTERN_ID,
    },
    setup: classView,
    publication: {
      status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
    },
    scoringRuns: [{ draw: 1, rider: "Should not display" }],
  });

  expect(announcerView).toMatchObject({
    isScheduleOnly: true,
    runCount: 30,
    isComplete: false,
    activeRun: null,
    latestScore: null,
  });

  const completedPublicView = buildPublicLiveClassView({
    classItem: {
      id: "class-schedule-only",
      name: "Leadline",
      pattern: NO_PATTERN_ID,
    },
    setup: {
      pattern: NO_PATTERN_ID,
      scheduleDetails: {
        participantCount: "30",
        sectionCount: "3",
        completedSectionCount: 3,
        hasFinal: true,
        finalCompleted: true,
        isCompleted: true,
      },
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
    },
  });

  expect(completedPublicView).toBeNull();
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

test("paid warmup live follows edited rider order while running", () => {
  const entries = [
    { id: "entry-1", order: 1, rider: "Marie", status: "pending" },
    { id: "entry-2", order: 2, rider: "Alex", status: "pending" },
    { id: "entry-3", order: 3, rider: "Félix", status: "pending" },
  ];
  const movedEntries = movePaidWarmupEntry(entries, "entry-3", 1);
  const insertedEntries = insertPaidWarmupEntryAfter(movedEntries, "entry-3", {
    id: "entry-4",
    rider: "Late add",
  });
  const liveView = buildPaidWarmupLiveView({
    id: "warmup-1",
    name: "Paid warm up",
    activeEntryId: "entry-1",
    activeStartedAt: "2026-05-25T14:00:00.000Z",
    entries: insertedEntries,
  });

  expect(insertedEntries.map((entry) => entry.rider)).toEqual([
    "Marie",
    "Félix",
    "Late add",
    "Alex",
  ]);
  expect(insertedEntries.map((entry) => entry.order)).toEqual([1, 2, 3, 4]);
  expect(liveView.activeEntry.rider).toBe("Marie");
  expect(liveView.nextEntry.rider).toBe("Félix");
  expect(liveView.secondNextEntry.rider).toBe("Late add");
});

test("public show view exposes a public paid warmup before the timer starts", () => {
  saveDays([
    {
      id: "day-public-warmup",
      associationId: "association-public-warmup",
      showId: "show-public-warmup",
      label: "Friday",
      date: "2026-06-01",
      sortOrder: 1,
    },
  ]);
  saveClasses([]);
  savePaidWarmup({
    id: "warmup-public",
    associationId: "association-public-warmup",
    showId: "show-public-warmup",
    dayId: "day-public-warmup",
    name: "Warm up public",
    isPublicLive: true,
    entries: [
      { id: "entry-1", rider: "Marie", status: "pending" },
      { id: "entry-2", rider: "Alex", status: "pending" },
    ],
  });

  const publicView = getPublicShowView("show-public-warmup");

  expect(publicView.liveClassCount).toBe(1);
  expect(publicView.livePaidWarmup).toMatchObject({
    id: "warmup-public",
    name: "Warm up public",
  });
  expect(publicView.livePaidWarmup.activeEntry).toBeNull();
  expect(publicView.livePaidWarmup.nextEntry).toMatchObject({
    rider: "Marie",
  });
  expect(publicView.livePaidWarmup.secondNextEntry).toMatchObject({
    rider: "Alex",
  });
});

test("paid warmup timer cues trigger at half time, one minute, and finish", () => {
  const warmup = {
    durationSeconds: 300,
  };

  expect(getPaidWarmupTimerCueType(warmup, 151)).toBeNull();
  expect(getPaidWarmupTimerCueType(warmup, 150)).toBe(
    PAID_WARMUP_TIMER_CUES.HALF_TIME
  );
  expect(getPaidWarmupTimerCueType(warmup, 60)).toBe(
    PAID_WARMUP_TIMER_CUES.ONE_MINUTE
  );
  expect(getPaidWarmupTimerCueType(warmup, 0)).toBe(
    PAID_WARMUP_TIMER_CUES.FINISHED
  );
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

test("routes show entry by a single operational role", () => {
  const baseArgs = {
    associationId: "association-1",
    showId: "show-1",
  };

  expect(
    getDefaultShowRouteForRoles({
      ...baseArgs,
      roles: [ASSOCIATION_ROLES.SCRIBE],
    })
  ).toBe("/associations/association-1/shows/show-1/scribe");

  expect(
    getDefaultShowRouteForRoles({
      ...baseArgs,
      roles: [ASSOCIATION_ROLES.ANNOUNCER],
    })
  ).toBe("/associations/association-1/shows/show-1/announcer");

  expect(
    getDefaultShowRouteForRoles({
      ...baseArgs,
      roles: [ASSOCIATION_ROLES.SECRETARY],
    })
  ).toBe("/associations/association-1/shows/show-1/secretariat");

  expect(
    getDefaultShowRouteForRoles({
      ...baseArgs,
      roles: [ASSOCIATION_ROLES.SCRIBE, ASSOCIATION_ROLES.ANNOUNCER],
    })
  ).toBe("/associations/association-1/shows/show-1");

  expect(
    getDefaultShowRouteForRoles({
      ...baseArgs,
      roles: [ASSOCIATION_ROLES.ADMIN],
    })
  ).toBe("/associations/association-1/shows/show-1");
});

test("defers automatic app reloads on scribe scoring pages", () => {
  const scribeScoringPath = "/associations/association-1/scribe/classes/class-1";

  expect(isScribeScoringPath(scribeScoringPath)).toBe(true);
  expect(canReloadForAppUpdate(scribeScoringPath)).toBe(false);
  expect(
    canReloadForAppUpdate("/associations/association-1/shows/show-1/scribe")
  ).toBe(true);
  expect(
    canReloadForAppUpdate("/associations/association-1/shows/show-1/announcer")
  ).toBe(true);
});

test("builds analytics route context and summary", () => {
  expect(
    getPageEventContext(
      "/public/associations/association-1/shows/show-1"
    )
  ).toMatchObject({
    associationId: "association-1",
    showId: "show-1",
    pageCategory: "public_show",
    isPublicPath: true,
  });

  expect(
    getPageEventContext(
      "/associations/association-1/scribe/classes/class-1"
    )
  ).toMatchObject({
    associationId: "association-1",
    classId: "class-1",
    pageCategory: "scribe_class",
    isPublicPath: false,
  });

  const summary = buildAnalyticsSummary([
    {
      eventType: "analytics",
      eventName: "page_view",
      sessionId: "session-1",
      path: "/public",
      metadata: { isPublicPath: true },
      createdAt: "2026-06-06T12:00:00.000Z",
    },
    {
      eventType: "analytics",
      eventName: "page_view",
      sessionId: "session-1",
      path: "/associations",
      metadata: { isPublicPath: false },
      associationId: "association-1",
      showId: "show-1",
      createdAt: "2026-06-06T12:05:00.000Z",
    },
    {
      eventType: "analytics",
      eventName: "page_view",
      sessionId: "session-2",
      path: "/associations/association-1/scribe/classes/class-1",
      metadata: { pageCategory: "scribe_class", isPublicPath: false },
      associationId: "association-1",
      classId: "class-1",
      createdAt: "2026-06-06T12:10:00.000Z",
    },
    {
      eventType: "audit",
      eventName: "auth_signup_attempt",
      createdAt: "2026-06-06T12:15:00.000Z",
    },
  ]);

  expect(summary.pageViewCount).toBe(3);
  expect(summary.publicPageViewCount).toBe(1);
  expect(summary.managementPageViewCount).toBe(1);
  expect(summary.scribePageViewCount).toBe(1);
  expect(summary.uniqueVisitorCount).toBe(2);
  expect(summary.publicVisitorCount).toBe(1);
  expect(summary.accountEventCount).toBe(1);
  expect(summary.topPages[0]).toEqual({ label: "/associations", count: 1 });
  expect(summary.topAssociations[0]).toEqual({
    label: "association-1",
    count: 2,
  });
  expect(summary.topShows[0]).toEqual({ label: "show-1", count: 1 });
  expect(summary.topClasses[0]).toEqual({ label: "class-1", count: 1 });
  expect(summary.latestEventAt).toBe("2026-06-06T12:15:00.000Z");
});

test("announcer latest score ignores public publication restrictions", () => {
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

  expect(buildAnnouncerClassView(classData).latestScore.scoreTotal).toBe("72");

  expect(
    buildAnnouncerClassView({
      ...classData,
      publication: {
        status: PUBLICATION_STATUSES.LIVE_SCORING,
      },
    }).latestScore.scoreTotal
  ).toBe("72");

  expect(
    buildAnnouncerClassView({
      ...classData,
      publication: {
        status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
      },
    }).latestScore.scoreTotal
  ).toBe("72");
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
      {
        id: "run-4",
        draw: 4,
        backNumber: "404",
        rider: "Rider 4",
        scoreTotal: "",
        scores: [],
        penalties: [],
      },
    ],
  };

  const classView = buildAnnouncerClassView(classData);

  expect(classView.activeRun.draw).toBe(2);
  expect(classView.nextRun.draw).toBe(3);
  expect(classView.secondNextRun.draw).toBe(4);
  expect(classView.latestScore.draw).toBe(1);
  expect(classView.orderRuns.map((run) => run.liveOrderStatus)).toEqual([
    "passed",
    "active",
    "preparation",
    "waiting",
  ]);
  expect(classView.passedRuns.map((run) => run.draw)).toEqual([1]);
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
  expect(fourthRunActiveView.latestScore.scoreTotal).toBe("70½");
  expect(fourthRunActiveView.lastPassedRuns[0].scoreTotal).toBe("70½");
  expect(fourthRunActiveView.lastPassedRuns[0].manoeuvres[1]).toMatchObject({
    score: "+½",
    penalty: "2",
  });
});

test("announcer live view reads multi-judge sessions", () => {
  const scores = getPatternHeaders("1").map(() => "0");
  saveActiveManoeuvre("class-announcer-multi", {
    draw: 1,
    manoeuvreIndex: 0,
  });
  const classView = buildAnnouncerClassView({
    classItem: {
      id: "class-announcer-multi",
      name: "Open",
      pattern: "1",
    },
    setup: {
      pattern: "1",
      judges: [
        { id: "judge-1", name: "Judge A", order: 1 },
        { id: "judge-2", name: "Judge B", order: 2 },
        { id: "judge-3", name: "Judge C", order: 3 },
      ],
      runs: [
        { id: "run-1", draw: 1, backNumber: "101", rider: "Rider 1" },
        { id: "run-2", draw: 2, backNumber: "202", rider: "Rider 2" },
      ],
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_SCORING,
    },
    scoringRuns: [],
    judgeSessions: [
      {
        judgeId: "judge-1",
        activeManoeuvre: { draw: 2 },
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            scores,
            penalties: [],
            scoreTotal: "70.0",
          },
        ],
      },
      {
        judgeId: "judge-2",
        activeManoeuvre: { draw: 2 },
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            scores,
            penalties: [],
            scoreTotal: "71.0",
          },
        ],
      },
      {
        judgeId: "judge-3",
        activeManoeuvre: { draw: 2 },
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            scores,
            penalties: [],
            scoreTotal: "72.0",
          },
        ],
      },
    ],
  });

  expect(classView.activeRun.draw).toBe(2);
  expect(classView.latestScore.scoreTotal).toBe("213");
  expect(classView.latestScore.judgeScores).toEqual([
    { judgeId: "judge-1", judgeName: "Judge A", scoreTotal: "70" },
    { judgeId: "judge-2", judgeName: "Judge B", scoreTotal: "71" },
    { judgeId: "judge-3", judgeName: "Judge C", scoreTotal: "72" },
  ]);
  expect(classView.orderRuns.map((run) => run.liveOrderStatus)).toEqual([
    "passed",
    "active",
  ]);
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

  const filteredSummary = calculateClassTimingSummary({
    runs: [
      {
        backNumber: "201",
        scores: ["0"],
        penalties: [""],
        durationSeconds: 59,
      },
      {
        backNumber: "202",
        scores: ["0"],
        penalties: [""],
        durationSeconds: 60,
      },
      {
        backNumber: "203",
        scores: ["0"],
        penalties: [""],
        durationSeconds: 541,
      },
    ],
    maneuverCount: 1,
  });

  expect(filteredSummary.averageRunSeconds).toBe(60);
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
    timedRunCount: 2,
    averageRunSeconds: 150,
    medianRunSeconds: 150,
  });
  expect(timingRow.remainingRuns).toBe(2);
  expect(timingRow.remainingDragBreaks).toBe(1);
  expect(timingRow.remainingSeconds).toBe(720);

  expect(
    calculateClassTimeSimulation({
      participantCount: 10,
      averageRunSeconds: stats[0].averageRunSeconds,
      dragInterval: 4,
      dragDurationMinutes: 8,
    })
  ).toMatchObject({
    dragBreaks: 2,
    totalSeconds: 2460,
  });
});

test("normalizes planned class start details", () => {
  expect(
    normalizeClassScheduleDetails({
      startMode: CLASS_START_MODE_FIXED,
      startTime: "08:30",
    })
  ).toMatchObject({
    startMode: CLASS_START_MODE_FIXED,
    startTime: "08:30",
  });

  expect(
    normalizeClassScheduleDetails({
      start_mode: CLASS_START_MODE_FIXED,
      start_time: "25:99",
    })
  ).toMatchObject({
    startMode: CLASS_START_MODE_FIXED,
    startTime: "",
  });

  expect(normalizeClassScheduleDetails({ startMode: "later" })).toMatchObject({
    startMode: CLASS_START_MODE_AFTER_PREVIOUS,
    startTime: "",
  });

  expect(
    normalizeClassScheduleDetails({
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "07:45",
      startMode: CLASS_START_MODE_AFTER_PREVIOUS,
    })
  ).toMatchObject({
    startMode: CLASS_START_MODE_FIXED,
    startTime: "07:45",
  });
});

test("builds a day schedule from fixed and follow-up block starts", () => {
  const rows = buildDayScheduleRows(
    [
      {
        classId: "block-a",
        className: "Open",
        dayDate: "2026-06-15",
        scheduleStartMode: CLASS_START_MODE_FIXED,
        scheduleStartTime: "08:00",
        remainingRuns: 10,
        remainingSeconds: 30 * 60,
      },
      {
        classId: "block-b",
        className: "Rookie",
        dayDate: "2026-06-15",
        scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
        remainingRuns: 5,
        remainingSeconds: 15 * 60,
      },
      {
        classId: "block-c",
        className: "Youth",
        dayDate: "2026-06-15",
        scheduleStartMode: CLASS_START_MODE_FIXED,
        scheduleStartTime: "09:00",
        remainingRuns: 4,
        remainingSeconds: 10 * 60,
      },
    ],
    {
      day: { date: "2026-06-15" },
      now: new Date("2026-06-15T07:30:00"),
    }
  );
  const summary = buildDayScheduleSummary(
    rows,
    new Date("2026-06-15T07:30:00")
  );

  expect(new Date(rows[0].estimatedStartAt).getHours()).toBe(8);
  expect(Date.parse(rows[0].estimatedEndAt) - Date.parse(rows[0].estimatedStartAt))
    .toBe(30 * 60 * 1000);
  expect(Date.parse(rows[1].estimatedStartAt)).toBe(
    Date.parse(rows[0].estimatedEndAt)
  );
  expect(new Date(rows[2].estimatedStartAt).getHours()).toBe(9);
  expect(summary.estimatedEndAt).toBe(rows[2].estimatedEndAt);
});

test("builds show schedule rows for paid warmups", () => {
  const sections = buildShowScheduleSections({
    daySections: [
      {
        day: { id: "day-1", label: "Jour 1", date: "2026-06-15" },
        classRows: [],
        paidWarmups: [
          {
            id: "warmup-1",
            name: "Paid warm up",
            scheduleStartMode: CLASS_START_MODE_FIXED,
            scheduleStartTime: "08:00",
            durationMinutesPerRider: 5,
            dragDurationMinutes: 8,
            entries: [
              { id: "entry-1", rider: "A" },
              { id: "entry-2", rider: "B" },
            ],
            sortOrder: 1,
          },
        ],
      },
    ],
    now: new Date("2026-06-15T07:30:00"),
  });
  const [row] = sections[0].rows;

  expect(row.itemType).toBe(SHOW_SCHEDULE_ITEM_TYPES.PAID_WARMUP);
  expect(new Date(row.estimatedStartAt).getHours()).toBe(8);
  expect(Date.parse(row.estimatedEndAt) - Date.parse(row.estimatedStartAt)).toBe(
    10 * 60 * 1000
  );
});

test("calculates remaining paid warmup schedule time", () => {
  const summary = calculatePaidWarmupScheduleSummary(
    {
      durationMinutesPerRider: 5,
      dragInterval: 2,
      dragDurationMinutes: 8,
      entries: [
        { id: "entry-1", status: "done" },
        { id: "entry-2", status: "pending" },
        { id: "entry-3", status: "pending" },
      ],
    },
    new Date("2026-06-15T08:00:00")
  );

  expect(summary).toMatchObject({
    completedRuns: 1,
    remainingRuns: 2,
    remainingDragBreaks: 1,
    remainingSeconds: 18 * 60,
  });
});
