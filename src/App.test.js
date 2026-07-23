import {
  appendPenaltyToken,
  formatPenaltyValue,
  formatScoreValue,
  isScoredRunComplete,
  parseScoreValue,
  recalculateRun,
  removeLastPenaltyToken,
  runHasVideoReview,
} from "./utils/scoring";
import {
  parseImportedDraw,
  parseImportedRuns,
  parsePositionedPdfPages,
} from "./features/classes/classSetupImport";
import {
  deleteAssociationRepository,
  isDeleteAssociationRpcMissing,
} from "./features/associations/associationRepository";
import { filterAssociationsBySearch } from "./features/associations/associationSearch";
import {
  loadAssociations,
  saveAssociations,
} from "./features/associations/associationsData";
import { normalizeAssociationWebsiteUrl } from "./features/associations/associationProfile";
import {
  buildSponsorLevelSlides,
  getAssociationSponsorGroups,
  normalizeSponsorGroups,
  serializeSponsorGroups,
} from "./features/associations/sponsorLogos";
import {
  detectBrowserLanguage,
  getInitialLanguage,
  normalizeLanguage,
  translate,
} from "./features/i18n/i18n";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "./utils/generateScorePdf";
import {
  buildAssociationPublicSeo,
  buildChampionshipPublicSeo,
  buildShowPublicSeo,
} from "./features/seo/publicSeo";
import {
  buildLivestreamEmbed,
  hasPublicLivestream,
} from "./features/livestream/livestreamEmbed";
import {
  getCurrentPublicLivestream,
  getDateValueInTimeZone,
  normalizeLivestreamUrlsByDate,
} from "./features/livestream/livestreamSchedule";
import {
  LIVE_DATA_SOURCES,
  LIVE_DISPLAY_MODES,
  normalizeLiveDataSource,
  normalizeLiveDisplayMode,
  resolveLiveScoringSession,
} from "./features/live/liveDataSource";
import { markLiveDragCompleted } from "./features/live/liveQueueItems";
import {
  ANNOUNCER_RUN_STATUSES,
  buildAnnouncerJudgeScoreResult,
  buildInitialAnnouncerLiveSession,
  completeAnnouncerLiveSession,
  getAnnouncerLiveActivationStatus,
  getPendingAnnouncerReviews,
  saveAnnouncerRunResult,
  saveAnnouncerRunResultAndAdvance,
  startAnnouncerDrag,
  startAnnouncerRun,
  stopAnnouncerDrag,
  stopAnnouncerDragAndAdvance,
} from "./features/live/announcerLiveSession";
import {
  getPublicationState,
  publishClass,
  PUBLICATION_STATUSES,
  savePublicationState,
  unpublishClass,
} from "./features/publication/publicationRepository";
import {
  advanceArenaLiveClassAfterCompletionRepository,
  advanceArenaLivePaidWarmupAfterCompletionRepository,
  saveArenaCurrentLiveClassRepository,
} from "./features/publication/publicationCloudRepository";
import { buildClassWithSetupScheduleStart } from "./features/classes/classRepository";
import { normalizeClassSetup } from "./features/classes/classSetupStorage";
import { mergeImportedRunsWithExistingIds } from "./features/classes/runIdentity";
import { isClassScoringFinalized } from "./features/classes/classStatusSelectors";
import { shouldFitScoringTableToViewport } from "./features/scoring/scoringTableViewport";
import {
  getUniqueScoringClasses,
  resolveClassScoringId,
} from "./features/classes/classScoringGroups";
import {
  buildClassSetupFromHspDraw,
  normalizeHspDrawImport,
} from "./features/classes/hspDrawImport";
import {
  applySetupRunScratchPenalty,
  buildSetupRunScoringPenalties,
} from "./features/scoring/setupRunScoring";
import {
  getSpecialPenaltyReasons,
  isSpecialPenaltyReasonRequired,
  normalizeSpecialPenaltyReasonNote,
  removeSpecialPenaltyReasonNote,
  upsertSpecialPenaltyReasonNote,
} from "./features/scoring/specialPenaltyReasons";
import {
  buildScoringDataLossWarning,
  countRunsWithScoringData,
} from "./features/scoring/scoringDataIntegrity";
import {
  SET_APPROVAL_MODES,
  areAllRunsApproved,
  buildSetApproval,
  getLockedRunKeys,
  getNextSetRange,
  getPendingVideoReviewRunsForSet,
  normalizeSetApprovalMode,
} from "./features/scoring/setApprovals";
import {
  TEST_DRAG_INTERVAL,
  TEST_DRAW_RUN_COUNT,
  buildCompletedScoringTestRun,
  buildScoringTestDraw,
  getScoringTestFillRange,
  isScoringTestAssociation,
} from "./features/scoring/scoringTestMode";
import { canOpenClassForScribe } from "./pages/association/ShowScribePage";
import { buildTvUpcomingCards } from "./pages/public/PublicShowTvPage";
import {
  buildTvDisplayVideoPath,
  formatTvDisplayVideoSize,
  getTvDisplayUploadAccessToken,
  TV_DISPLAY_VIDEO_MAX_BYTES,
  validateTvDisplayVideoFile,
} from "./features/tvDisplay/tvDisplayVideo";
import { buildHspScoredRunRows } from "./features/integrations/hspScoredRunRepository";
import {
  buildPublicClassView,
  buildPublicLiveClassView,
  getPublicShowView,
  sortPublicResults,
} from "./features/publication/publicViewRepository";
import {
  buildClassResultGroups,
  hasCompletedAnnouncerResults,
  isAnnouncerResultsApproval,
  isClassResultsSecretariatApproved,
  normalizeResultGroups,
} from "./features/results/classResults";
import { buildLiveClassStandings } from "./features/results/liveClassStandings";
import {
  buildQualifiedRiderKey,
  buildQualifiedRiderList,
} from "./features/results/qualifiedRiders";
import {
  getClassResultPublication,
  publishClassResultsRepository,
  RESULT_PUBLICATION_STATUSES,
} from "./features/results/resultPublicationRepository";
import {
  validateAnnouncerResultsRepository,
  validateOfficialResultRepository,
} from "./features/classes/officialResultRepository";
import { buildAnnouncerClassView } from "./features/live/liveViewRepository";
import {
  PAID_WARMUP_TIMER_CUES,
  buildPaidWarmupLiveView,
  getPaidWarmupTimerCueType,
  setPaidWarmupEntryStatus,
  startPaidWarmupDrag,
  stopPaidWarmupDrag,
} from "./features/paidWarmups/paidWarmupLive";
import {
  calculatePaidWarmupScheduleSummary,
  getPaidWarmupById,
  insertPaidWarmupEntryAfter,
  mergePaidWarmupEntriesForReplacement,
  movePaidWarmupEntry,
  normalizePaidWarmup,
  savePaidWarmup,
} from "./features/paidWarmups/paidWarmupStorage";
import {
  buildPaidWarmupMergeResult,
  mergePaidWarmupsForDay,
} from "./features/paidWarmups/paidWarmupRepository";
import {
  SHOW_SCHEDULE_ITEM_TYPES,
  buildShowSchedulePreviewSections,
  buildShowScheduleSections,
} from "./features/schedule/showSchedule";
import { buildLiveScheduleItems } from "./features/schedule/liveSchedule";
import { saveDays } from "./features/days/dayStorage";
import { saveClasses } from "./features/classes/classStorage";
import { saveShows } from "./features/shows/showStorage";
import {
  ASSOCIATION_ROLES,
  canAdminAssociation,
  canEditImportedDrawAssociation,
  canEditManualDrawAssociation,
  canManageAssociation,
  canScoreAssociation,
} from "./features/auth/accessRoles";
import {
  buildRoleEntryPath,
  getRoleEntryAssociationIds,
  normalizeRoleEntryKey,
} from "./features/auth/roleEntryRouting";
import {
  buildAssociationInvitationEmail,
  buildAssociationInvitationUrl,
} from "./features/auth/invitationLinks";
import { calculateChampionshipPoints } from "./features/championship/championshipPoints";
import { getChampionshipClassByCode } from "./features/championship/championshipClasses";
import { buildAssociationChampionshipClassSummary } from "./features/championship/associationClassDictionary";
import {
  CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH,
  hasChampionshipRules,
  normalizeChampionshipRules,
} from "./features/championship/championshipRules";
import {
  buildShowScoreChampionshipImportBatch,
  buildShowScoreChampionshipImportPreview,
} from "./features/championship/showScoreChampionshipImport";
import {
  applyChampionshipEventLabels,
  buildChampionshipDatasetFromCsv,
  buildChampionshipDatasetFromImports,
  buildChampionshipImportBatchFromCsv,
  buildChampionshipFunFacts,
  ensureChampionshipOccurrenceResults,
  getChampionshipIncludedShows,
} from "./features/championship/championshipStandings";
import {
  buildChampionshipPdfFileName,
  buildChampionshipPdfTableOfContents,
  buildChampionshipPdfTableOfContentsColumns,
  generateChampionshipPdf,
} from "./utils/generateChampionshipPdf";
import {
  buildChampionshipVerificationPayload,
  CHAMPIONSHIP_VERIFICATION_SCOPES,
  validateChampionshipVerificationForm,
} from "./features/championship/championshipVerificationRequestRepository";
import {
  buildDefaultChampionshipUpdateCampaignForm,
  validateChampionshipUpdateCampaignForm,
  validateChampionshipUpdateSubscriptionForm,
} from "./features/championship/championshipUpdateSubscriptionRepository";
import { getDefaultShowRouteForRoles } from "./features/auth/showRoleRouting";
import { buildAnalyticsSummary } from "./features/analytics/analyticsRepository";
import { getPageEventContext } from "./features/analytics/analyticsRouteContext";
import {
  enrichAnalyticsEventLabels,
  resolveAnalyticsLabel,
} from "./features/analytics/analyticsEventLabels";
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
  compareScheduleItemsByStart,
  normalizeClassScheduleDetails,
} from "./features/classes/classSchedule";
import { getClassesByDayId } from "./features/classes/classSelectors";
import {
  isCustomPatternReady,
  normalizeCustomPattern,
  getPatternDisplayName,
  getPatternHeaders,
  getPatternManeuverDescription,
  NO_PATTERN_ID,
  SLIDING_CONTEST_PATTERN_ID,
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

function saveActiveTestShow(showId, associationId = "association-test") {
  saveShows([
    {
      id: showId,
      associationId,
      name: showId,
      status: "active",
      isSchedulePublic: true,
      isLivestreamPublic: false,
    },
  ]);
}

test("keeps scoring locked when finalized state comes from official data", () => {
  expect(
    isClassScoringFinalized({
      classItem: { id: "class-locked" },
      setup: { finalized: false, judgeSignedAt: null },
      official: {
        isFinalized: true,
        judgeSignedAt: "2026-07-13T16:00:00.000Z",
      },
    })
  ).toBe(true);

  expect(
    isClassScoringFinalized({
      classItem: { id: "class-open" },
      setup: {},
      official: {},
    })
  ).toBe(false);
});

test("fits the scoring table to common iPad landscape viewports", () => {
  expect(
    shouldFitScoringTableToViewport({ width: 1024, height: 768 })
  ).toBe(true);
  expect(
    shouldFitScoringTableToViewport({ width: 1180, height: 820 })
  ).toBe(true);
  expect(
    shouldFitScoringTableToViewport({ width: 820, height: 1180 })
  ).toBe(false);
  expect(
    shouldFitScoringTableToViewport({ width: 1440, height: 900 })
  ).toBe(false);
});

test("groups sponsor slides by named level without mixing categories", () => {
  const groups = normalizeSponsorGroups([
    {
      id: "silver",
      name: "Argent",
      logos: [1, 2, 3].map((number) => ({
        id: `silver-${number}`,
        name: `Silver ${number}`,
        logoDataUrl: `data:image/png;base64,silver${number}`,
      })),
    },
    {
      id: "bronze",
      name: "Bronze",
      logos: [
        {
          id: "bronze-1",
          name: "Bronze 1",
          logoDataUrl: "data:image/png;base64,bronze1",
        },
      ],
    },
  ]);
  const stored = serializeSponsorGroups(groups);
  const slides = buildSponsorLevelSlides(stored, 2);

  expect(stored.version).toBe(2);
  expect(slides.map((slide) => slide.groupName)).toEqual([
    "Argent",
    "Argent",
    "Bronze",
  ]);
  expect(slides.map((slide) => slide.sponsors.map((logo) => logo.id))).toEqual([
    ["silver-1", "silver-2"],
    ["silver-3"],
    ["bronze-1"],
  ]);
});

test("keeps legacy sponsor logos when the grouped list is empty", () => {
  const sponsorGroups = getAssociationSponsorGroups({
    sponsorGroups: [],
    sponsorLogos: [
      {
        id: "legacy-sponsor",
        name: "Legacy sponsor",
        logoDataUrl: "data:image/png;base64,legacy",
      },
    ],
  });

  expect(sponsorGroups).toHaveLength(1);
  expect(sponsorGroups[0].logos).toEqual([
    expect.objectContaining({
      id: "legacy-sponsor",
      name: "Legacy sponsor",
    }),
  ]);
});

test("validates high-quality MP4 files for the arena display", () => {
  const validVideo = {
    name: "competition-1080p.mp4",
    type: "video/mp4",
    size: 1024 * 1024 * 1024,
  };

  expect(validateTvDisplayVideoFile(validVideo)).toBe(validVideo);
  expect(formatTvDisplayVideoSize(validVideo.size)).toBe("1.0 Go");
  expect(
    buildTvDisplayVideoPath({
      associationId: "association-1",
      showId: "show-1",
      file: validVideo,
    })
  ).toBe(
    buildTvDisplayVideoPath({
      associationId: "association-1",
      showId: "show-1",
      file: validVideo,
    })
  );
  expect(() =>
    validateTvDisplayVideoFile({
      ...validVideo,
      name: "competition.mov",
      type: "video/quicktime",
    })
  ).toThrow(/MP4/);
  expect(() =>
    validateTvDisplayVideoFile({
      ...validVideo,
      size: TV_DISPLAY_VIDEO_MAX_BYTES + 1,
    })
  ).toThrow(/2 Go/);
});

test("reuses the current Supabase session for a TV video upload", async () => {
  let refreshCalls = 0;
  const supabase = {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "current-token" } },
        error: null,
      }),
      refreshSession: async () => {
        refreshCalls += 1;
        return { data: { session: null }, error: null };
      },
    },
  };

  await expect(getTvDisplayUploadAccessToken(supabase)).resolves.toBe(
    "current-token"
  );
  expect(refreshCalls).toBe(0);
});

test("refreshes an expired Supabase session before a TV video upload", async () => {
  const supabase = {
    auth: {
      getSession: async () => ({
        data: { session: null },
        error: null,
      }),
      refreshSession: async () => ({
        data: { session: { access_token: "refreshed-token" } },
        error: null,
      }),
    },
  };

  await expect(getTvDisplayUploadAccessToken(supabase)).resolves.toBe(
    "refreshed-token"
  );
});

test("TV upcoming cards replace empty participant slots with the next class", () => {
  const pendingRun = {
    type: "run",
    fr: "Cavalier suivant",
    meta: "#12 · Back 112",
  };
  const nextClass = {
    itemId: "class-next",
    name: "Novice Horse",
    arena: "101",
    isPaidWarmup: false,
  };

  const lastParticipantCards = buildTvUpcomingCards(
    [pendingRun, null],
    nextClass
  );
  expect(lastParticipantCards).toHaveLength(2);
  expect(lastParticipantCards[0].participant).toBe(pendingRun);
  expect(lastParticipantCards[1]).toMatchObject({
    labelFr: "Prochaine classe",
    labelEn: "Next class",
    participant: {
      type: "schedule",
      fr: "Novice Horse",
    },
  });

  const nextClassOnlyCards = buildTvUpcomingCards([null, null], nextClass);
  expect(nextClassOnlyCards).toHaveLength(1);
  expect(nextClassOnlyCards[0].participant.fr).toBe("Novice Horse");

  expect(buildTvUpcomingCards([null, null], null)).toEqual([]);
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

test("calculates championship tie points without rounding to half points", () => {
  expect(calculateChampionshipPoints(10, 10, 3)).toBeCloseTo(1 / 3, 8);
});

test("selects one live data source for every live consumer", () => {
  expect(normalizeLiveDataSource("unknown")).toBe(LIVE_DATA_SOURCES.SCRIBE);
  expect(normalizeLiveDataSource("announcer")).toBe(
    LIVE_DATA_SOURCES.ANNOUNCER
  );

  const resolved = resolveLiveScoringSession({
    setup: { liveDataSource: "announcer" },
    scoringSession: { classId: "block-1", runs: [{ id: "scribe-run" }] },
    announcerSession: {
      classId: "block-1",
      runs: [{ id: "announcer-run" }],
      activeManoeuvre: { draw: 2 },
      updatedAt: "2026-07-20T12:00:00.000Z",
    },
  });

  expect(resolved.source).toBe(LIVE_DATA_SOURCES.ANNOUNCER);
  expect(resolved.session.runs).toEqual([{ id: "announcer-run" }]);
  expect(resolved.session.activeManoeuvre).toEqual({ draw: 2 });
});

test("keeps only the on-course order in emergency minimal display", () => {
  expect(normalizeLiveDisplayMode("unknown")).toBe(LIVE_DISPLAY_MODES.FULL);
  expect(normalizeLiveDisplayMode("order_only")).toBe(
    LIVE_DISPLAY_MODES.ORDER_ONLY
  );

  const classView = buildPublicLiveClassView({
    classItem: {
      id: "block-minimal",
      name: "Open",
      pattern: "2",
    },
    setup: {
      liveDisplayMode: LIVE_DISPLAY_MODES.ORDER_ONLY,
      runs: [
        {
          id: "run-1",
          draw: 1,
          backNumber: "101",
          rider: "Alice Roy",
          horse: "Secret Horse",
          owner: "Secret Owner",
        },
      ],
    },
    publication: { status: PUBLICATION_STATUSES.LIVE },
    scoringSession: {
      activeManoeuvre: { type: "run", draw: 1 },
      runs: [
        {
          id: "run-1",
          draw: 1,
          backNumber: "101",
          rider: "Alice Roy",
          horse: "Secret Horse",
          owner: "Secret Owner",
          scoreTotal: "72",
          isActive: true,
        },
      ],
    },
  });

  expect(classView.liveDisplayMode).toBe(LIVE_DISPLAY_MODES.ORDER_ONLY);
  expect(classView.showScores).toBe(false);
  expect(classView.classStandings).toEqual([]);
  expect(classView.activeRun).toMatchObject({
    draw: 1,
    identityHidden: true,
    rider: "",
    horse: "",
    owner: "",
    backNumber: "",
    scoreTotal: "",
  });
});

test("uses the announcer score across internal and public live views", () => {
  const setupRun = {
    id: "run-1",
    draw: 1,
    rider: "Alice Roy",
    horse: "Example Horse",
    classCodes: ["OPEN"],
  };
  const scoringSession = {
    classId: "block-1",
    runs: [{ ...setupRun, scoreTotal: "70", completedAt: "2026-07-20T12:00:00Z" }],
  };
  const announcerSession = {
    classId: "block-1",
    runs: [
      {
        ...setupRun,
        status: ANNOUNCER_RUN_STATUSES.SCORED,
        scoreTotal: "66",
        isComplete: true,
        completedAt: "2026-07-20T12:01:00Z",
      },
    ],
    startedAt: "2026-07-20T11:59:00Z",
  };
  const setup = {
    pattern: "2",
    liveDataSource: LIVE_DATA_SOURCES.ANNOUNCER,
    runs: [setupRun],
    blockClasses: [{ code: "OPEN", name: "Open" }],
  };

  const announcerView = buildAnnouncerClassView({
    classItem: { id: "block-1", name: "Open", pattern: "2" },
    setup,
    scoringSession,
    scoringRuns: scoringSession.runs,
    announcerSession,
    publication: { status: PUBLICATION_STATUSES.LIVE },
  });
  const publicView = buildPublicLiveClassView({
    classItem: { id: "block-1", name: "Open", pattern: "2" },
    setup,
    scoringSession,
    announcerSession,
    publication: { status: PUBLICATION_STATUSES.LIVE },
  });

  expect(announcerView.latestScore.scoreTotal).toBe("66");
  expect(publicView.latestScore.scoreTotal).toBe("66");
  expect(publicView.liveDataSource).toBe(LIVE_DATA_SOURCES.ANNOUNCER);
});

test("runs the announcer fallback without overwriting the scribe snapshot", () => {
  const setupRuns = [
    { id: "run-1", draw: 1, rider: "Alice", classCodes: ["100"] },
    { id: "run-2", draw: 2, rider: "Bob", classCodes: ["100"] },
    { id: "run-3", draw: 3, rider: "Chloé", classCodes: ["200"] },
  ];
  const initial = buildInitialAnnouncerLiveSession({
    classId: "block-1",
    setupRuns,
    scoringRuns: [
      {
        ...setupRuns[0],
        scoreTotal: "70",
        completedAt: "2026-07-20T12:00:00.000Z",
      },
    ],
    now: new Date("2026-07-20T12:05:00.000Z"),
  });

  expect(initial.runs[0]).toMatchObject({
    status: ANNOUNCER_RUN_STATUSES.SCORED,
    scoreTotal: "70",
    resultSource: "scribe_snapshot",
  });

  const started = startAnnouncerRun(
    initial,
    "run-2",
    new Date("2026-07-20T12:06:00.000Z")
  );
  expect(started.activeManoeuvre).toMatchObject({
    runId: "run-2",
    draw: 2,
  });
  const resolvedLegacyActivePointer = saveAnnouncerRunResult(
    {
      ...started,
      activeManoeuvre: { draw: 2, manoeuvreIndex: 0 },
    },
    "run-2",
    { status: ANNOUNCER_RUN_STATUSES.SCORED, scoreTotal: "69" },
    { now: new Date("2026-07-20T12:06:30.000Z") }
  );
  expect(resolvedLegacyActivePointer.activeManoeuvre).toBeNull();

  const dragging = startAnnouncerDrag(initial, {
    id: "drag-after-run-1",
    afterIndex: 0,
    afterDraw: 1,
    durationMinutes: 8,
  });
  expect(dragging.activeManoeuvre).toMatchObject({
    type: "drag",
    afterDraw: 1,
    durationMinutes: 8,
  });
  const dragStopped = stopAnnouncerDrag(
    dragging,
    new Date("2026-07-20T12:07:00.000Z")
  );
  expect(dragStopped.activeManoeuvre).toBeNull();
  expect(dragStopped.runs[0].dragCompletedAt).toBe(
    "2026-07-20T12:07:00.000Z"
  );

  const underReview = saveAnnouncerRunResult(
    started,
    "run-2",
    { status: ANNOUNCER_RUN_STATUSES.REVIEW },
    { now: new Date("2026-07-20T12:08:00.000Z"), updatedBy: "announcer-1" }
  );
  expect(getPendingAnnouncerReviews(underReview)).toHaveLength(1);
  expect(completeAnnouncerLiveSession(underReview).ok).toBe(false);

  const resolved = saveAnnouncerRunResult(
    underReview,
    "run-2",
    { status: ANNOUNCER_RUN_STATUSES.SCORED, scoreTotal: "66" },
    { now: new Date("2026-07-20T12:10:00.000Z"), updatedBy: "announcer-1" }
  );
  const scratched = saveAnnouncerRunResult(
    resolved,
    "run-3",
    { status: ANNOUNCER_RUN_STATUSES.SCRATCH },
    { now: new Date("2026-07-20T12:11:00.000Z"), updatedBy: "announcer-1" }
  );
  const completed = completeAnnouncerLiveSession(scratched, {
    now: new Date("2026-07-20T12:12:00.000Z"),
    completedBy: "announcer-1",
  });

  expect(completed.ok).toBe(true);
  expect(completed.session.completedAt).toBe("2026-07-20T12:12:00.000Z");
  expect(completed.session.runs[0].resultSource).toBe("scribe_snapshot");
  expect(completed.session.runs[1].history).toHaveLength(2);
});

test("advances the announcer live automatically after a result but waits for drags", () => {
  const setupRuns = [
    { id: "auto-run-1", draw: 1, rider: "Alice" },
    { id: "auto-run-2", draw: 2, rider: "Bob" },
    { id: "auto-run-3", draw: 3, rider: "Chloé" },
  ];
  const initial = buildInitialAnnouncerLiveSession({
    classId: "auto-class",
    setupRuns,
    now: new Date("2026-07-20T12:00:00.000Z"),
  });
  const started = startAnnouncerRun(
    initial,
    "auto-run-1",
    new Date("2026-07-20T12:01:00.000Z")
  );
  const advanced = saveAnnouncerRunResultAndAdvance(
    started,
    "auto-run-1",
    { status: ANNOUNCER_RUN_STATUSES.SCORED, scoreTotal: "70" },
    {
      nextRunId: "auto-run-2",
      now: new Date("2026-07-20T12:03:00.000Z"),
    }
  );

  expect(advanced.runs[0]).toMatchObject({
    status: ANNOUNCER_RUN_STATUSES.SCORED,
    scoreTotal: "70",
  });
  expect(advanced.runs[1].status).toBe(ANNOUNCER_RUN_STATUSES.ON_COURSE);
  expect(advanced.activeManoeuvre).toMatchObject({
    type: "run",
    runId: "auto-run-2",
    draw: 2,
  });

  const waitingForDrag = saveAnnouncerRunResultAndAdvance(
    started,
    "auto-run-1",
    { status: ANNOUNCER_RUN_STATUSES.SCORED, scoreTotal: "70" },
    {
      nextRunId: "auto-run-2",
      waitForDrag: true,
      now: new Date("2026-07-20T12:03:00.000Z"),
    }
  );

  expect(waitingForDrag.activeManoeuvre).toBeNull();
  expect(waitingForDrag.runs[1].status).toBe(
    ANNOUNCER_RUN_STATUSES.PENDING
  );

  const dragging = startAnnouncerDrag(
    waitingForDrag,
    { id: "drag-after-auto-run-1", afterIndex: 0, afterDraw: 1 },
    new Date("2026-07-20T12:04:00.000Z")
  );
  const afterDrag = stopAnnouncerDragAndAdvance(
    dragging,
    "auto-run-2",
    new Date("2026-07-20T12:12:00.000Z")
  );

  expect(afterDrag.runs[0].dragCompletedAt).toBe(
    "2026-07-20T12:12:00.000Z"
  );
  expect(afterDrag.activeManoeuvre).toMatchObject({
    type: "run",
    runId: "auto-run-2",
  });

  const corrected = saveAnnouncerRunResultAndAdvance(
    advanced,
    "auto-run-1",
    { status: ANNOUNCER_RUN_STATUSES.SCORED, scoreTotal: "71" },
    {
      nextRunId: "auto-run-3",
      now: new Date("2026-07-20T12:13:00.000Z"),
    }
  );

  expect(corrected.activeManoeuvre).toMatchObject({
    runId: "auto-run-2",
  });
  expect(corrected.runs[2].status).toBe(ANNOUNCER_RUN_STATUSES.PENDING);
});

test("records an announcer no score as NS and completes the run", () => {
  const initial = buildInitialAnnouncerLiveSession({
    classId: "no-score-class",
    setupRuns: [{ id: "no-score-run", draw: 1, rider: "Alice" }],
    now: new Date("2026-07-20T13:00:00.000Z"),
  });
  const started = startAnnouncerRun(
    initial,
    "no-score-run",
    new Date("2026-07-20T13:01:00.000Z")
  );
  const noScore = saveAnnouncerRunResultAndAdvance(
    started,
    "no-score-run",
    { status: ANNOUNCER_RUN_STATUSES.NO_SCORE },
    { now: new Date("2026-07-20T13:03:00.000Z") }
  );

  expect(noScore.runs[0]).toMatchObject({
    status: ANNOUNCER_RUN_STATUSES.NO_SCORE,
    scoreTotal: "NS",
    isComplete: true,
    completedAt: "2026-07-20T13:03:00.000Z",
  });
  expect(noScore.activeManoeuvre).toBeNull();
  expect(completeAnnouncerLiveSession(noScore).ok).toBe(true);
});

test("combines announcer scores entered per judge with the existing rules", () => {
  const judges = [
    { id: "judge-1", name: "Juge A", order: 1 },
    { id: "judge-2", name: "Juge B", order: 2 },
  ];
  const twoJudgeResult = buildAnnouncerJudgeScoreResult({
    judges,
    pattern: "2",
    judgeScores: [
      { judgeId: "judge-1", scoreTotal: "70" },
      { judgeId: "judge-2", scoreTotal: "66" },
    ],
  });

  expect(twoJudgeResult).toMatchObject({
    scoreTotal: "136",
    isComplete: true,
    isSupported: true,
  });
  expect(twoJudgeResult.judgeScores).toEqual([
    { judgeId: "judge-1", judgeName: "Juge A", scoreTotal: "70" },
    { judgeId: "judge-2", judgeName: "Juge B", scoreTotal: "66" },
  ]);

  const fiveJudgeResult = buildAnnouncerJudgeScoreResult({
    judges: [
      { id: "judge-1", name: "Juge 1" },
      { id: "judge-2", name: "Juge 2" },
      { id: "judge-3", name: "Juge 3" },
      { id: "judge-4", name: "Juge 4" },
      { id: "judge-5", name: "Juge 5" },
    ],
    pattern: "2",
    judgeScores: ["68", "69", "70", "71", "72"].map(
      (scoreTotal, index) => ({
        judgeId: `judge-${index + 1}`,
        scoreTotal,
      })
    ),
  });

  expect(fiveJudgeResult.scoreTotal).toBe("210");
  expect(fiveJudgeResult.isComplete).toBe(true);
});

test("stores announcer judge scores and activates only the planned public live", () => {
  const session = buildInitialAnnouncerLiveSession({
    classId: "block-multi",
    setupRuns: [{ id: "run-1", draw: 1 }],
  });
  const started = startAnnouncerRun(
    session,
    "run-1",
    new Date("2026-07-20T12:00:00.000Z")
  );
  const saved = saveAnnouncerRunResult(
    started,
    "run-1",
    {
      status: ANNOUNCER_RUN_STATUSES.SCORED,
      scoreTotal: "140",
      judgeScores: [
        { judgeId: "judge-1", judgeName: "Juge A", scoreTotal: "70" },
        { judgeId: "judge-2", judgeName: "Juge B", scoreTotal: "70" },
      ],
    },
    { now: new Date("2026-07-20T12:01:00.000Z") }
  );

  expect(saved.runs[0]).toMatchObject({
    scoreTotal: "140",
    judgeScores: [
      { judgeId: "judge-1", judgeName: "Juge A", scoreTotal: "70" },
      { judgeId: "judge-2", judgeName: "Juge B", scoreTotal: "70" },
    ],
  });
  expect(
    getAnnouncerLiveActivationStatus({
      session: started,
      publicationStatus: PUBLICATION_STATUSES.HIDDEN,
      plannedLiveStatus: PUBLICATION_STATUSES.LIVE_SCORING,
    })
  ).toBe(PUBLICATION_STATUSES.LIVE_SCORING);
  expect(
    getAnnouncerLiveActivationStatus({
      session: started,
      publicationStatus: PUBLICATION_STATUSES.LIVE_SCORING,
      plannedLiveStatus: PUBLICATION_STATUSES.LIVE_SCORING,
    })
  ).toBeNull();
});

test("builds a unique classified-rider call list with cutoff ties", () => {
  const standings = [
    {
      id: "class-100",
      code: "100",
      className: "Rookie",
      entries: [
        { rank: 1, rider: "Alice Roy", riderContactId: "rider-1", scoreTotal: "72" },
        { rank: 2, rider: "Bob Roy", memberNrha: "M-2", scoreTotal: "70" },
        { rank: 3, rider: "Chloé Roy", memberNrha: "M-3", scoreTotal: "70" },
        { rank: 4, rider: "Dan Roy", scoreTotal: "68" },
      ],
    },
    {
      id: "class-200",
      code: "200",
      className: "Non Pro",
      entries: [
        {
          rank: 1,
          rider: "Alice Roy",
          riderContactId: "rider-1",
          horse: "Another Horse",
          scoreTotal: "74",
        },
        { rank: 2, rider: "Émilie Roy", scoreTotal: "71" },
      ],
    },
  ];

  const riders = buildQualifiedRiderList({
    standings,
    qualifiedRiderCount: 2,
  });

  expect(riders.map((rider) => rider.rider)).toEqual([
    "Alice Roy",
    "Bob Roy",
    "Chloé Roy",
    "Émilie Roy",
  ]);
  expect(riders[0].qualifications).toHaveLength(2);
  expect(
    buildQualifiedRiderKey({
      rider: "Alice Roy",
      riderContactId: "rider-1",
      memberNrha: "M-1",
    })
  ).toBe("contact:RIDER1");
});

test("normalizes optional championship rules for the public modal", () => {
  const rules = normalizeChampionshipRules({
    rulesStatement: "  Participation à trois shows minimum.  ",
    pointsExplanation: "10 points au premier rang.\n8 points au deuxième.",
  });

  expect(rules).toEqual({
    rulesStatement: "Participation à trois shows minimum.",
    pointsExplanation: "10 points au premier rang.\n8 points au deuxième.",
  });
  expect(hasChampionshipRules(rules)).toBe(true);
  expect(hasChampionshipRules({})).toBe(false);
  expect(normalizeChampionshipRules(null)).toEqual({
    rulesStatement: "",
    pointsExplanation: "",
  });
  expect(
    normalizeChampionshipRules({
      rulesStatement: "x".repeat(CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH + 10),
    }).rulesStatement
  ).toHaveLength(CHAMPIONSHIP_RULE_TEXT_MAX_LENGTH);
});

test("builds championship standings by technical show occurrence and team", () => {
  const csv = [
    "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
    'S1,AQR MAY SHOW 1,Débutant I / Beginner I,5399,,10,10,1,1,GOOD HORSE,,"RIDER, ALICE",,101,1,72,50',
    'S2,AQR MAY SHOW 2,Débutant I / Beginner I,5399,,10,10,1,1,GOOD HORSE,,"RIDER, ALICE",,101,2,71,25',
    'S3,AQR MAY SHOW 3,Débutant I / Beginner I,5399,,10,10,1,1,GOOD HORSE,,"RIDER, ALICE",,101,12,65,0',
    'S1,AQR MAY SHOW 1,AQR Novice Horse Open,5394,,10,10,1,1,EXCLUDED HORSE,,"RIDER, BOB",,102,1,73,70',
  ].join("\n");

  const dataset = buildChampionshipDatasetFromCsv({ csvText: csv });
  const beginnerClass = dataset.classes.find(
    (item) => item.id === "aqr-beginner-non-pro-level-1"
  );

  expect(dataset.validation.excludedRows).toBe(1);
  expect(dataset.validation.excludedClasses[0].classCode).toBe("5394");
  expect(dataset.showCount).toBe(3);
  expect(getChampionshipIncludedShows(dataset).map((show) => show.label)).toEqual([
    "AQR MAY SHOW 1",
    "AQR MAY SHOW 2",
    "AQR MAY SHOW 3",
  ]);
  expect(beginnerClass.events).toHaveLength(3);
  expect(beginnerClass.teams).toHaveLength(1);
  expect(beginnerClass.teams[0].totalPoints).toBe(19);
  expect(beginnerClass.teams[0]).not.toHaveProperty("totalMoney");
  expect(beginnerClass.events[0]).not.toHaveProperty("totalMoney");
  expect(dataset.imports[0].rows[0]).not.toHaveProperty("moneyWon");
  expect(beginnerClass.teams[0].details).toHaveLength(3);
  expect(beginnerClass.teams[0].details[2].points).toBe(0);
});

test("keeps full source results on championship show occurrences", () => {
  const csv = [
    "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
    'S1,AQR MAY SHOW 1,Débutant I / Beginner I,5399,8,12,11,1,1,GOOD HORSE,123,"RIDER, ALICE",456,101,1,72.5,50',
    'S1,AQR MAY SHOW 1,Débutant I / Beginner I,5399,8,12,11,1,1,NICE HORSE,321,"RIDER, BOB",654,202,2,71,25',
    'S1,AQR MAY SHOW 1,Débutant I / Beginner I,5399,8,12,11,1,1,LEARNING HORSE,,"RIDER, CAROL",,303,12,66,0',
  ].join("\n");

  const dataset = buildChampionshipDatasetFromCsv({
    csvText: csv,
    fileName: "may.csv",
  });
  const beginnerClass = dataset.classes.find(
    (item) => item.id === "aqr-beginner-non-pro-level-1"
  );
  const event = beginnerClass.events[0];

  expect(event.resultCount).toBe(3);
  expect(event.results).toMatchObject([
    {
      backNumber: "101",
      rider: "RIDER, ALICE",
      horse: "GOOD HORSE",
      classCode: "5399",
      className: "Débutant I / Beginner I",
      rawTotalScore: "72.5",
      points: 10,
      sourceFileName: "may.csv",
      sourceRowNumber: 2,
    },
    {
      backNumber: "202",
      points: 9,
    },
    {
      backNumber: "303",
      placeNum: 12,
      points: 0,
    },
  ]);
  expect(event.results[0]).not.toHaveProperty("moneyWon");
  expect(event.results[1]).not.toHaveProperty("rawMoneyWon");
  expect(dataset.imports[0].rows[0]).not.toHaveProperty("moneyWon");
});

test("rehydrates championship occurrence results from stored imports", () => {
  const importBatch = buildChampionshipImportBatchFromCsv({
    fileName: "may.csv",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      'S1,AQR MAY SHOW 1,Débutant I / Beginner I,5399,,5,5,1,1,GOOD HORSE,,"RIDER, ALICE",,101,1,72,50',
    ].join("\n"),
  });
  const storedImportBatch = {
    ...importBatch,
    rows: importBatch.rows.map((row) => ({
      ...row,
      moneyWon: 50,
      rawMoneyWon: "50",
      totalMoney: 999,
    })),
  };
  const dataset = buildChampionshipDatasetFromImports({
    imports: [storedImportBatch],
  });
  const storedSeason = {
    ...dataset,
    id: "season-1",
    associationId: "assoc-1",
    publicEventLabels: { S1: "Mai 1" },
    classes: dataset.classes.map((classEntry) => ({
      ...classEntry,
      events: classEntry.events.map(({ results, ...event }) => event),
    })),
  };

  const upgraded = ensureChampionshipOccurrenceResults(storedSeason);
  const event = upgraded.classes[0].events[0];

  expect(event.label).toBe("Mai 1");
  expect(event.results).toMatchObject([
    {
      backNumber: "101",
      rider: "RIDER, ALICE",
      sourceFileName: "may.csv",
    },
  ]);
  expect(dataset.imports[0].rows[0]).not.toHaveProperty("moneyWon");
  expect(event.results[0]).not.toHaveProperty("moneyWon");
});

test("groups championship teams by stable rider and horse numbers before names", () => {
  const csv = [
    "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
    "S1,AQR MAY SHOW,Open,1100,,5,5,1,1,GOOD HORSE,H-123,RIDER ALICE,M-456,101,1,72,50",
    'S2,AQR JUNE SHOW,Open,1100,,5,5,1,1,Good Horse AQHA,H-123,"ALICE, RIDER",M-456,202,2,71,25',
  ].join("\n");

  const dataset = buildChampionshipDatasetFromCsv({ csvText: csv });
  const openClass = dataset.classes.find((item) => item.id === "nrha-open");

  expect(openClass.teams).toHaveLength(1);
  expect(openClass.teams[0].teamKey).toBe("member:M456|horse-nrha:H123");
  expect(openClass.teams[0].details).toHaveLength(2);
});

test("keeps disqualified championship teams visible while recalculating standings", () => {
  const importBatch = buildChampionshipImportBatchFromCsv({
    fileName: "may.csv",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      'S1,AQR MAY SHOW 1,Open,1100,,3,3,1,1,HORSE A,,"RIDER, ALICE",,101,1,72,0',
      'S1,AQR MAY SHOW 1,Open,1100,,3,3,1,1,HORSE B,,"RIDER, BEN",,102,2,71,0',
      'S1,AQR MAY SHOW 1,Open,1100,,3,3,1,1,HORSE C,,"RIDER, CAROL",,103,3,70,0',
    ].join("\n"),
  });
  const dataset = buildChampionshipDatasetFromImports({
    imports: [importBatch],
    corrections: {
      disqualifications: [
        {
          id: "dq-ben",
          sourceImportId: importBatch.id,
          sourceRowNumber: 3,
          reason: "Cheval non eligible a la classe.",
        },
      ],
    },
  });
  const openClass = dataset.classes.find((item) => item.id === "nrha-open");
  const event = openClass.events[0];

  expect(event.results).toMatchObject([
    {
      rider: "RIDER, ALICE",
      placeNum: 1,
      points: 2,
      entryCount: 2,
    },
    {
      rider: "RIDER, CAROL",
      placeNum: 2,
      rawOriginalPlaceNum: "3",
      points: 1,
      entryCount: 2,
    },
    {
      rider: "RIDER, BEN",
      disqualified: true,
      dqReason: "Cheval non eligible a la classe.",
      placeNum: 0,
      rawPlaceNum: "DQ",
      rawOriginalPlaceNum: "2",
      points: 0,
    },
  ]);
  expect(event.totalPoints).toBe(3);
  expect(openClass.teams.map((team) => team.rider)).toEqual([
    "RIDER, ALICE",
    "RIDER, CAROL",
  ]);
  expect(openClass.teams.map((team) => team.totalPoints)).toEqual([2, 1]);
  expect(dataset.corrections.disqualifications).toHaveLength(1);
});

test("validates required championship verification request fields", () => {
  const classEntry = { id: "open", events: [{ eventKey: "S1|1100|1|1" }] };

  expect(
    validateChampionshipVerificationForm(
      {
        requesterName: "",
        requesterEmail: "invalid-email",
        classId: "open",
        scope: CHAMPIONSHIP_VERIFICATION_SCOPES.SELECTED_SHOWS,
        showKeys: [],
        rider: "",
        horse: "",
        explanation: "",
      },
      classEntry
    )
  ).toMatchObject({
    requesterName: "required",
    requesterEmail: "email",
    showKeys: "required",
    rider: "required",
    horse: "required",
    explanation: "required",
  });
});

test("validates championship update subscription consent and email", () => {
  expect(
    validateChampionshipUpdateSubscriptionForm({
      email: "not-an-email",
      consentAccepted: false,
    })
  ).toMatchObject({
    email: "email",
    consentAccepted: "required",
  });

  expect(
    validateChampionshipUpdateSubscriptionForm({
      email: "fan@example.com",
      consentAccepted: true,
    })
  ).toEqual({});
});

test("builds and validates championship update campaign defaults", () => {
  const t = (key, params = {}) =>
    translate("fr", key, params);
  const form = buildDefaultChampionshipUpdateCampaignForm({
    seasonTitle: "Championnat AQR",
    seasonYear: "2026",
    t,
    language: "fr",
    date: new Date("2026-07-09T12:00:00.000Z"),
  });

  expect(form.subject).toBe("Ajout des classements du mois de juillet");
  expect(form.message).toContain("Championnat AQR 2026");
  expect(validateChampionshipUpdateCampaignForm(form)).toEqual({});
  expect(
    validateChampionshipUpdateCampaignForm({
      ...form,
      mode: "test",
      testEmail: "bad-email",
    })
  ).toMatchObject({
    testEmail: "email",
  });
});

test("builds a championship verification email payload with selected shows", () => {
  const importBatch = buildChampionshipImportBatchFromCsv({
    fileName: "may.csv",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      'S1,AQR MAY SHOW 1,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,1,72,50',
      'S2,AQR MAY SHOW 2,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,2,71,25',
    ].join("\n"),
  });
  const season = buildChampionshipDatasetFromImports({
    imports: [importBatch],
    seasonTitle: "Championnat AQR",
    year: "2026",
    status: "published",
  });
  const openClass = season.classes.find((item) => item.id === "nrha-open");
  const firstEventKey = openClass.events[0].eventKey;
  const payload = buildChampionshipVerificationPayload({
    associationId: "assoc-1",
    association: { name: "Association Quebec Reining", shortName: "AQR" },
    season: { ...season, id: "season-1", associationId: "assoc-1" },
    championshipUrl: "https://showscore.app/public/associations/assoc-1/championnat",
    classEntry: openClass,
    submittedAt: "2026-07-06T12:00:00.000Z",
    form: {
      requesterName: "Marie Tremblay",
      requesterEmail: "MARIE@example.com",
      classId: openClass.id,
      scope: CHAMPIONSHIP_VERIFICATION_SCOPES.SELECTED_SHOWS,
      showKeys: [firstEventKey],
      rider: "RIDER, ALICE",
      horse: "HORSE A",
      explanation: "Le total du premier show semble different.",
    },
  });

  expect(payload).toMatchObject({
    source: "showscore_public_championship",
    submittedAt: "2026-07-06T12:00:00.000Z",
    championshipUrl: "https://showscore.app/public/associations/assoc-1/championnat",
    association: {
      id: "assoc-1",
      name: "Association Quebec Reining",
      shortName: "AQR",
    },
    season: {
      id: "season-1",
      title: "Championnat AQR",
      year: "2026",
      status: "published",
    },
    requester: {
      name: "Marie Tremblay",
      email: "marie@example.com",
    },
    request: {
      classId: "nrha-open",
      className: "Omnium NRHA (Open)",
      scope: "selected_shows",
      rider: "RIDER, ALICE",
      horse: "HORSE A",
      explanation: "Le total du premier show semble different.",
    },
    currentStanding: {
      rank: 1,
      rider: "RIDER, ALICE",
      horse: "HORSE A",
      totalPoints: "9",
    },
  });
  expect(payload.currentStanding).not.toHaveProperty("totalMoney");
  expect(payload.request.shows).toHaveLength(1);
  expect(payload.request.shows[0]).toMatchObject({
    eventKey: firstEventKey,
    label: "AQR MAY SHOW 1",
    classCode: "1100",
  });
  expect(payload.currentStanding.details).toHaveLength(1);
  expect(payload.currentStanding.details[0]).toMatchObject({
    eventKey: firstEventKey,
    points: "5",
    sourceFileName: "may.csv",
  });
  expect(payload.currentStanding.details[0]).not.toHaveProperty("moneyWon");
});

test("applies public labels to championship technical shows", () => {
  const csv = [
    "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
    '201227090,AQR MAY SHOW 1,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,1,72,50',
    '201227091,AQR MAY SHOW 2,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,2,71,25',
  ].join("\n");

  const labeled = applyChampionshipEventLabels(
    buildChampionshipDatasetFromCsv({ csvText: csv }),
    {
      201227090: "Mai 1",
      201227091: "Mai 2",
    }
  );
  const openClass = labeled.classes.find((item) => item.id === "nrha-open");

  expect(openClass.events.map((event) => event.label)).toEqual(["Mai 1", "Mai 2"]);
  expect(labeled.shows.map((show) => show.label)).toEqual(["Mai 1", "Mai 2"]);
  expect(openClass.teams[0].details.map((detail) => detail.eventLabel)).toEqual([
    "Mai 1",
    "Mai 2",
  ]);
});

test("uses configured championship show order for occurrence columns", () => {
  const csv = [
    "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
    'SHOW-B,Commanditaires Bleu,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,1,72,50',
    'SHOW-C,Invité spécial,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,2,71,25',
    'SHOW-A,Levée spéciale,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,3,70,15',
    'SHOW-B,Commanditaires Bleu,Débutant I / Beginner I,5399,,5,5,1,1,HORSE B,,"RIDER, BOB",,102,1,72,50',
    'SHOW-A,Levée spéciale,Débutant I / Beginner I,5399,,5,5,1,1,HORSE B,,"RIDER, BOB",,102,2,71,25',
  ].join("\n");

  const labeled = applyChampionshipEventLabels(
    buildChampionshipDatasetFromCsv({ csvText: csv }),
    {
      "SHOW-A": "Ouverture",
      "SHOW-B": "Circuit bleu",
      "SHOW-C": "Soirée spéciale",
    },
    {
      "SHOW-A": 1,
      "SHOW-B": 2,
      "SHOW-C": 3,
    }
  );
  const openClass = labeled.classes.find((item) => item.id === "nrha-open");
  const beginnerClass = labeled.classes.find(
    (item) => item.id === "aqr-beginner-non-pro-level-1"
  );

  expect(openClass.events.map((event) => event.label)).toEqual([
    "Ouverture",
    "Circuit bleu",
    "Soirée spéciale",
  ]);
  expect(beginnerClass.events.map((event) => event.label)).toEqual([
    "Ouverture",
    "Circuit bleu",
  ]);
  expect(beginnerClass.teams[0].details.map((detail) => detail.eventLabel)).toEqual([
    "Ouverture",
    "Circuit bleu",
  ]);
  expect(getChampionshipIncludedShows(labeled).map((show) => show.label)).toEqual([
    "Ouverture",
    "Circuit bleu",
    "Soirée spéciale",
  ]);
  expect(labeled.publicEventOrder).toEqual({
    "SHOW-A": 1,
    "SHOW-B": 2,
    "SHOW-C": 3,
  });
});

test("reapplies saved championship show order to stored occurrence results", () => {
  const storedSeason = {
    ...buildChampionshipDatasetFromCsv({
      csvText: [
        "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
        'SHOW-B,Commanditaires Bleu,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,1,72,50',
        'SHOW-A,Levée spéciale,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,2,71,25',
      ].join("\n"),
    }),
    imports: [],
    publicEventLabels: {
      "SHOW-A": "Ouverture",
      "SHOW-B": "Circuit bleu",
    },
    publicEventOrder: {
      "SHOW-A": 1,
      "SHOW-B": 2,
    },
  };

  const upgraded = ensureChampionshipOccurrenceResults(storedSeason);

  expect(upgraded.classes[0].events.map((event) => event.label)).toEqual([
    "Ouverture",
    "Circuit bleu",
  ]);
  expect(upgraded.classes[0].teams[0].details.map((detail) => detail.eventLabel)).toEqual([
    "Ouverture",
    "Circuit bleu",
  ]);
});

test("builds lightweight championship fun facts", () => {
  const dataset = buildChampionshipDatasetFromCsv({
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      'S1,AQR MAY SHOW 1,Open,1100,,10,10,1,1,HORSE A,,"RIDER, ALICE",,101,1,74,80',
      'S2,AQR JUNE SHOW 1,Open,1100,,10,10,1,1,HORSE A,,"RIDER, ALICE",,101,2,73,40',
      'S3,AQR JULY SHOW 1,Intermediate Open,1110,,10,10,1,1,HORSE A,,"RIDER, ALICE",,101,3,72,25',
      'S1,AQR MAY SHOW 1,Youth Beginner,5397,,10,10,1,1,HORSE B,,"RIDER, BOB",,102,1,75.5,20',
      'S2,AQR JUNE SHOW 1,Youth Beginner,5397,,10,10,1,1,HORSE C,,"RIDER, CAROL",,103,1,70,100',
      'S3,AQR JULY SHOW 1,Youth Beginner,5397,,10,10,1,1,HORSE E,,"RIDER, ERIN",,105,1,75.5,0',
      'S4,AQR AUGUST SHOW 1,Youth Beginner,5397,,10,10,1,1,HORSE F,,"RIDER, ALICE",,106,1,74,0',
      'S5,AQR SEPTEMBER SHOW 1,Youth Beginner,5397,,10,10,1,1,HORSE A,,"RIDER, FRANK",,107,2,73,0',
      'S6,AQR SEPTEMBER SHOW 2,Youth Beginner,5397,,10,10,1,1,HORSE G,,"RIDER, GINA",,108,8,68,0',
      'S7,AQR OCTOBER SHOW 1,Youth Beginner,5397,,10,10,1,1,HORSE G,,"RIDER, GINA",,108,7,69,0',
      'S8,AQR OCTOBER SHOW 2,Youth Beginner,5397,,10,10,1,1,HORSE G,,"RIDER, GINA",,108,4,73,0',
      'S9,AQR NOVEMBER SHOW 1,Youth Beginner,5397,,10,10,1,1,HORSE G,,"RIDER, GINA",,108,3,74,0',
      'S3,AQR JULY SHOW 1,Ranch Riding,399,,10,10,1,1,HORSE D,,"RIDER, DANA",,104,1,78,0',
    ].join("\n"),
  });
  const funFacts = buildChampionshipFunFacts(dataset);

  expect(funFacts.highestScore).toHaveLength(1);
  expect(funFacts.highestScore).toMatchObject([
    {
      rider: "RIDER, DANA",
      horse: "HORSE D",
      score: 78,
      showLabel: "AQR JULY SHOW 1",
    },
  ]);
  expect(funFacts.highestReiningScore).toHaveLength(1);
  expect(funFacts.highestReiningScore).toMatchObject([
    {
      rider: "RIDER, BOB",
      horse: "HORSE B",
      score: 75.5,
      showLabel: "AQR MAY SHOW 1",
    },
  ]);
  expect(funFacts.highestRanchRidingScore).toHaveLength(1);
  expect(funFacts.highestRanchRidingScore).toMatchObject([
    {
      rider: "RIDER, DANA",
      horse: "HORSE D",
      score: 78,
      showLabel: "AQR JULY SHOW 1",
    },
  ]);
  expect(funFacts).not.toHaveProperty("topMoney");
  expect(funFacts.topRiderPoints).toMatchObject([
    {
      rider: "RIDER, ALICE",
      totalPoints: 37,
      horseCount: 2,
    },
  ]);
  expect(funFacts.topHorsePoints).toMatchObject([
    {
      horse: "HORSE A",
      totalPoints: 36,
      riderCount: 2,
    },
  ]);
  expect(funFacts.topTeamPoints).toMatchObject([
    {
      rider: "RIDER, ALICE",
      horse: "HORSE A",
      totalPoints: 27,
    },
  ]);
  expect(funFacts.mostPodiums).toMatchObject([
    {
      rider: "RIDER, ALICE",
      horse: "HORSE A",
      podiumCount: 3,
    },
  ]);
  expect(funFacts.bestProgression).toMatchObject([
    {
      rider: "RIDER, GINA",
      horse: "HORSE G",
      firstScoreAverage: 68.5,
      lastScoreAverage: 73.5,
      progressionDelta: 5,
      scoreCount: 4,
    },
  ]);
  expect(funFacts.mostClasses).toMatchObject([
    {
      rider: "RIDER, GINA",
      horse: "HORSE G",
      classCount: 4,
    },
  ]);
});

test("rebuilds championship standings from separate non-cumulative CSV imports", () => {
  const firstImport = buildChampionshipImportBatchFromCsv({
    fileName: "mai.csv",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      'S1,AQR MAY SHOW 1,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,1,72,50',
    ].join("\n"),
  });
  const secondImport = buildChampionshipImportBatchFromCsv({
    fileName: "juin.csv",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      'S2,AQR JUNE SHOW 1,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,2,71,25',
    ].join("\n"),
  });

  const dataset = buildChampionshipDatasetFromImports({
    imports: [firstImport, secondImport],
  });
  const openClass = dataset.classes.find((item) => item.id === "nrha-open");

  expect(dataset.importCount).toBe(2);
  expect(dataset.rowCount).toBe(2);
  expect(dataset.uniqueRowCount).toBe(2);
  expect(openClass.events).toHaveLength(2);
  expect(openClass.teams[0].totalPoints).toBe(9);
  expect(openClass.teams[0].details.map((detail) => detail.sourceFileName)).toEqual([
    "mai.csv",
    "juin.csv",
  ]);
});

test("uses the latest CSV import when a result row is duplicated", () => {
  const originalImport = buildChampionshipImportBatchFromCsv({
    fileName: "mai-original.csv",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      'S1,AQR MAY SHOW 1,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,1,72,50',
    ].join("\n"),
  });
  const correctedImport = buildChampionshipImportBatchFromCsv({
    fileName: "mai-corrige.csv",
    csvText: [
      "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
      'S1,AQR MAY SHOW 1,Open,1100,,5,5,1,1,HORSE A,,"RIDER, ALICE",,101,2,71,25',
    ].join("\n"),
  });

  const dataset = buildChampionshipDatasetFromImports({
    imports: [originalImport, correctedImport],
  });
  const openClass = dataset.classes.find((item) => item.id === "nrha-open");

  expect(dataset.rowCount).toBe(2);
  expect(dataset.uniqueRowCount).toBe(1);
  expect(dataset.duplicateRowCount).toBe(1);
  expect(dataset.validation.duplicateRows).toHaveLength(1);
  expect(openClass.teams[0].totalPoints).toBe(4);
  expect(openClass.teams[0].details[0].sourceFileName).toBe("mai-corrige.csv");
});

test("maps the main AQR championship class codes from the import report", () => {
  [
    "1100",
    "1110",
    "1200",
    "1301",
    "1350",
    "1400",
    "1500",
    "1600",
    "1650",
    "1660",
    "1700",
    "1750",
    "1800",
    "1850",
    "3100",
    "3200",
    "3500",
    "5300",
    "5310",
    "5396",
    "5397",
  ].forEach((classCode) => {
    expect(getChampionshipClassByCode(classCode)).toBeTruthy();
  });
});

test("maps AQR Funware draw codes to championship classes", () => {
  const summary = buildAssociationChampionshipClassSummary({
    association: { id: "aqr", shortName: "AQR" },
    blockClasses: [
      { code: "105", name: "ROOKIE NP 1 NRHA", entryCount: 12 },
      { code: "107", name: "DÉBUTANT NP 1 AQR", entryCount: 8 },
      { code: "5300", name: "ROOKIE", entryCount: 10 },
      { code: "5500", name: "JAMBES COURTES", entryCount: 6 },
      { code: "3500", name: "SHORT LEGS", entryCount: 5 },
      { code: "5393", name: "NOVICE HORSE NP - AQR", entryCount: 4 },
      { code: "9999", name: "MYSTERY CLASS", entryCount: 1 },
    ],
  });

  expect(summary.available).toBe(true);
  expect(summary.matchedCount).toBe(5);
  expect(summary.excludedCount).toBe(1);
  expect(summary.unknownCount).toBe(1);
  expect(summary.rows[0]).toMatchObject({
    code: "105",
    championshipClassId: "nrha-rookie-level-1",
    matchType: "funwareCode",
    status: "matched",
  });
  expect(summary.rows[1]).toMatchObject({
    code: "107",
    championshipClassId: "aqr-beginner-non-pro-level-1",
    matchType: "funwareCode",
    status: "matched",
  });
  expect(summary.rows[2]).toMatchObject({
    code: "5300",
    championshipClassId: "nrha-rookie-level-1",
    matchType: "championshipCode",
    status: "matched",
  });
  expect(summary.rows[3]).toMatchObject({
    code: "5500",
    championshipClassId: "aqr-short-legs-10-under",
    matchType: "funwareCode",
    status: "matched",
  });
  expect(summary.rows[4]).toMatchObject({
    code: "3500",
    championshipClassId: "aqr-short-legs-10-under",
    matchType: "championshipCode",
    status: "matched",
  });
  expect(summary.rows[5]).toMatchObject({
    code: "5393",
    status: "excluded",
  });
  expect(summary.rows[6]).toMatchObject({
    code: "9999",
    status: "unknown",
  });
});

test("keeps AQR class dictionary scoped to AQR associations", () => {
  const summary = buildAssociationChampionshipClassSummary({
    association: { id: "era", shortName: "ERA" },
    blockClasses: [{ code: "105", name: "ROOKIE NP 1 NRHA", entryCount: 12 }],
  });

  expect(summary.available).toBe(false);
  expect(summary.rows).toEqual([]);
});

test("builds a manual championship import from validated ShowScore results by code", () => {
  const classDataItems = [
    {
      classItem: {
        id: "class-1",
        showId: "show-1",
        dayId: "day-1",
        name: "Rookie ShowScore custom label",
      },
      show: { id: "show-1", name: "AQR JULY SHOW" },
      day: { id: "day-1", date: "2026-07-18" },
      setup: {
        pattern: "8",
        blockClasses: [
          { code: "105", name: "Rookie ShowScore custom label" },
        ],
        runs: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            rider: "Rider Alice",
            horse: "Good Horse",
            memberNrha: "M-100",
            horseNrha: "H-100",
            classCodes: ["105"],
          },
          {
            id: "run-2",
            draw: 2,
            backNumber: "102",
            rider: "Rider Bob",
            horse: "Nice Horse",
            memberNrha: "M-200",
            horseNrha: "H-200",
            classCodes: ["105"],
          },
          {
            id: "run-3",
            draw: 3,
            backNumber: "103",
            rider: "Rider Carol",
            horse: "Scratch Horse",
            classCodes: ["105"],
          },
        ],
      },
      official: {
        isSecretariatValidated: true,
        eventName: "AQR JULY SHOW",
        eventDate: "2026-07-18",
        pattern: "Pattern 8",
        officialRuns: [
          {
            id: "run-1",
            draw: 1,
            backNumber: "101",
            rider: "Rider Alice",
            horse: "Good Horse",
            scoreTotal: "72",
          },
          {
            id: "run-2",
            draw: 2,
            backNumber: "102",
            rider: "Rider Bob",
            horse: "Nice Horse",
            scoreTotal: "73",
          },
          {
            id: "run-3",
            draw: 3,
            backNumber: "103",
            rider: "Rider Carol",
            horse: "Scratch Horse",
            scoreTotal: "",
          },
        ],
      },
      scoringRuns: [],
    },
  ];

  const preview = buildShowScoreChampionshipImportPreview({
    association: { id: "aqr", shortName: "AQR" },
    classDataItems,
    generatedAt: "2026-07-18T18:00:00.000Z",
  });
  const classEntry = preview.classes[0];

  expect(classEntry).toMatchObject({
    importedClassCode: "105",
    championshipClassCode: "5300",
    championshipClassId: "nrha-rookie-level-1",
    canInclude: true,
    rowCount: 2,
  });
  expect(preview.rows).toHaveLength(2);
  expect(preview.rows[0]).toMatchObject({
    classCode: "5300",
    importedClassCode: "105",
    rider: "Rider Bob",
    placeNum: 1,
    entryCount: 3,
    shownCount: 2,
    memberNrha: "M-200",
    horseNrha: "H-200",
    riderKey: "member:M200",
    horseKey: "horse-nrha:H200",
    teamKey: "member:M200|horse-nrha:H200",
  });

  const batch = buildShowScoreChampionshipImportBatch({
    preview,
    excludedClassKeys: [classEntry.key],
    importedAt: "2026-07-18T18:05:00.000Z",
    id: "showscore-import-test",
  });

  expect(batch.sourceType).toBe("showscore");
  expect(batch.ignoredRowCount).toBe(2);
  expect(batch.rows.every((row) => row.ignoredForChampionship)).toBe(true);
  expect(batch.rows[0].ignoredReason).toBe("manual_class_exclusion");
});

test("keeps unrecognized ShowScore classes ignored for championship imports", () => {
  const preview = buildShowScoreChampionshipImportPreview({
    association: { id: "aqr", shortName: "AQR" },
    classDataItems: [
      {
        classItem: {
          id: "class-unknown",
          showId: "show-1",
          dayId: "day-1",
          name: "Mystery ShowScore class",
        },
        show: { id: "show-1", name: "AQR JULY SHOW" },
        setup: {
          blockClasses: [{ code: "9999", name: "Mystery ShowScore class" }],
          runs: [
            {
              id: "run-1",
              draw: 1,
              rider: "Rider Alice",
              horse: "Good Horse",
              classCodes: ["9999"],
            },
          ],
        },
        official: {
          isSecretariatValidated: true,
          officialRuns: [
            {
              id: "run-1",
              draw: 1,
              rider: "Rider Alice",
              horse: "Good Horse",
              scoreTotal: "72",
            },
          ],
        },
      },
    ],
  });

  expect(preview.classes[0]).toMatchObject({
    importedClassCode: "9999",
    canInclude: false,
    matchStatus: "unknown",
  });
  expect(preview.defaultExcludedClassKeys).toContain(preview.classes[0].key);
  expect(preview.rows[0]).toMatchObject({
    ignoredForChampionship: true,
    ignoredReason: "dictionary_unmapped_class",
  });
});

test("generates a season championship PDF with a class table of contents", () => {
  const csv = [
    "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
    'S1,AQR JULY SHOW,Youth Beginner,5397,,10,10,1,1,YOUTH HORSE,,"RIDER, YOUTH",,101,1,72,15',
    'S1,AQR JULY SHOW,Young Rider 14-21,5396,,8,8,1,1,YOUNG HORSE,,"RIDER, YOUNG",,102,1,73,25',
  ].join("\n");
  const dataset = buildChampionshipDatasetFromCsv({
    csvText: csv,
    seasonTitle: "Championnat AQR",
    year: "2026",
    status: "final",
  });
  const pageNumbers = new Map(
    dataset.classes.map((classEntry, index) => [classEntry.id, index + 3])
  );
  const tableOfContents = buildChampionshipPdfTableOfContents(
    dataset,
    pageNumbers
  );
  const tableOfContentsColumns = buildChampionshipPdfTableOfContentsColumns(
    dataset,
    pageNumbers
  );
  const generatedAt = new Date("2026-07-05T12:00:00");
  const pdf = generateChampionshipPdf({
    associationName: "Association Quebec Reining",
    associationAbbreviation: "AQR",
    season: dataset,
    generatedAt,
  });

  expect(tableOfContents).toMatchObject([
    {
      name: "Jeune Débutant 18 ans et moins AQR (Beginner Youth 18 & under)",
      pageNumber: 3,
      eventCount: 1,
      teamCount: 1,
    },
    {
      name: "Jeune Cavalier 14 à 21 ans AQR (Young Rider 14 thru 21)",
      pageNumber: 4,
      eventCount: 1,
      teamCount: 1,
    },
  ]);
  expect(tableOfContentsColumns.map((column) => column.length)).toEqual([1, 1]);
  expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(4);
  expect(
    buildChampionshipPdfFileName({
      associationAbbreviation: "AQR",
      seasonTitle: "Championnat AQR",
      year: "2026",
      generatedAt,
    })
  ).toMatch(/^AQR-Championnat_AQR-2026-championship-\d{8}-\d{6}\.pdf$/);
});

test("keeps a 20-team championship class on one PDF page", () => {
  const resultRows = Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;

    return `S1,AQR JULY SHOW,Youth Beginner,5397,,20,20,1,1,HORSE ${number},,"RIDER, ${number}",,${100 + number},1,72,0`;
  });
  const csv = [
    "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
    ...resultRows,
  ].join("\n");
  const dataset = buildChampionshipDatasetFromCsv({
    csvText: csv,
    seasonTitle: "Championnat AQR",
    year: "2026",
    status: "final",
  });
  const pdf = generateChampionshipPdf({
    associationName: "Association Quebec Reining",
    associationAbbreviation: "AQR",
    season: dataset,
    generatedAt: new Date("2026-07-05T12:00:00"),
  });

  expect(dataset.classes).toHaveLength(1);
  expect(dataset.classes[0].teams).toHaveLength(20);
  expect(pdf.getNumberOfPages()).toBe(3);
});

test("assigns skipped championship ranks when total points are tied", () => {
  const csv = [
    "ShowNum,ShowName,ClassName,ClassCode,PatternNum,EntryCount,ShownCount,GoType,GoNum,Horse,HorseNrha,Member,MemberNrha,BackNum,PlaceNum,TotalScore,MoneyWon",
    'S1,AQR MAY SHOW 1,Débutant I / Beginner I,5399,,10,10,1,1,HORSE A,,"RIDER, ALICE",,101,1,72,50',
    'S1,AQR MAY SHOW 1,Débutant I / Beginner I,5399,,10,10,1,1,HORSE B,,"RIDER, BOB",,102,1,72,50',
    'S1,AQR MAY SHOW 1,Débutant I / Beginner I,5399,,10,10,1,1,HORSE C,,"RIDER, CAROL",,103,3,70,20',
  ].join("\n");

  const dataset = buildChampionshipDatasetFromCsv({ csvText: csv });
  const ranks = dataset.classes[0].teams.map((team) => team.rank);

  expect(ranks).toEqual([1, 1, 3]);
});

test("formats penalties with commas and clears the latest penalty token", () => {
  const specialTokens = ["Score 0", "No score", "Scratch", "Révision vidéo"];

  expect(appendPenaltyToken("1", "5", specialTokens)).toBe("1, 5");
  expect(appendPenaltyToken("2", "P2", specialTokens)).toBe("2, P2");
  expect(appendPenaltyToken("1, 5", "12", specialTokens)).toBe("1, 5, 12");
  expect(formatPenaltyValue("1 5 Score 0", specialTokens)).toBe(
    "1, 5, Score 0"
  );
  expect(removeLastPenaltyToken("1, 5, 12", specialTokens)).toBe("1, 5");
  expect(removeLastPenaltyToken("1, 5, Score 0", specialTokens)).toBe("1, 5");
  expect(removeLastPenaltyToken("1, Score 0, 5", specialTokens)).toBe(
    "1, Score 0"
  );

  const run = recalculateRun({
    scores: ["0"],
    penalties: ["1, 5, 12"],
  });

  expect(run.penTotal).toBe("18");
  expect(run.scoreTotal).toBe("52");

  const codedPenaltyRun = recalculateRun({
    scores: ["0"],
    penalties: ["2, P2, 5, P5"],
  });

  expect(codedPenaltyRun.penTotal).toBe("14");
  expect(codedPenaltyRun.scoreTotal).toBe("56");
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

test("builds bilingual judge notes for required NRHA special penalty reasons", () => {
  expect(isSpecialPenaltyReasonRequired("No score")).toBe(true);
  expect(isSpecialPenaltyReasonRequired("Score 0")).toBe(true);
  expect(isSpecialPenaltyReasonRequired("Scratch")).toBe(false);

  expect(getSpecialPenaltyReasons("No score")[0]).toMatchObject({
    en: "Legal infraction related to exhibition, care, or custody of the horse",
  });

  const noteWithNoScore = upsertSpecialPenaltyReasonNote(
    "Manual judge note.",
    "No score",
    "illegal_equipment"
  );

  expect(noteWithNoScore).toContain("Manual judge note.");
  expect(noteWithNoScore).toContain("No score - Raison: Équipement illégal");
  expect(noteWithNoScore).toContain("Reason: Illegal equipment");

  const noteWithSecondNoScoreReason = upsertSpecialPenaltyReasonNote(
    noteWithNoScore,
    "No score",
    "animal_abuse"
  );

  expect(noteWithSecondNoScoreReason).toContain("Manual judge note.");
  expect(noteWithSecondNoScoreReason).toContain("Équipement illégal");
  expect(noteWithSecondNoScoreReason).toContain("Abus animal");
  expect(noteWithSecondNoScoreReason).toContain(
    "Animal abuse or evidence of abuse"
  );

  const noteWithScoreZero = upsertSpecialPenaltyReasonNote(
    noteWithSecondNoScoreReason,
    "Score 0",
    "pattern_not_completed"
  );

  expect(noteWithScoreZero).toContain(
    "Score 0 - Raison: Pattern non complété tel qu'écrit"
  );
  expect(noteWithScoreZero).toContain(
    "Reason: Failure to complete pattern as written"
  );

  expect(removeSpecialPenaltyReasonNote(noteWithScoreZero, "No score")).toContain(
    "Manual judge note."
  );
  expect(removeSpecialPenaltyReasonNote(noteWithScoreZero, "No score")).not.toContain(
    "Animal abuse"
  );

  const noteWithManualComment = upsertSpecialPenaltyReasonNote(
    noteWithScoreZero,
    "No score",
    "manual_comment",
    "Décision confirmée par les juges."
  );

  expect(noteWithManualComment).toContain(
    "No score - Commentaire / Comment: Décision confirmée par les juges."
  );
  expect(noteWithManualComment).toContain("Animal abuse");

  expect(
    upsertSpecialPenaltyReasonNote(
      noteWithManualComment,
      "No score",
      "no_comment"
    )
  ).toBe(noteWithManualComment);

  const firstScoreZeroReason = upsertSpecialPenaltyReasonNote(
    "",
    "Score 0",
    "pattern_not_completed"
  );
  const multipleScoreZeroReasons = upsertSpecialPenaltyReasonNote(
    firstScoreZeroReason,
    "Score 0",
    "fall"
  );

  expect(multipleScoreZeroReasons).toContain(
    "Score 0 - Raison: Pattern non complété"
  );
  expect(multipleScoreZeroReasons).toContain(
    "Score 0 - Raison: Chute au sol"
  );
  expect(multipleScoreZeroReasons).not.toContain("[M1");
  expect(multipleScoreZeroReasons).not.toContain("[M3");
  expect(
    normalizeSpecialPenaltyReasonNote(
      "Score 0 [M1: RUN IN] - Raison: Pattern non complété\n" +
        "Score 0 [M3: STOP] - Raison: Chute au sol"
    )
  ).toBe(
    "Score 0 - Raison: Pattern non complété\n" +
      "Score 0 - Raison: Chute au sol"
  );
});

test("shows a ready setup to the scribe before scoring starts", () => {
  expect(
    canOpenClassForScribe({
      classItem: { pattern: "NRHA 1" },
      setup: {
        pattern: "NRHA 1",
        runs: [{ draw: 1 }],
        startedAt: null,
      },
      publication: { status: "hidden" },
      status: "ready",
    })
  ).toBe(true);
});

test("carries imported scratched runs into scoring", () => {
  const penalties = buildSetupRunScoringPenalties(
    {
      status: "Scratched",
      owner: "MARTIN BRISEBOIS / ST- APOLLINAIRE, QC - Scratched",
    },
    3
  );
  const run = recalculateRun({
    backNumber: "2563",
    scores: ["", "", ""],
    penalties,
  });

  expect(penalties).toEqual(["Scratch", "", ""]);
  expect(run.penTotal).toBe("Scratch");
  expect(run.scoreTotal).toBe("SCR");
  expect(isScoredRunComplete(run, 3)).toBe(true);
  expect(
    applySetupRunScratchPenalty(
      { owner: "MARTIN BRISEBOIS / ST- APOLLINAIRE, QC - Scratched" },
      ["", "", ""]
    )
  ).toEqual(["Scratch", "", ""]);
});

test("preserves existing run IDs when a draw is reimported with a late entry", () => {
  const existingRuns = [
    {
      id: "run-existing-1",
      runId: "hsp-run-1",
      order: 1,
      draw: 1,
      backNumber: "101",
      rider: "Élodie Martin",
      horse: "Smart Whiz",
      owner: "Owner One",
      classCodes: ["OPEN"],
    },
    {
      id: "run-existing-2",
      order: 2,
      draw: 2,
      backNumber: "202",
      rider: "Marie Roy",
      horse: "Custom Shine",
      owner: "Owner Two",
      classCodes: ["NP"],
    },
  ];
  const importedRuns = [
    {
      id: "run-imported-1",
      order: 1,
      draw: 1,
      backNumber: "101",
      rider: "Elodie Martin",
      horse: "Smart Whiz",
      owner: "Owner One Updated",
      classCodes: ["OPEN"],
    },
    {
      id: "run-late-entry",
      order: 2,
      draw: 2,
      backNumber: "303",
      rider: "Late Rider",
      horse: "Late Horse",
      owner: "Owner Three",
      classCodes: ["OPEN"],
    },
    {
      id: "run-imported-2",
      order: 3,
      draw: 3,
      backNumber: "202",
      rider: "Marie Roy",
      horse: "Custom Shine",
      owner: "Owner Two Updated",
      classCodes: ["NP"],
    },
  ];

  const merged = mergeImportedRunsWithExistingIds(importedRuns, existingRuns);

  expect(merged.map((run) => run.id)).toEqual([
    "run-existing-1",
    "run-late-entry",
    "run-existing-2",
  ]);
  expect(merged[0]).toMatchObject({
    runId: "hsp-run-1",
    order: 1,
    owner: "Owner One Updated",
  });
  expect(merged[2]).toMatchObject({
    order: 3,
    draw: 3,
    owner: "Owner Two Updated",
  });
});

test("does not preserve run IDs when an imported draw match is ambiguous", () => {
  const existingRuns = [
    { id: "run-a", rider: "Same Rider", horse: "Same Horse" },
    { id: "run-b", rider: "Same Rider", horse: "Same Horse" },
  ];
  const importedRuns = [
    { id: "run-imported", rider: "Same Rider", horse: "Same Horse" },
  ];

  const merged = mergeImportedRunsWithExistingIds(importedRuns, existingRuns);

  expect(merged[0].id).toBe("run-imported");
});

test("detects full scoring data loss without treating default totals as scores", () => {
  const savedRuns = [
    {
      id: "old-run",
      scores: ["0", "", ""],
      penalties: ["", "", ""],
      scoreTotal: 70,
    },
    {
      id: "default-run",
      scores: ["", "", ""],
      penalties: ["", "", ""],
      scoreTotal: 70,
    },
  ];
  const emptyMergedRuns = [
    {
      id: "new-run",
      scores: ["", "", ""],
      penalties: ["", "", ""],
      scoreTotal: 70,
    },
  ];

  expect(countRunsWithScoringData(savedRuns)).toBe(1);
  expect(countRunsWithScoringData(emptyMergedRuns)).toBe(0);
  expect(buildScoringDataLossWarning(savedRuns, emptyMergedRuns)).toEqual({
    previousCount: 1,
    nextCount: 0,
    severity: "blocked",
  });
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

test("uses sliding contest as a reining scoring pattern", () => {
  expect(getPatternDisplayName(SLIDING_CONTEST_PATTERN_ID)).toBe(
    "Sliding contest"
  );
  expect(getPatternDisplayName("Sliding contest")).toBe("Sliding contest");
  expect(getPatternHeaders(SLIDING_CONTEST_PATTERN_ID)).toEqual([
    "Approach",
    "Stop",
    "Hesitation",
  ]);
  expect(getPatternManeuverDescription("Approach", SLIDING_CONTEST_PATTERN_ID)).toBe(
    "Approach"
  );

  expect(getScoringOptionsForPattern(SLIDING_CONTEST_PATTERN_ID)).toMatchObject({
    scoreOptions: [
      "-3",
      "-2½",
      "-2",
      "-1½",
      "-1",
      "-½",
      "0",
      "+½",
      "+1",
      "+1½",
      "+2",
      "+2½",
      "+3",
    ],
    penaltyOptions: ["½", "1", "2", "P2", "5", "P5", "Score 0"],
  });

  const run = recalculateRun(
    {
      backNumber: "700",
      scores: ["+3", "+2½", "-1"],
      penalties: ["1", "", ""],
    },
    getScoringOptionsForPattern(SLIDING_CONTEST_PATTERN_ID)
  );

  expect(run.penTotal).toBe("1");
  expect(run.scoreTotal).toBe("73½");
  expect(isScoredRunComplete(run, 3)).toBe(true);
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

test("generates a provisional PDF while scoring is incomplete", () => {
  const pdf = generateScorePdf({
    associationName: "Association test",
    eventName: "Show test",
    eventDate: "2026-07-17",
    classItem: {
      id: "class-live",
      name: "Open en cours",
      pattern: "1",
    },
    classSetup: {
      pattern: "1",
      judgeName: "Juge test",
    },
    runs: [
      {
        id: "run-1",
        draw: 1,
        backNumber: "101",
        rider: "Cavalier 1",
        scores: ["+0.5", "0"],
        penalties: ["", ""],
        scoreTotal: "",
      },
      {
        id: "run-2",
        draw: 2,
        backNumber: "102",
        rider: "Cavalier 2",
        scores: [],
        penalties: [],
        scoreTotal: "",
      },
    ],
    headers: ["M1", "M2"],
    titleSuffix: "PROVISOIRE / DRAFT",
  });
  const fileName = buildScorePdfFileName({
    associationAbbreviation: "TEST",
    showName: "Show test",
    className: "Open en cours-provisoire",
    finalizedAt: "2026-07-17T17:30:00.000Z",
  });

  expect(pdf.getNumberOfPages()).toBe(1);
  expect(fileName).toContain("provisoire");
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

test("deletes an association from local storage when cloud sync is unavailable", async () => {
  saveAssociations([
    { id: "association-1", name: "Association One", shortName: "ONE" },
    { id: "association-2", name: "Association Two", shortName: "TWO" },
  ]);

  await deleteAssociationRepository("association-1");

  expect(loadAssociations().map((association) => association.id)).toEqual([
    "association-2",
  ]);
});

test("detects when the association delete RPC is missing", () => {
  expect(isDeleteAssociationRpcMissing({ code: "PGRST202" })).toBe(true);
  expect(
    isDeleteAssociationRpcMissing({
      message: "Could not find function delete_association_as_admin",
    })
  ).toBe(true);
  expect(isDeleteAssociationRpcMissing({ code: "42501" })).toBe(false);
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
      isLivestreamPublic: true,
      livestreamUrlsByDate: {
        "2026-07-22": "https://youtu.be/daily123",
      },
    })
  ).toBe(true);
  expect(
    hasPublicLivestream({
      isLivestreamPublic: false,
      livestreamUrl: "https://youtu.be/abc123",
    })
  ).toBe(false);
});

test("selects only the current show day livestream in the association timezone", () => {
  const show = {
    startDate: "2026-07-22",
    endDate: "2026-07-24",
    isLivestreamPublic: true,
    livestreamUrlsByDate: {
      "2026-07-22": "https://example.com/day-1",
      "2026-07-23": "https://example.com/day-2",
      "2026-07-24": "https://example.com/day-3",
    },
  };

  expect(
    getDateValueInTimeZone(
      new Date("2026-07-23T02:30:00.000Z"),
      "America/Toronto"
    )
  ).toBe("2026-07-22");
  expect(
    getCurrentPublicLivestream(show, {
      timezone: "America/Toronto",
      now: new Date("2026-07-23T16:00:00.000Z"),
    })
  ).toMatchObject({
    showDate: "2026-07-23",
    url: "https://example.com/day-2",
  });
  expect(
    getCurrentPublicLivestream(show, {
      timezone: "America/Toronto",
      now: new Date("2026-07-25T16:00:00.000Z"),
    }).url
  ).toBe("");
});

test("normalizes daily livestream links by valid date", () => {
  expect(
    normalizeLivestreamUrlsByDate({
      invalid: "https://example.com/invalid",
      "2026-07-24": "  https://example.com/day-3  ",
      "2026-07-22": "https://example.com/day-1",
      "2026-07-23": "",
    })
  ).toEqual({
    "2026-07-22": "https://example.com/day-1",
    "2026-07-24": "https://example.com/day-3",
  });
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
  const championshipSeo = buildChampionshipPublicSeo({
    association: { shortName: "AQR", name: "Association Reining Quebec" },
    season: { title: "Championnat de saison", year: "2026" },
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
  expect(championshipSeo.title).toBe(
    "Championnat de saison 2026 | AQR | ShowScore"
  );
  expect(championshipSeo.description).toContain("AQR");
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
      status: "Scratched",
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
      {
        cells: [
          { x: 48, text: "21" },
          { x: 141, text: "GUNNAWINDYA" },
          { x: 317, text: "MARTIN BRISEBOIS / ST-" },
        ],
      },
      {
        cells: [
          { x: 46, text: "Scratched" },
          { x: 108, text: "2588" },
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
    status: "Scratched",
    classCodes: ["JC1421"],
  });
  expect(importedDraw.runs[2]).toMatchObject({
    order: 3,
    draw: 21,
    backNumber: "2588",
    rider: "NAOMIE BRISEBOIS",
    owner: "MARTIN BRISEBOIS / ST- APOLLINAIRE, QC - Scratched",
    status: "Scratched",
    classCodes: ["JC1421"],
  });
  expect(
    importedDraw.runs.filter((run) => run.status === "Scratched")
  ).toHaveLength(2);
  expect(
    normalizeClassSetup({ runs: importedDraw.runs }).runs.filter(
      (run) => run.status === "Scratched"
    )
  ).toHaveLength(2);
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

test("builds provisional live standings by imported class code", () => {
  const standings = buildLiveClassStandings({
    classItem: {
      id: "block-live",
      name: "Novice Horse Block",
      classCode: "BLOCK",
    },
    blockClasses: [
      { code: "NHO", name: "Novice Horse Open" },
      { code: "NH2", name: "Novice Horse Level 2" },
    ],
    setupRuns: [
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
    runs: [
      { id: "run-1", draw: 1, scoreTotal: "72.0" },
      { id: "run-2", draw: 2, scoreTotal: "70.5" },
    ],
  });

  expect(standings.map((group) => group.code)).toEqual(["NHO", "NH2"]);
  expect(standings.find((group) => group.code === "NHO").entries).toHaveLength(1);
  expect(standings.find((group) => group.code === "NH2").entries).toMatchObject([
    { rank: 1, backNumber: "101", scoreTotal: "72" },
    { rank: 2, backNumber: "202", scoreTotal: "70½" },
  ]);
});

test("builds a fallback standing for a completed simple block", () => {
  const standings = buildLiveClassStandings({
    classItem: {
      id: "simple-block",
      name: "Open Derby",
      classCode: "OPEN",
    },
    setupRuns: [
      {
        id: "simple-run-1",
        draw: 1,
        backNumber: "101",
        rider: "Alice Roy",
        horse: "Horse One",
      },
      {
        id: "simple-run-2",
        draw: 2,
        backNumber: "202",
        rider: "Bob Lee",
        horse: "Horse Two",
      },
    ],
    runs: [
      { id: "simple-run-1", draw: 1, scoreTotal: "72" },
      { id: "simple-run-2", draw: 2, scoreTotal: "70" },
    ],
  });

  expect(standings).toHaveLength(1);
  expect(standings[0]).toMatchObject({
    code: "OPEN",
    className: "Open Derby",
    entryCount: 2,
  });
  expect(standings[0].entries).toMatchObject([
    { rank: 1, rider: "Alice Roy", scoreTotal: "72" },
    { rank: 2, rider: "Bob Lee", scoreTotal: "70" },
  ]);
});

test("builds complete provisional live standings by default", () => {
  const standings = buildLiveClassStandings({
    classItem: {
      id: "block-complete-live",
      name: "Open Block",
      classCode: "OPEN",
    },
    blockClasses: [{ code: "OPEN", name: "Open" }],
    setupRuns: [
      {
        id: "run-1",
        draw: 1,
        backNumber: "101",
        rider: "Rider 1",
        horse: "Horse 1",
        classCodes: ["OPEN"],
      },
      {
        id: "run-2",
        draw: 2,
        backNumber: "202",
        rider: "Rider 2",
        horse: "Horse 2",
        classCodes: ["OPEN"],
      },
      {
        id: "run-3",
        draw: 3,
        backNumber: "303",
        rider: "Rider 3",
        horse: "Horse 3",
        classCodes: ["OPEN"],
      },
      {
        id: "run-4",
        draw: 4,
        backNumber: "404",
        rider: "Rider 4",
        horse: "Horse 4",
        classCodes: ["OPEN"],
      },
    ],
    runs: [
      { id: "run-1", draw: 1, scoreTotal: "72.0" },
      { id: "run-2", draw: 2, scoreTotal: "70.5" },
      { id: "run-3", draw: 3, scoreTotal: "71.0" },
      { id: "run-4", draw: 4, scoreTotal: "69.0" },
    ],
  });

  expect(standings[0].entryCount).toBe(4);
  expect(standings[0].visibleEntries).toHaveLength(4);
  expect(standings[0].visibleEntries.map((entry) => entry.rank)).toEqual([
    1,
    2,
    3,
    4,
  ]);
  expect(standings[0].visibleEntries.map((entry) => entry.backNumber)).toEqual([
    "101",
    "303",
    "202",
    "404",
  ]);
});

test("class setup normalization preserves HSP run metadata", () => {
  const setup = normalizeClassSetup({
    runs: [
      {
        id: "local-run-1",
        run_id: "hsp-run-1",
        block_run_id: "hsp-block-run-1",
        entry_id: "entry-1",
        class_id: "hsp-block-1",
        division_id: "division-1",
        horse_id: "horse-1",
        rider_contact_id: "rider-1",
        owner_contact_id: "owner-1",
        payer_contact_id: "payer-1",
        entry_ids: ["entry-1", "entry-1", "entry-2"],
        division_ids: ["division-1", "division-2"],
        division_names: ["Open", "Non Pro"],
        is_late: true,
        draw_group: "drag-1",
        draw: 4,
        backNumber: "101",
        rider: "Rider One",
        horse: "Horse One",
        owner: "Owner One",
        classCodes: ["OPEN"],
      },
    ],
  });

  expect(setup.runs[0]).toMatchObject({
    id: "local-run-1",
    runId: "hsp-run-1",
    blockRunId: "hsp-block-run-1",
    entryId: "entry-1",
    classId: "hsp-block-1",
    divisionId: "division-1",
    horseId: "horse-1",
    riderContactId: "rider-1",
    ownerContactId: "owner-1",
    payerContactId: "payer-1",
    entryIds: ["entry-1", "entry-2"],
    divisionIds: ["division-1", "division-2"],
    divisionNames: ["Open", "Non Pro"],
    isLate: true,
    drawGroup: "drag-1",
    classCodes: ["OPEN"],
  });
});

test("normalizes a self-contained HSP draw into ShowScore setup data", () => {
  const importedDraw = normalizeHspDrawImport({
    organizationId: "org-1",
    showId: "show-1",
    blockId: "block-1",
    divisions: [
      { id: "division-open", code: "OPEN", name: "Open" },
      { id: "division-np", code: "NP", name: "Non Pro" },
    ],
    runs: [
      {
        runId: "run-101",
        blockRunId: "block-run-101",
        orderOfGo: 2,
        backNumber: "101",
        rider: "Rider One",
        horse: "Horse One",
        owner: "Owner One",
        horseId: "horse-1",
        riderContactId: "rider-1",
        ownerContactId: "owner-1",
        entries: [
          { entryId: "entry-open", divisionId: "division-open" },
          { entryId: "entry-np", divisionId: "division-np" },
        ],
      },
      {
        runId: "run-202",
        blockRunId: "block-run-202",
        orderOfGo: 1,
        backNumber: "202",
        rider: "Rider Two",
        horse: "Horse Two",
        owner: "Owner Two",
        entries: [{ entryId: "entry-np-2", divisionId: "division-np" }],
      },
    ],
  });

  expect(importedDraw.blockClasses).toMatchObject([
    { divisionId: "division-open", code: "OPEN", name: "Open" },
    { divisionId: "division-np", code: "NP", name: "Non Pro" },
  ]);
  expect(importedDraw.runs).toMatchObject([
    {
      id: "run-202",
      runId: "run-202",
      blockRunId: "block-run-202",
      draw: 1,
      backNumber: "202",
      classCodes: ["NP"],
      entryIds: ["entry-np-2"],
      divisionIds: ["division-np"],
    },
    {
      id: "run-101",
      runId: "run-101",
      blockRunId: "block-run-101",
      draw: 2,
      backNumber: "101",
      classCodes: ["OPEN", "NP"],
      entryIds: ["entry-open", "entry-np"],
      divisionIds: ["division-open", "division-np"],
      horseId: "horse-1",
      riderContactId: "rider-1",
      ownerContactId: "owner-1",
    },
  ]);
  expect(importedDraw.source).toMatchObject({
    type: "hsp",
    organizationId: "org-1",
    showId: "show-1",
    blockId: "block-1",
  });
});

test("collapses concurrent HSP blocks into one ShowScore scoring run", () => {
  const importedDraw = normalizeHspDrawImport({
    showId: "show-1",
    concurrentBlocks: [
      {
        id: "block-open",
        divisions: [{ id: "division-open", code: "OPEN", name: "Open" }],
        runs: [
          {
            runId: "physical-run-101",
            blockRunId: "block-run-open-101",
            orderOfGo: 1,
            backNumber: "101",
            rider: "Rider One",
            horse: "Horse One",
            owner: "Owner One",
            entries: [{ entryId: "entry-open", divisionId: "division-open" }],
          },
        ],
      },
      {
        id: "block-np",
        divisions: [{ id: "division-np", code: "NP", name: "Non Pro" }],
        runs: [
          {
            runId: "physical-run-101",
            blockRunId: "block-run-np-101",
            orderOfGo: 1,
            backNumber: "101",
            rider: "Rider One",
            horse: "Horse One",
            owner: "Owner One",
            entries: [{ entryId: "entry-np", divisionId: "division-np" }],
          },
        ],
      },
    ],
  });

  expect(importedDraw.blockClasses).toMatchObject([
    {
      divisionId: "division-open",
      classId: "block-open",
      blockId: "block-open",
      code: "OPEN",
    },
    {
      divisionId: "division-np",
      classId: "block-np",
      blockId: "block-np",
      code: "NP",
    },
  ]);
  expect(importedDraw.runs).toHaveLength(1);
  expect(importedDraw.runs[0]).toMatchObject({
    id: "physical-run-101",
    runId: "physical-run-101",
    draw: 1,
    backNumber: "101",
    classCodes: ["OPEN", "NP"],
    entryIds: ["entry-open", "entry-np"],
    divisionIds: ["division-open", "division-np"],
    blockRunIds: ["block-run-open-101", "block-run-np-101"],
    classIds: ["block-open", "block-np"],
    blockIds: ["block-open", "block-np"],
  });
});

test("resolves concurrent HSP classes to one ShowScore scoring class", () => {
  const classes = [
    {
      id: "block-main",
      name: "Open block",
      sortOrder: 1,
      eligibilityRules: {},
    },
    {
      id: "block-np",
      name: "Non Pro block",
      sortOrder: 2,
      eligibilityRules: {
        concurrent_class_id: "block-main",
        concurrent_group_label: "Open + Non Pro",
      },
    },
    {
      id: "block-rookie",
      name: "Rookie block",
      sortOrder: 3,
      eligibilityRules: {
        concurrent_class_id: "block-np",
      },
    },
  ];

  expect(resolveClassScoringId("block-main", classes)).toBe("block-main");
  expect(resolveClassScoringId("block-np", classes)).toBe("block-main");
  expect(resolveClassScoringId("block-rookie", classes)).toBe("block-main");
  expect(getUniqueScoringClasses(classes).map((classItem) => classItem.id)).toEqual([
    "block-main",
  ]);
});

test("builds HSP scored run rows as one validated batch", () => {
  const rows = buildHspScoredRunRows({
    classItem: { showId: "show-1" },
    setup: {
      hspSource: { showId: "show-from-draw" },
    },
    scoredAt: "2026-06-14T10:00:00.000Z",
    runs: [
      {
        id: "local-1",
        runId: "run-1",
        backNumber: "101",
        riderContactId: "rider-1",
        horseId: "horse-1",
        ownerContactId: "owner-1",
        scoreTotal: "72.5",
      },
      {
        id: "local-2",
        runId: "run-2",
        backNumber: "102",
        scoreTotal: "SCR",
      },
      {
        id: "local-3",
        runId: "run-3",
        backNumber: "103",
        scoreTotal: "NS",
      },
      {
        id: "local-4",
        runId: "run-4",
        backNumber: "104",
        scoreTotal: "DQ",
      },
      {
        id: "standalone-pdf-run",
        backNumber: "105",
        scoreTotal: "70",
      },
    ],
  });

  expect(rows).toEqual([
    {
      run_id: "run-1",
      show_id: "show-from-draw",
      back_number: "101",
      rider_id: "rider-1",
      horse_id: "horse-1",
      owner_id: "owner-1",
      scored_at: "2026-06-14T10:00:00.000Z",
      status: "scored",
      final_score: 72.5,
    },
    {
      run_id: "run-2",
      show_id: "show-from-draw",
      back_number: "102",
      rider_id: null,
      horse_id: null,
      owner_id: null,
      scored_at: "2026-06-14T10:00:00.000Z",
      status: "scratch",
      final_score: null,
    },
    {
      run_id: "run-3",
      show_id: "show-from-draw",
      back_number: "103",
      rider_id: null,
      horse_id: null,
      owner_id: null,
      scored_at: "2026-06-14T10:00:00.000Z",
      status: "no_score",
      final_score: null,
    },
    {
      run_id: "run-4",
      show_id: "show-from-draw",
      back_number: "104",
      rider_id: null,
      horse_id: null,
      owner_id: null,
      scored_at: "2026-06-14T10:00:00.000Z",
      status: "disqualified",
      final_score: null,
    },
  ]);
});

test("builds ShowScore setup from the current HSP run adapter shape", () => {
  const setup = buildClassSetupFromHspDraw({
    showId: "show-1",
    classId: "block-1",
    runs: [
      {
        id: "entry-1",
        entryId: "entry-1",
        classId: "block-1",
        divisionId: "division-open",
        horseId: "horse-1",
        riderContactId: "rider-1",
        ownerContactId: "owner-1",
        payerContactId: "payer-1",
        order: 1,
        draw: 1,
        backNumber: "101",
        rider: "Rider One",
        horse: "Horse One",
        owner: "Owner One",
        divisionNames: ["OPEN - Open"],
        isLate: false,
        drawGroup: "regular",
      },
    ],
  });

  expect(setup.isDrawImported).toBe(true);
  expect(setup.blockClasses).toMatchObject([
    { divisionId: "division-open", code: "OPEN", name: "Open" },
  ]);
  expect(setup.runs[0]).toMatchObject({
    id: "entry-1",
    runId: "entry-1",
    entryId: "entry-1",
    classId: "block-1",
    divisionId: "division-open",
    horseId: "horse-1",
    riderContactId: "rider-1",
    ownerContactId: "owner-1",
    payerContactId: "payer-1",
    classCodes: ["OPEN"],
    divisionNames: ["Open"],
    drawGroup: "regular",
  });
});

test("public live class view derives standings from setup class codes", () => {
  const view = buildPublicLiveClassView({
    classItem: {
      id: "class-live-standings",
      name: "Novice Horse Block",
      pattern: "RR1",
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE_SCORING,
    },
    setup: {
      pattern: "RR1",
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
      ],
    },
    scoringSession: {
      runs: [
        {
          id: "run-1",
          draw: 1,
          scoreTotal: "72.0",
          isComplete: true,
        },
      ],
    },
  });

  expect(view.classStandings.map((group) => group.code)).toEqual(["NHO", "NH2"]);
  expect(view.classStandings[0].entries[0]).toMatchObject({
    backNumber: "101",
    rider: "Open Rider",
    scoreTotal: "72",
  });
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

test("secretariat can approve completed announcer results without publishing a scoresheet", async () => {
  const classData = {
    classItem: {
      id: "class-announcer-results",
      name: "Derby block",
      pattern: "R1",
    },
    setup: {
      pattern: "R1",
      blockClasses: [
        { code: "105", name: "Rookie" },
        { code: "110", name: "Non Pro" },
      ],
      runs: [
        {
          id: "run-1",
          draw: 1,
          rider: "Alice",
          horse: "Smart Horse",
          classCodes: ["105", "110"],
        },
        {
          id: "run-2",
          draw: 2,
          rider: "Bob",
          horse: "Quick Horse",
          classCodes: ["105"],
        },
      ],
    },
    official: {
      isFinalized: false,
      isSecretariatValidated: false,
      officialRuns: [],
    },
    announcerSession: {
      completedAt: "2026-07-23T12:10:00.000Z",
      updatedAt: "2026-07-23T12:10:00.000Z",
      runs: [
        {
          id: "run-1",
          draw: 1,
          rider: "Alice",
          horse: "Smart Horse",
          classCodes: ["105", "110"],
          status: "scored",
          scoreTotal: "72.5",
        },
        {
          id: "run-2",
          draw: 2,
          rider: "Bob",
          horse: "Quick Horse",
          classCodes: ["105"],
          status: "scored",
          scoreTotal: "71",
        },
      ],
    },
    scoringRuns: [],
  };

  expect(hasCompletedAnnouncerResults(classData)).toBe(true);

  const officialResult = await validateAnnouncerResultsRepository({
    classData,
    validatedAt: "2026-07-23T12:15:00.000Z",
  });
  const approvedClassData = {
    ...classData,
    official: {
      ...classData.official,
      ...officialResult,
      isFinalized: officialResult.finalized,
      isSecretariatValidated: Boolean(
        officialResult.secretariatValidatedAt
      ),
    },
  };
  const groups = buildClassResultGroups(approvedClassData);

  expect(officialResult).toMatchObject({
    finalized: false,
    judgeSignature: null,
    secretariatValidatedAt: "2026-07-23T12:15:00.000Z",
  });
  expect(officialResult.officialRuns).toHaveLength(2);
  expect(getPublicationState("class-announcer-results").status).toBe(
    PUBLICATION_STATUSES.HIDDEN
  );
  expect(isClassResultsSecretariatApproved(approvedClassData)).toBe(true);
  expect(isAnnouncerResultsApproval(approvedClassData)).toBe(true);
  expect(groups.map((group) => group.code)).toEqual(["105", "110"]);
  expect(groups[0].entries.map((entry) => entry.rider)).toEqual([
    "Alice",
    "Bob",
  ]);

  const publication = await publishClassResultsRepository({
    classData: approvedClassData,
    publishedBy: "secretariat",
  });

  expect(publication.status).toBe(RESULT_PUBLICATION_STATUSES.PUBLISHED);
  expect(publication.resultGroups.map((group) => group.code)).toEqual([
    "105",
    "110",
  ]);
  expect(
    isClassResultsSecretariatApproved({
      ...approvedClassData,
      announcerSession: {
        ...approvedClassData.announcerSession,
        updatedAt: "2026-07-23T12:16:00.000Z",
      },
    })
  ).toBe(false);
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
          scoreTotal: "69.5",
          scores: ["+0.5", ""],
          penalties: ["", ""],
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
  expect(classView.latestScore.draw).toBe(3);
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

test("public show view keeps one live class per arena", () => {
  saveActiveTestShow("show-live-arenas");
  saveDays([
    {
      id: "day-live-arenas",
      showId: "show-live-arenas",
      label: "Jour 1",
      date: "2026-06-15",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "arena-a-first",
      showId: "show-live-arenas",
      dayId: "day-live-arenas",
      name: "Arena A first",
      arena: "Arena A",
      pattern: "2",
      sortOrder: 1,
    },
    {
      id: "arena-a-second",
      showId: "show-live-arenas",
      dayId: "day-live-arenas",
      name: "Arena A second",
      arena: "Arena A",
      pattern: "2",
      sortOrder: 2,
    },
    {
      id: "arena-b-first",
      showId: "show-live-arenas",
      dayId: "day-live-arenas",
      name: "Arena B first",
      arena: "Arena B",
      pattern: "2",
      sortOrder: 3,
    },
  ]);
  savePublicationState("arena-a-first", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });
  savePublicationState("arena-a-second", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });
  savePublicationState("arena-b-first", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  const view = getPublicShowView("show-live-arenas");

  expect(view.liveClasses.map((classView) => classView.classId)).toEqual([
    "arena-a-first",
    "arena-b-first",
  ]);
  expect(view.liveClassCount).toBe(2);
});

test("setting an arena live class hides only the previous live in that arena", async () => {
  saveClasses([
    {
      id: "arena-main-current",
      showId: "show-current-live",
      dayId: "day-current-live",
      name: "Main current",
      arena: "Main",
      sortOrder: 1,
    },
    {
      id: "arena-main-next",
      showId: "show-current-live",
      dayId: "day-current-live",
      name: "Main next",
      arena: "Main",
      sortOrder: 2,
    },
    {
      id: "arena-secondary-current",
      showId: "show-current-live",
      dayId: "day-current-live",
      name: "Secondary current",
      arena: "Secondary",
      sortOrder: 3,
    },
  ]);
  savePublicationState("arena-main-current", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });
  savePublicationState("arena-secondary-current", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  await saveArenaCurrentLiveClassRepository({
    showId: "show-current-live",
    arena: "Main",
    classId: "arena-main-next",
    status: PUBLICATION_STATUSES.LIVE_SCORING,
  });

  expect(getPublicationState("arena-main-current").status).toBe(
    PUBLICATION_STATUSES.HIDDEN
  );
  expect(getPublicationState("arena-main-next").status).toBe(
    PUBLICATION_STATUSES.LIVE_SCORING
  );
  expect(getPublicationState("arena-secondary-current").status).toBe(
    PUBLICATION_STATUSES.LIVE_NO_SCORE
  );
});

test("completed arena live advances to the next class in the same arena", async () => {
  saveDays([
    {
      id: "day-advance-live",
      showId: "show-advance-live",
      label: "Jour 1",
      date: "2026-06-15",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "advance-main-current",
      showId: "show-advance-live",
      dayId: "day-advance-live",
      name: "Main current",
      arena: "Main",
      sortOrder: 1,
    },
    {
      id: "advance-main-next",
      showId: "show-advance-live",
      dayId: "day-advance-live",
      name: "Main next",
      arena: "Main",
      sortOrder: 2,
    },
    {
      id: "advance-secondary-current",
      showId: "show-advance-live",
      dayId: "day-advance-live",
      name: "Secondary current",
      arena: "Secondary",
      sortOrder: 3,
    },
  ]);
  savePublicationState("advance-main-current", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });
  savePublicationState("advance-secondary-current", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  await advanceArenaLiveClassAfterCompletionRepository({
    showId: "show-advance-live",
    arena: "Main",
    classId: "advance-main-current",
  });

  expect(getPublicationState("advance-main-current").status).toBe(
    PUBLICATION_STATUSES.HIDDEN
  );
  expect(getPublicationState("advance-main-next").status).toBe(
    PUBLICATION_STATUSES.LIVE_SCORING
  );
  expect(getPublicationState("advance-secondary-current").status).toBe(
    PUBLICATION_STATUSES.LIVE_NO_SCORE
  );
});

test("completed arena live advances to the next paid warmup in the same arena", async () => {
  saveDays([
    {
      id: "day-advance-warmup",
      showId: "show-advance-warmup",
      label: "Jour 1",
      date: "2026-06-15",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "advance-warmup-current",
      showId: "show-advance-warmup",
      dayId: "day-advance-warmup",
      name: "Main current",
      arena: "Main",
      sortOrder: 1,
    },
    {
      id: "advance-warmup-next-class",
      showId: "show-advance-warmup",
      dayId: "day-advance-warmup",
      name: "Main next class",
      arena: "Main",
      sortOrder: 3,
    },
  ]);
  savePaidWarmup({
    id: "advance-warmup-next",
    showId: "show-advance-warmup",
    dayId: "day-advance-warmup",
    name: "Paid warm up next",
    arena: "Main",
    sortOrder: 2,
    entries: [{ id: "entry-1", rider: "Marie", status: "pending" }],
  });
  savePublicationState("advance-warmup-current", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  await advanceArenaLiveClassAfterCompletionRepository({
    showId: "show-advance-warmup",
    arena: "Main",
    classId: "advance-warmup-current",
  });

  expect(getPublicationState("advance-warmup-current").status).toBe(
    PUBLICATION_STATUSES.HIDDEN
  );
  expect(getPaidWarmupById("advance-warmup-next").isPublicLive).toBe(true);
  expect(getPublicationState("advance-warmup-next-class").status).toBe(
    PUBLICATION_STATUSES.HIDDEN
  );
});

test("completed paid warmup advances to the next class in the same arena", async () => {
  saveDays([
    {
      id: "day-warmup-advance-class",
      showId: "show-warmup-advance-class",
      label: "Jour 1",
      date: "2026-06-15",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "warmup-advance-class-next",
      showId: "show-warmup-advance-class",
      dayId: "day-warmup-advance-class",
      name: "Main next",
      arena: "Main",
      sortOrder: 2,
    },
    {
      id: "warmup-advance-secondary",
      showId: "show-warmup-advance-class",
      dayId: "day-warmup-advance-class",
      name: "Secondary current",
      arena: "Secondary",
      sortOrder: 3,
    },
  ]);
  savePaidWarmup({
    id: "warmup-advance-current",
    showId: "show-warmup-advance-class",
    dayId: "day-warmup-advance-class",
    name: "Paid warm up current",
    arena: "Main",
    sortOrder: 1,
    isPublicLive: true,
    entries: [{ id: "entry-1", rider: "Marie", status: "done" }],
  });
  savePublicationState("warmup-advance-secondary", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  await advanceArenaLivePaidWarmupAfterCompletionRepository({
    showId: "show-warmup-advance-class",
    arena: "Main",
    paidWarmupId: "warmup-advance-current",
  });

  expect(getPaidWarmupById("warmup-advance-current").isPublicLive).toBe(false);
  expect(getPublicationState("warmup-advance-class-next").status).toBe(
    PUBLICATION_STATUSES.LIVE_SCORING
  );
  expect(getPublicationState("warmup-advance-secondary").status).toBe(
    PUBLICATION_STATUSES.LIVE_NO_SCORE
  );
});

test("public live shows a pending paid warmup scheduled before a live class", () => {
  saveActiveTestShow("show-public-warmup-before-class");
  saveDays([
    {
      id: "day-public-warmup-before-class",
      showId: "show-public-warmup-before-class",
      label: "Jour 1",
      date: "2026-06-15",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "public-warmup-live-class",
      showId: "show-public-warmup-before-class",
      dayId: "day-public-warmup-before-class",
      name: "First class",
      arena: "Main",
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "10:30",
      sortOrder: 2,
    },
  ]);
  savePaidWarmup({
    id: "public-warmup-before-class",
    showId: "show-public-warmup-before-class",
    dayId: "day-public-warmup-before-class",
    name: "Morning paid warm up",
    isPublicLive: true,
    sortOrder: 1,
    entries: [{ id: "entry-1", rider: "Marie", status: "pending" }],
  });
  savePublicationState("public-warmup-live-class", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  const publicView = getPublicShowView("show-public-warmup-before-class");

  expect(publicView.liveClasses).toEqual([]);
  expect(publicView.livePaidWarmup).toMatchObject({
    id: "public-warmup-before-class",
    name: "Morning paid warm up",
    arena: "Main",
  });
  expect(publicView.livePaidWarmup.nextScheduleItem).toMatchObject({
    itemId: "public-warmup-live-class",
    name: "First class",
    arena: "Main",
    startKind: "fixed",
  });
  expect(publicView.livePaidWarmup.nextScheduleItem.startAt).toBeTruthy();
});

test("public live does not show a paid warmup when public live is disabled", () => {
  saveActiveTestShow("show-public-warmup-disabled");
  saveDays([
    {
      id: "day-public-warmup-disabled",
      showId: "show-public-warmup-disabled",
      label: "Jour 1",
      date: "2026-06-15",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "public-warmup-disabled-class",
      showId: "show-public-warmup-disabled",
      dayId: "day-public-warmup-disabled",
      name: "First class",
      arena: "Main",
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "10:30",
      sortOrder: 2,
    },
  ]);
  savePaidWarmup({
    id: "public-warmup-disabled",
    showId: "show-public-warmup-disabled",
    dayId: "day-public-warmup-disabled",
    name: "Disabled paid warm up",
    isPublicLive: false,
    sortOrder: 1,
    entries: [{ id: "entry-1", rider: "Marie", status: "pending" }],
  });
  savePublicationState("public-warmup-disabled-class", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  const publicView = getPublicShowView("show-public-warmup-disabled");

  expect(publicView.livePaidWarmup).toBeNull();
  expect(publicView.livePaidWarmups).toEqual([]);
  expect(publicView.liveClasses).toHaveLength(1);
  expect(publicView.liveClasses[0]).toMatchObject({
    classId: "public-warmup-disabled-class",
  });
});

test("public live skips completed paid warmups even when their public flag is still on", () => {
  saveActiveTestShow("show-public-warmup-complete");
  saveDays([
    {
      id: "day-public-warmup-complete",
      showId: "show-public-warmup-complete",
      label: "Jour 1",
      date: "2026-06-15",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "public-warmup-complete-class",
      showId: "show-public-warmup-complete",
      dayId: "day-public-warmup-complete",
      name: "First class",
      arena: "Main",
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "10:30",
      sortOrder: 2,
    },
  ]);
  savePaidWarmup({
    id: "public-warmup-complete",
    showId: "show-public-warmup-complete",
    dayId: "day-public-warmup-complete",
    name: "Completed paid warm up",
    isPublicLive: true,
    sortOrder: 1,
    entries: [{ id: "entry-1", rider: "Marie", status: "done" }],
  });
  savePublicationState("public-warmup-complete-class", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  const publicView = getPublicShowView("show-public-warmup-complete");

  expect(publicView.livePaidWarmup).toBeNull();
  expect(publicView.livePaidWarmups).toEqual([]);
  expect(publicView.liveClasses).toHaveLength(1);
  expect(publicView.liveClasses[0]).toMatchObject({
    classId: "public-warmup-complete-class",
  });
});

test("public live estimates the next block from a fixed paid warmup start", () => {
  saveActiveTestShow("show-public-warmup-fixed-start");
  saveDays([
    {
      id: "day-public-warmup-fixed-start",
      showId: "show-public-warmup-fixed-start",
      label: "Vendredi",
      date: "2026-06-26",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "public-warmup-fixed-next-class",
      showId: "show-public-warmup-fixed-start",
      dayId: "day-public-warmup-fixed-start",
      name: "Novice Horse",
      arena: "Main",
      scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
      sortOrder: 2,
    },
  ]);
  savePaidWarmup({
    id: "public-warmup-fixed-start",
    showId: "show-public-warmup-fixed-start",
    dayId: "day-public-warmup-fixed-start",
    name: "Warm-up vendredi 40 chevaux",
    arena: "Main",
    scheduleStartMode: CLASS_START_MODE_FIXED,
    scheduleStartTime: "07:00",
    durationMinutesPerRider: 7,
    isPublicLive: true,
    entries: Array.from({ length: 40 }, (_, index) => ({
      id: `entry-${index + 1}`,
      rider: `Rider ${index + 1}`,
      status: "pending",
    })),
    sortOrder: 1,
  });
  savePublicationState("public-warmup-fixed-next-class", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  const publicView = getPublicShowView("show-public-warmup-fixed-start");
  const nextItem = publicView.livePaidWarmup.nextScheduleItem;
  const start = new Date(nextItem.startAt);

  expect(nextItem).toMatchObject({
    itemId: "public-warmup-fixed-next-class",
    name: "Novice Horse",
    startKind: "estimated",
  });
  expect(start.getFullYear()).toBe(2026);
  expect(start.getMonth()).toBe(5);
  expect(start.getDate()).toBe(26);
  expect(start.getHours()).toBe(11);
  expect(start.getMinutes()).toBe(40);
});

test("public live hides now-based next block estimates when schedule has no anchor", () => {
  saveActiveTestShow("show-public-warmup-unanchored");
  saveDays([
    {
      id: "day-public-warmup-unanchored",
      showId: "show-public-warmup-unanchored",
      label: "Vendredi",
      date: "2026-06-26",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "public-warmup-unanchored-next-class",
      showId: "show-public-warmup-unanchored",
      dayId: "day-public-warmup-unanchored",
      name: "Novice Horse",
      arena: "Main",
      scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
      sortOrder: 2,
    },
  ]);
  savePaidWarmup({
    id: "public-warmup-unanchored",
    showId: "show-public-warmup-unanchored",
    dayId: "day-public-warmup-unanchored",
    name: "Warm-up vendredi 40 chevaux",
    arena: "Main",
    scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
    durationMinutesPerRider: 7,
    isPublicLive: true,
    entries: Array.from({ length: 40 }, (_, index) => ({
      id: `entry-${index + 1}`,
      rider: `Rider ${index + 1}`,
      status: "pending",
    })),
    sortOrder: 1,
  });
  savePublicationState("public-warmup-unanchored-next-class", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });

  const publicView = getPublicShowView("show-public-warmup-unanchored");
  const nextItem = publicView.livePaidWarmup.nextScheduleItem;

  expect(nextItem).toMatchObject({
    itemId: "public-warmup-unanchored-next-class",
    dayDate: "2026-06-26",
    startAt: null,
    startKind: "unknown",
  });
});

test("completed live skips the next class when its planned live is hidden", async () => {
  saveDays([
    {
      id: "day-advance-skip-hidden",
      showId: "show-advance-skip-hidden",
      label: "Jour 1",
      date: "2026-06-15",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "advance-skip-current",
      showId: "show-advance-skip-hidden",
      dayId: "day-advance-skip-hidden",
      name: "Main current",
      arena: "Main",
      sortOrder: 1,
    },
    {
      id: "advance-skip-hidden",
      showId: "show-advance-skip-hidden",
      dayId: "day-advance-skip-hidden",
      name: "Skip me",
      arena: "Main",
      sortOrder: 2,
    },
    {
      id: "advance-skip-next-live",
      showId: "show-advance-skip-hidden",
      dayId: "day-advance-skip-hidden",
      name: "Next live",
      arena: "Main",
      sortOrder: 3,
    },
  ]);
  savePublicationState("advance-skip-current", {
    status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
  });
  savePublicationState("advance-skip-hidden", {
    plannedLiveStatus: PUBLICATION_STATUSES.HIDDEN,
  });
  savePublicationState("advance-skip-next-live", {
    plannedLiveStatus: PUBLICATION_STATUSES.LIVE,
  });

  await advanceArenaLiveClassAfterCompletionRepository({
    showId: "show-advance-skip-hidden",
    arena: "Main",
    classId: "advance-skip-current",
  });

  expect(getPublicationState("advance-skip-current").status).toBe(
    PUBLICATION_STATUSES.HIDDEN
  );
  expect(getPublicationState("advance-skip-hidden").status).toBe(
    PUBLICATION_STATUSES.HIDDEN
  );
  expect(getPublicationState("advance-skip-next-live").status).toBe(
    PUBLICATION_STATUSES.LIVE
  );
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

test("public live view exposes a planned drag before the next run", () => {
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
  expect(classView.dragBreak).toBeNull();
  expect(classView.nextLiveItem).toMatchObject({
    type: "drag",
    afterDraw: 2,
    durationMinutes: 8,
    liveOrderStatus: "preparation",
  });
  expect(classView.secondNextLiveItem).toMatchObject({
    draw: 3,
    liveOrderStatus: "waiting",
  });
  expect(classView.orderRuns.map((item) => item.liveOrderStatus)).toEqual([
    "passed",
    "passed",
    "preparation",
    "waiting",
  ]);
});

test("public live view exposes an active drag only after the scribe starts it", () => {
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
      activeManoeuvre: {
        type: "drag",
        afterIndex: 1,
        afterDraw: 2,
        startedAt: "2026-05-25T14:03:00.000Z",
        durationMinutes: 8,
      },
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
  expect(classView.activeDragItem).toMatchObject({
    type: "drag",
    afterDraw: 2,
    startedAt: "2026-05-25T14:03:00.000Z",
    durationMinutes: 8,
  });
  expect(classView.nextLiveItem).toMatchObject({
    draw: 3,
    liveOrderStatus: "preparation",
  });
  expect(classView.dragBreak).toMatchObject({
    isActive: true,
    startedAt: "2026-05-25T14:03:00.000Z",
    durationMinutes: 8,
    durationSeconds: 480,
  });
  expect(classView.dragBreak.nextRun.draw).toBe(3);
});

test("active class drag overrides a stale selected competitor", () => {
  const scoringRuns = [
    {
      id: "run-1",
      draw: 1,
      scoreTotal: "71.0",
      completedAt: "2026-05-25T14:00:00.000Z",
    },
    {
      id: "run-2",
      draw: 2,
      isActive: true,
      scoreTotal: "72.0",
      completedAt: "2026-05-25T14:03:00.000Z",
    },
    {
      id: "run-3",
      draw: 3,
      scoreTotal: "",
    },
  ];
  const activeDrag = {
    type: "drag",
    afterIndex: 1,
    afterDraw: 2,
    startedAt: "2026-05-25T14:03:00.000Z",
    durationMinutes: 8,
  };

  const publicClassView = buildPublicLiveClassView({
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
      activeManoeuvre: activeDrag,
      runs: scoringRuns,
    },
  });

  expect(publicClassView.activeRun).toBeNull();
  expect(publicClassView.activeDragItem).toMatchObject({
    type: "drag",
    afterDraw: 2,
  });
  expect(publicClassView.dragBreak).toMatchObject({
    isActive: true,
    nextRun: expect.objectContaining({ draw: 3 }),
  });

  saveActiveManoeuvre("class-announcer-drag", activeDrag);
  const announcerClassView = buildAnnouncerClassView({
    classItem: {
      id: "class-announcer-drag",
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
    scoringRuns,
  });

  expect(announcerClassView.activeRun).toBeNull();
  expect(announcerClassView.activeDragItem).toMatchObject({
    type: "drag",
    afterDraw: 2,
  });
  expect(announcerClassView.nextLiveItem).toMatchObject({
    draw: 3,
    liveOrderStatus: "preparation",
  });
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

test("paid warmup live stages the next rider before the timer starts", () => {
  const liveView = buildPaidWarmupLiveView({
    id: "warmup-staged",
    name: "Paid warm up",
    entries: [
      { id: "entry-1", rider: "Marie", status: "pending" },
      { id: "entry-2", rider: "Alex", status: "pending" },
      { id: "entry-3", rider: "Félix", status: "pending" },
    ],
  });

  expect(liveView.activeEntry).toBeNull();
  expect(liveView.stagedEntry.rider).toBe("Marie");
  expect(liveView.onCourseEntry.rider).toBe("Marie");
  expect(liveView.nextEntry.rider).toBe("Alex");
  expect(liveView.secondNextEntry.rider).toBe("Félix");
});

test("paid warmup live rolls riders forward when staged rider is marked done", () => {
  const warmup = {
    id: "warmup-roll",
    name: "Paid warm up",
    entries: [
      { id: "entry-1", rider: "Marie", status: "pending" },
      { id: "entry-2", rider: "Alex", status: "pending" },
      { id: "entry-3", rider: "Félix", status: "pending" },
      { id: "entry-4", rider: "Late add", status: "pending" },
    ],
  };
  const liveView = buildPaidWarmupLiveView(warmup);
  const nextWarmup = setPaidWarmupEntryStatus(
    liveView,
    liveView.stagedEntry.id,
    "done",
    new Date("2026-05-25T14:00:00.000Z")
  );
  const nextLiveView = buildPaidWarmupLiveView(nextWarmup);

  expect(nextLiveView.activeEntry).toBeNull();
  expect(nextLiveView.stagedEntry.rider).toBe("Alex");
  expect(nextLiveView.onCourseEntry.rider).toBe("Alex");
  expect(nextLiveView.nextEntry.rider).toBe("Félix");
  expect(nextLiveView.secondNextEntry.rider).toBe("Late add");
  expect(nextLiveView.lastPassedEntries[0].rider).toBe("Marie");
});

test("paid warmup drag starts explicitly and stays completed after stopping", () => {
  const warmup = {
    id: "warmup-drag",
    name: "Paid warm up",
    dragInterval: 1,
    dragDurationMinutes: 6,
    entries: [
      {
        id: "entry-1",
        rider: "Marie",
        status: "done",
        completedAt: "2026-05-25T14:00:00.000Z",
      },
      { id: "entry-2", rider: "Alex", status: "pending" },
      { id: "entry-3", rider: "Félix", status: "pending" },
    ],
  };
  const plannedView = buildPaidWarmupLiveView(warmup);
  const activeWarmup = startPaidWarmupDrag(
    warmup,
    new Date("2026-05-25T14:02:00.000Z")
  );
  const activeView = buildPaidWarmupLiveView(
    activeWarmup,
    new Date("2026-05-25T14:03:00.000Z")
  );
  const stoppedWarmup = stopPaidWarmupDrag(activeView);
  const stoppedView = buildPaidWarmupLiveView(stoppedWarmup);

  expect(plannedView.nextLiveItem).toMatchObject({
    type: "drag",
    afterDraw: 1,
  });
  expect(activeView.activeDragItem).toMatchObject({
    type: "drag",
    afterDraw: 1,
    startedAt: "2026-05-25T14:02:00.000Z",
  });
  expect(activeView.isDragDue).toBe(true);
  expect(stoppedView.activeDragItem).toBeNull();
  expect(stoppedView.plannedDragItem).toBeNull();
  expect(stoppedView.onCourseEntry).toMatchObject({
    rider: "Alex",
  });
  expect(stoppedView.nextLiveItem).toMatchObject({
    type: "drag",
    afterDraw: 2,
  });
});

test("paid warmup draw replacement preserves live progress for known riders", () => {
  const warmup = {
    id: "warmup-1",
    name: "Paid warm up",
    activeEntryId: "entry-2",
    activeStartedAt: "2026-05-25T14:00:00.000Z",
    entries: [
      {
        id: "entry-1",
        rider: "Marie Tremblay",
        status: "done",
        completedAt: "2026-05-25T13:55:00.000Z",
      },
      { id: "entry-2", rider: "Alex Martin", status: "pending" },
      { id: "entry-3", rider: "Félix Goudreau", status: "pending" },
    ],
  };
  const nextWarmup = mergePaidWarmupEntriesForReplacement(warmup, [
    { id: "new-1", rider: "Félix Goudreau", status: "pending" },
    { id: "new-2", rider: "Alex Martin", status: "pending" },
    { id: "new-3", rider: "Late add", status: "pending" },
    { id: "new-4", rider: "Marie Tremblay", status: "pending" },
  ]);
  const liveView = buildPaidWarmupLiveView(nextWarmup);

  expect(nextWarmup.entries.map((entry) => entry.rider)).toEqual([
    "Félix Goudreau",
    "Alex Martin",
    "Late add",
    "Marie Tremblay",
  ]);
  expect(nextWarmup.entries.map((entry) => entry.order)).toEqual([1, 2, 3, 4]);
  expect(nextWarmup.entries.find((entry) => entry.rider === "Alex Martin")).toMatchObject({
    id: "entry-2",
    status: "pending",
  });
  expect(nextWarmup.entries.find((entry) => entry.rider === "Marie Tremblay")).toMatchObject({
    id: "entry-1",
    status: "done",
    completedAt: "2026-05-25T13:55:00.000Z",
  });
  expect(nextWarmup.activeEntryId).toBe("entry-2");
  expect(nextWarmup.activeStartedAt).toBe("2026-05-25T14:00:00.000Z");
  expect(liveView.activeEntry.rider).toBe("Alex Martin");
  expect(liveView.nextEntry.rider).toBe("Late add");
});

test("public show view exposes a public paid warmup before the timer starts", () => {
  saveActiveTestShow("show-public-warmup", "association-public-warmup");
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
      { id: "entry-3", rider: "Félix", status: "pending" },
    ],
  });

  const publicView = getPublicShowView("show-public-warmup");

  expect(publicView.liveClassCount).toBe(1);
  expect(publicView.livePaidWarmup).toMatchObject({
    id: "warmup-public",
    name: "Warm up public",
  });
  expect(publicView.livePaidWarmup.activeEntry).toBeNull();
  expect(publicView.livePaidWarmup.stagedEntry).toMatchObject({
    rider: "Marie",
  });
  expect(publicView.livePaidWarmup.onCourseEntry).toMatchObject({
    rider: "Marie",
  });
  expect(publicView.livePaidWarmup.nextEntry).toMatchObject({
    rider: "Alex",
  });
  expect(publicView.livePaidWarmup.secondNextEntry).toMatchObject({
    rider: "Félix",
  });
  expect(
    publicView.livePaidWarmup.entries.map((entry) => ({
      order: entry.order,
      rider: entry.rider,
    }))
  ).toEqual([
    { order: 1, rider: "Marie" },
    { order: 2, rider: "Alex" },
    { order: 3, rider: "Félix" },
  ]);
});

test("public show view hides draft shows even when public toggles are enabled", () => {
  const show = {
    id: "show-public-draft",
    associationId: "association-public-draft",
    name: "Draft public show",
    status: "draft",
    isSchedulePublic: true,
    isLivestreamPublic: true,
    livestreamUrl: "https://youtu.be/draftshow",
  };

  saveShows([show]);
  saveDays([
    {
      id: "day-public-draft",
      associationId: show.associationId,
      showId: show.id,
      label: "Friday",
      date: "2026-06-01",
      sortOrder: 1,
    },
  ]);
  saveClasses([
    {
      id: "class-public-draft",
      associationId: show.associationId,
      showId: show.id,
      dayId: "day-public-draft",
      name: "Draft class",
      pattern: "1",
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "08:00",
      sortOrder: 1,
    },
  ]);
  savePaidWarmup({
    id: "warmup-public-draft",
    associationId: show.associationId,
    showId: show.id,
    dayId: "day-public-draft",
    name: "Draft warm up",
    isPublicLive: true,
    entries: [{ id: "entry-1", rider: "Marie", status: "pending" }],
  });

  const draftView = getPublicShowView(show.id);
  expect(draftView).toMatchObject({
    publishedClassCount: 0,
    publishedResultClassCount: 0,
    liveClassCount: 0,
    scheduleItemCount: 0,
  });

  saveShows([{ ...show, status: "active" }]);

  const activeView = getPublicShowView(show.id);
  expect(activeView.scheduleItemCount).toBe(2);
  expect(activeView.liveClassCount).toBe(1);
});

test("paid warmup day sync keeps local warmups missing from remote rows", () => {
  const merged = mergePaidWarmupsForDay(
    [
      {
        id: "remote-warmup",
        dayId: "day-sync",
        name: "Remote local draft",
        sortOrder: 1,
      },
      {
        id: "local-only-warmup",
        dayId: "day-sync",
        name: "Local warm up",
        sortOrder: 2,
      },
    ],
    [
      {
        id: "remote-warmup",
        dayId: "day-sync",
        name: "Remote warm up",
        sortOrder: 1,
      },
    ]
  );

  expect(merged.map((warmup) => warmup.id)).toEqual([
    "remote-warmup",
    "local-only-warmup",
  ]);
  expect(merged.find((warmup) => warmup.id === "remote-warmup").name).toBe(
    "Remote warm up"
  );
});

test("paid warmup merge flags newer local fixed starts for cloud resync", () => {
  const mergeResult = buildPaidWarmupMergeResult(
    {
      id: "warmup-stale-cloud",
      association_id: "association-1",
      show_id: "show-1",
      day_id: "day-1",
      name: "Warm-up vendredi",
      duration_minutes_per_rider: 7,
      drag_duration_minutes: 8,
      entries: [],
      sort_order: 1,
      schedule_start_mode: CLASS_START_MODE_AFTER_PREVIOUS,
      schedule_start_time: null,
      updated_at: "2026-06-10T12:00:00.000Z",
    },
    {
      id: "warmup-stale-cloud",
      associationId: "association-1",
      showId: "show-1",
      dayId: "day-1",
      name: "Warm-up vendredi",
      durationMinutesPerRider: 7,
      dragDurationMinutes: 8,
      entries: [],
      sortOrder: 1,
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "07:00",
      updatedAt: "2026-06-10T12:05:00.000Z",
    }
  );

  expect(mergeResult.shouldSyncLocal).toBe(true);
  expect(mergeResult.warmup).toMatchObject({
    scheduleStartMode: CLASS_START_MODE_FIXED,
    scheduleStartTime: "07:00",
  });
});

test("paid warmup save retries without active_entry_id when HSP rejects the FK", async () => {
  const updateRows = [];
  const insertRows = [];
  const activeEntryId = "00000000-0000-0000-0000-000000000001";
  const foreignKeyError = {
    code: "23503",
    message:
      'insert or update on table "show_score_paid_warmups" violates foreign key constraint "show_score_paid_warmups_active_entry_id_fkey"',
    details: "show_score_paid_warmups_active_entry_id_fkey",
  };
  const supabase = {
    from(tableName) {
      expect(tableName).toBe("show_score_paid_warmups");

      return {
        update(row) {
          updateRows.push(row);

          return {
            eq(columnName, value) {
              expect(columnName).toBe("id");
              expect(value).toBe("warmup-fk-fallback");

              return {
                async select(columnList) {
                  expect(columnList).toBe("id");

                  if (updateRows.length === 1) {
                    return { data: null, error: foreignKeyError };
                  }

                  return { data: [], error: null };
                },
              };
            },
          };
        },
        async insert(row) {
          insertRows.push(row);
          return { error: null };
        },
      };
    },
  };

  vi.resetModules();
  vi.doMock("./features/cloud/supabaseClient", () => ({
    getSupabaseClient: () => supabase,
  }));

  try {
    const { savePaidWarmupRepository } = await import(
      "./features/paidWarmups/paidWarmupRepository"
    );
    const { getLocalFirstSyncState } = await import(
      "./features/cloud/localFirstSync"
    );

    const saved = await savePaidWarmupRepository({
      id: "warmup-fk-fallback",
      associationId: "association-1",
      showId: "show-1",
      dayId: "day-1",
      name: "Paid warm up FK fallback",
      arena: "101",
      activeEntryId,
      entries: [{ id: "entry-local", rider: "Marie", status: "pending" }],
    });

    expect(updateRows).toHaveLength(2);
    expect(insertRows).toHaveLength(1);
    expect(updateRows[0].active_entry_id).toBe(activeEntryId);
    expect(updateRows[0].updated_at).toEqual(expect.any(String));
    expect(updateRows[1]).not.toHaveProperty("active_entry_id");
    expect(updateRows[1].updated_at).toEqual(expect.any(String));
    expect(insertRows[0]).not.toHaveProperty("active_entry_id");
    expect(insertRows[0].updated_at).toEqual(expect.any(String));
    expect(insertRows[0]).toMatchObject({
      arena: "101",
      schedule_start_mode: CLASS_START_MODE_AFTER_PREVIOUS,
    });
    expect(saved.activeEntryId).toBe(activeEntryId);
    expect(getLocalFirstSyncState(saved)).toMatchObject({
      status: "error",
      errorMessage: expect.stringContaining("active_entry_id"),
    });
  } finally {
    vi.doUnmock("./features/cloud/supabaseClient");
    vi.resetModules();
  }
});

test("paid warmup delete keeps the local row when Supabase does not delete it", async () => {
  savePaidWarmup({
    id: "warmup-delete-refused",
    associationId: "association-1",
    showId: "show-1",
    dayId: "day-1",
    name: "Delete refused",
    isPublicLive: true,
    activeEntryId: "entry-1",
    activeStartedAt: "2026-06-29T12:00:00.000Z",
    entries: [{ id: "entry-1", rider: "Marie", status: "pending" }],
  });

  const updateRows = [];
  const deleteIds = [];
  const supabase = {
    from(tableName) {
      expect(tableName).toBe("show_score_paid_warmups");

      return {
        update(row) {
          updateRows.push(row);

          return {
            eq(columnName, value) {
              expect(columnName).toBe("id");
              expect(value).toBe("warmup-delete-refused");
              return { error: null };
            },
          };
        },
        delete() {
          return {
            eq(columnName, value) {
              expect(columnName).toBe("id");
              expect(value).toBe("warmup-delete-refused");
              deleteIds.push(value);

              return {
                async select(columnList) {
                  expect(columnList).toBe("id");
                  return { data: [], error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  vi.resetModules();
  vi.doMock("./features/cloud/supabaseClient", () => ({
    getSupabaseClient: () => supabase,
  }));

  try {
    const { deletePaidWarmupRepository } = await import(
      "./features/paidWarmups/paidWarmupRepository"
    );

    await expect(
      deletePaidWarmupRepository("warmup-delete-refused")
    ).rejects.toThrow(/pas été supprimé|not deleted/i);

    expect(updateRows).toEqual([
      {
        is_public_live: false,
        active_entry_id: null,
        active_started_at: null,
      },
    ]);
    expect(deleteIds).toEqual(["warmup-delete-refused"]);
    expect(getPaidWarmupById("warmup-delete-refused")).toMatchObject({
      id: "warmup-delete-refused",
      isPublicLive: true,
    });
  } finally {
    vi.doUnmock("./features/cloud/supabaseClient");
    vi.resetModules();
  }
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

test("routes generic role QR entries to the relevant association surface", () => {
  const memberships = [
    {
      userId: "user-1",
      associationId: "association-1",
      role: ASSOCIATION_ROLES.SCRIBE,
    },
    {
      userId: "user-1",
      associationId: "association-2",
      role: ASSOCIATION_ROLES.ANNOUNCER,
    },
    {
      userId: "user-1",
      associationId: "association-2",
      role: ASSOCIATION_ROLES.SECRETARY,
    },
  ];

  expect(normalizeRoleEntryKey("annonceur")).toBe("announcer");
  expect(normalizeRoleEntryKey("secretaire")).toBe("secretariat");
  expect(
    getRoleEntryAssociationIds({ roleKey: "scribe", memberships })
  ).toEqual(["association-1", "association-2"]);
  expect(
    getRoleEntryAssociationIds({ roleKey: "annonceur", memberships })
  ).toEqual(["association-2"]);
  expect(
    buildRoleEntryPath({
      roleKey: "annonceur",
      associationId: "association-2",
      showId: "show-9",
    })
  ).toBe("/associations/association-2/shows/show-9/announcer");
  expect(
    buildRoleEntryPath({
      roleKey: "secretariat",
      associationId: "association-2",
    })
  ).toBe("/associations/association-2/shows");
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
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile",
      metadata: { isPublicPath: true, viewport: { width: 390, height: 844 } },
      createdAt: "2026-06-06T12:00:00.000Z",
    },
    {
      eventType: "analytics",
      eventName: "page_view",
      sessionId: "session-1",
      path: "/associations",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      metadata: {
        isPublicPath: false,
        deviceType: "desktop",
        viewport: { width: 1440, height: 900 },
      },
      associationId: "association-1",
      showId: "show-1",
      createdAt: "2026-06-06T12:05:00.000Z",
    },
    {
      eventType: "analytics",
      eventName: "page_view",
      sessionId: "session-2",
      path: "/associations/association-1/scribe/classes/class-1",
      metadata: {
        pageCategory: "scribe_class",
        isPublicPath: false,
        viewport: { width: 1024, height: 768 },
      },
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
  expect(summary.deviceTypes).toEqual([
    { label: "desktop", count: 2 },
    { label: "mobile", count: 1 },
  ]);
  expect(summary.latestEventAt).toBe("2026-06-06T12:15:00.000Z");
});

test("resolves analytics event ids to readable labels", () => {
  const resolver = {
    associationsById: new Map([
      ["association-1", { id: "association-1", name: "AQR" }],
    ]),
    showsById: new Map([
      ["show-1", { id: "show-1", name: "Show de juin" }],
    ]),
    daysById: new Map([
      ["day-1", { id: "day-1", label: "Jour 1", date: "2026-06-25" }],
    ]),
    classesById: new Map([
      [
        "class-1",
        {
          id: "class-1",
          name: "Open Derby Level 4",
          classCode: "OD-L4",
        },
      ],
    ]),
    paidWarmupsById: new Map(),
  };

  const event = enrichAnalyticsEventLabels(
    {
      associationId: "association-1",
      showId: "show-1",
      dayId: "day-1",
      classId: "class-1",
      metadata: {},
    },
    resolver
  );

  expect(event.resolvedLabels).toMatchObject({
    association: "AQR",
    show: "Show de juin",
    day: "Jour 1 · 2026-06-25",
    class: "Open Derby Level 4 (OD-L4)",
  });
  expect(resolveAnalyticsLabel("class", "class-1", resolver)).toBe(
    "Open Derby Level 4 (OD-L4)"
  );
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

test("announcer live view exposes class standings from setup class codes", () => {
  const classView = buildAnnouncerClassView({
    classItem: {
      id: "announcer-block",
      name: "Novice Horse Block",
      pattern: "2",
    },
    setup: {
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
      ],
    },
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
  });

  expect(classView.classStandings.map((group) => group.code)).toEqual([
    "NHO",
    "NH2",
  ]);
  expect(classView.classStandings[0].entries[0]).toMatchObject({
    backNumber: "101",
    rider: "Open Rider",
    scoreTotal: "72",
  });
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
        scoreTotal: "70.0",
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

test("announcer live view exposes rider pace with planned drags", () => {
  const classView = buildAnnouncerClassView({
    classItem: {
      id: "class-pace",
      name: "Open Pace",
      pattern: "5",
    },
    setup: {
      dragInterval: 2,
      dragDurationMinutes: 8,
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE,
    },
    scoringRuns: [
      {
        id: "pace-1",
        draw: 1,
        backNumber: "101",
        scoreTotal: "71.0",
        scores: Array(8).fill("0"),
        penalties: Array(8).fill(""),
        durationSeconds: 180,
      },
      {
        id: "pace-2",
        draw: 2,
        backNumber: "102",
        scores: Array(8).fill(""),
        penalties: Array(8).fill(""),
      },
      {
        id: "pace-3",
        draw: 3,
        backNumber: "103",
        scores: Array(8).fill(""),
        penalties: Array(8).fill(""),
      },
    ],
  });

  expect(classView.pace).toMatchObject({
    runCount: 3,
    completedRuns: 1,
    remainingRuns: 2,
    remainingDragBreaks: 1,
    averageSecondsPerRiderWithDrags: 340,
  });
  expect(classView.pace.ridersPerHour).toBeCloseTo(10.59);
});

test("announcer pace follows global results and completed drags", () => {
  const setupRuns = Array.from({ length: 4 }, (_, index) => ({
    id: `announcer-pace-${index + 1}`,
    draw: index + 1,
    rider: `Rider ${index + 1}`,
  }));
  const announcerSession = {
    classId: "class-announcer-pace",
    startedAt: "2026-07-20T12:00:00.000Z",
    activeManoeuvre: {
      type: "run",
      runId: "announcer-pace-3",
      draw: 3,
      startedAt: "2026-07-20T12:13:00.000Z",
    },
    runs: [
      {
        ...setupRuns[0],
        status: ANNOUNCER_RUN_STATUSES.SCORED,
        scoreTotal: "70",
        startedAt: "2026-07-20T12:00:00.000Z",
        completedAt: "2026-07-20T12:02:00.000Z",
      },
      {
        ...setupRuns[1],
        status: ANNOUNCER_RUN_STATUSES.SCORED,
        scoreTotal: "71",
        startedAt: "2026-07-20T12:03:00.000Z",
        completedAt: "2026-07-20T12:05:00.000Z",
        dragCompletedAt: "2026-07-20T12:13:00.000Z",
      },
      {
        ...setupRuns[2],
        status: ANNOUNCER_RUN_STATUSES.ON_COURSE,
        startedAt: "2026-07-20T12:13:00.000Z",
      },
      setupRuns[3],
    ],
  };
  const classView = buildAnnouncerClassView({
    classItem: {
      id: "class-announcer-pace",
      name: "Announcer Pace",
      pattern: "5",
    },
    setup: {
      pattern: "5",
      liveDataSource: LIVE_DATA_SOURCES.ANNOUNCER,
      dragInterval: 2,
      dragDurationMinutes: 8,
      runs: setupRuns,
    },
    announcerSession,
    publication: {
      status: PUBLICATION_STATUSES.LIVE,
    },
  });

  expect(classView.pace).toMatchObject({
    runCount: 4,
    completedRuns: 2,
    remainingRuns: 2,
    completedDragBreaks: 1,
    remainingDragBreaks: 0,
  });
  expect(classView.activeRun.draw).toBe(3);
  expect(classView.nextLiveItem.draw).toBe(4);
  expect(
    classView.orderRuns.find((item) => item.type === "drag")?.liveOrderStatus
  ).toBe("passed");
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
  expect(summary.averageSecondsPerRiderWithDrags).toBe(340);
  expect(summary.ridersPerHour).toBeCloseTo(10.59);
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
  expect(timingRow.averageSecondsPerRiderWithDrags).toBe(280);
  expect(timingRow.ridersPerHour).toBeCloseTo(12.86);
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

test("a completed scribe drag advances the live queue to the next rider", () => {
  const setupRuns = Array.from({ length: 4 }, (_, index) => ({
    id: `scribe-drag-${index + 1}`,
    draw: index + 1,
    rider: `Rider ${index + 1}`,
  }));
  const classView = buildAnnouncerClassView({
    classItem: {
      id: "class-scribe-drag",
      name: "Scribe Drag",
      pattern: "5",
    },
    setup: {
      pattern: "5",
      liveDataSource: LIVE_DATA_SOURCES.SCRIBE,
      dragInterval: 2,
      dragDurationMinutes: 8,
      runs: setupRuns,
    },
    scoringSession: {
      classId: "class-scribe-drag",
      activeManoeuvre: null,
      runs: [
        {
          ...setupRuns[0],
          scoreTotal: "70",
          completedAt: "2026-07-20T12:02:00.000Z",
        },
        {
          ...setupRuns[1],
          scoreTotal: "71",
          completedAt: "2026-07-20T12:05:00.000Z",
          dragCompletedAt: "2026-07-20T12:13:00.000Z",
        },
        setupRuns[2],
        setupRuns[3],
      ],
    },
    publication: {
      status: PUBLICATION_STATUSES.LIVE,
    },
  });

  expect(classView.nextLiveItem).toMatchObject({
    type: "run",
    draw: 3,
  });
  expect(classView.upcomingLiveItems[0]).toMatchObject({
    type: "run",
    draw: 3,
  });
});

test("terminating a scribe drag records it on the preceding run", () => {
  const runs = [{ id: "run-1" }, { id: "run-2" }, { id: "run-3" }];
  const completed = markLiveDragCompleted(
    runs,
    1,
    new Date("2026-07-20T12:13:00.000Z")
  );

  expect(completed[1].dragCompletedAt).toBe("2026-07-20T12:13:00.000Z");
  expect(completed[0]).toBe(runs[0]);
  expect(completed[2]).toBe(runs[2]);
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
      startMode: CLASS_START_MODE_FIXED,
      startTime: "08:30:00",
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

test("sorts schedule items by fixed time before HSP order", () => {
  const sortedIds = [
    {
      id: "after-first",
      name: "After first",
      schedule_start_mode: CLASS_START_MODE_AFTER_PREVIOUS,
      sort_order: 10,
    },
    {
      id: "fixed-later",
      name: "Fixed later",
      schedule_start_mode: CLASS_START_MODE_FIXED,
      scheduled_time: "09:00:00",
      sort_order: 1,
    },
    {
      id: "fixed-earlier",
      name: "Fixed earlier",
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "08:00",
      sortOrder: 50,
    },
    {
      id: "after-second",
      name: "After second",
      schedule_start_mode: CLASS_START_MODE_AFTER_PREVIOUS,
      sort_order: 20,
    },
  ]
    .sort(compareScheduleItemsByStart)
    .map((item) => item.id);

  expect(sortedIds).toEqual([
    "fixed-earlier",
    "fixed-later",
    "after-first",
    "after-second",
  ]);
});

test("returns day classes in fixed-time schedule order", () => {
  saveClasses([
    {
      id: "day-class-after-first",
      dayId: "day-sort",
      name: "After first",
      scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
      sortOrder: 10,
    },
    {
      id: "day-class-fixed-later",
      dayId: "day-sort",
      name: "Fixed later",
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "09:00",
      sortOrder: 1,
    },
    {
      id: "day-class-fixed-earlier",
      dayId: "day-sort",
      name: "Fixed earlier",
      scheduleStartMode: CLASS_START_MODE_FIXED,
      scheduleStartTime: "08:00",
      sortOrder: 50,
    },
    {
      id: "day-class-after-second",
      dayId: "day-sort",
      name: "After second",
      scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
      sortOrder: 20,
    },
  ]);

  expect(getClassesByDayId("day-sort").map((item) => item.id)).toEqual([
    "day-class-fixed-earlier",
    "day-class-fixed-later",
    "day-class-after-first",
    "day-class-after-second",
  ]);
});

test("builds a day schedule from fixed and follow-up block starts", () => {
  const rows = buildDayScheduleRows(
    [
      {
        classId: "block-a",
        className: "Open",
        dayDate: "2026-06-15",
        scheduleStartMode: CLASS_START_MODE_FIXED,
        scheduleStartTime: "08:00:00",
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

test("syncs fixed class setup starts onto class schedule fields", () => {
  const classItem = buildClassWithSetupScheduleStart(
    {
      id: "class-setup-start",
      name: "Novice Horse",
      scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
      scheduleStartTime: "",
    },
    {
      scheduleDetails: {
        startMode: CLASS_START_MODE_FIXED,
        startTime: "07:00",
      },
    }
  );

  expect(classItem).toMatchObject({
    scheduleStartMode: CLASS_START_MODE_FIXED,
    scheduleStartTime: "07:00",
  });
});

test("live schedule items keep class start fields from HSP rows", () => {
  const [item] = buildLiveScheduleItems({
    classes: [
      {
        id: "class-remote-start",
        show_id: "show-1",
        day_id: "day-1",
        name: "Novice Horse",
        schedule_start_mode: CLASS_START_MODE_FIXED,
        scheduled_time: "07:00:00",
      },
    ],
    days: [{ id: "day-1", date: "2026-06-26", sort_order: 1 }],
  });

  expect(item).toMatchObject({
    scheduleStartMode: CLASS_START_MODE_FIXED,
    scheduleStartTime: "07:00",
  });
});

test("live schedule items follow fixed class times before HSP sort order", () => {
  const items = buildLiveScheduleItems({
    classes: [
      {
        id: "live-after",
        show_id: "show-1",
        day_id: "day-1",
        name: "After",
        schedule_start_mode: CLASS_START_MODE_AFTER_PREVIOUS,
        sort_order: 1,
      },
      {
        id: "live-fixed",
        show_id: "show-1",
        day_id: "day-1",
        name: "Fixed",
        schedule_start_mode: CLASS_START_MODE_FIXED,
        scheduled_time: "08:30:00",
        sort_order: 50,
      },
    ],
    days: [{ id: "day-1", date: "2026-06-26", sort_order: 1 }],
  });

  expect(items.map((item) => item.itemId)).toEqual(["live-fixed", "live-after"]);
});

test("normalizes paid warmup starts from Supabase schedule fields", () => {
  expect(
    normalizePaidWarmup({
      schedule_start_mode: CLASS_START_MODE_FIXED,
      schedule_start_time: "07:15",
    })
  ).toMatchObject({
    scheduleStartMode: CLASS_START_MODE_FIXED,
    scheduleStartTime: "07:15",
  });
});

test("builds a schedule preview without using now as an unconfirmed first start", () => {
  const sections = buildShowSchedulePreviewSections({
    daySections: [
      {
        day: { id: "day-1", label: "Jour 1", date: "2026-06-15" },
        classRows: [
          {
            classItem: {
              id: "block-a",
              name: "Open",
              pattern: "R1",
              scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
              sortOrder: 1,
            },
            setup: {
              runs: [{ id: "run-1" }],
              scheduleDetails: {},
            },
            scoringRuns: [],
          },
        ],
        paidWarmups: [],
      },
    ],
    now: new Date("2026-06-15T07:30:00"),
  });
  const [row] = sections[0].rows;

  expect(row.estimatedStartAt).toBeNull();
  expect(row.isEstimateBlockedByMissingAnchor).toBe(true);
});

test("builds a schedule preview from a fixed paid warmup into the next item", () => {
  const sections = buildShowSchedulePreviewSections({
    daySections: [
      {
        day: { id: "day-1", label: "Jour 1", date: "2026-06-15" },
        classRows: [
          {
            classItem: {
              id: "block-a",
              name: "Open",
              pattern: "R1",
              scheduleStartMode: CLASS_START_MODE_AFTER_PREVIOUS,
              sortOrder: 2,
            },
            setup: {
              runs: [{ id: "run-1", durationSeconds: 180 }],
              scheduleDetails: {},
            },
            scoringRuns: [{ id: "run-1", durationSeconds: 180 }],
          },
        ],
        paidWarmups: [
          {
            id: "warmup-1",
            name: "Paid warm up",
            scheduleStartMode: CLASS_START_MODE_FIXED,
            scheduleStartTime: "08:00",
            durationMinutesPerRider: 5,
            dragDurationMinutes: 8,
            entries: [{ id: "entry-1", rider: "A" }],
            sortOrder: 1,
          },
        ],
      },
    ],
    now: new Date("2026-06-15T07:30:00"),
  });
  const [warmupRow, classRow] = sections[0].rows;

  expect(warmupRow.itemType).toBe(SHOW_SCHEDULE_ITEM_TYPES.PAID_WARMUP);
  expect(new Date(warmupRow.estimatedStartAt).getHours()).toBe(8);
  expect(Date.parse(classRow.estimatedStartAt)).toBe(
    Date.parse(warmupRow.estimatedEndAt)
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

test("normalizes the judge set approval mode without changing the legacy default", () => {
  expect(normalizeSetApprovalMode(SET_APPROVAL_MODES.PER_SET)).toBe(
    SET_APPROVAL_MODES.PER_SET
  );
  expect(normalizeSetApprovalMode("unexpected")).toBe(
    SET_APPROVAL_MODES.CLASS_END
  );
  expect(normalizeClassSetup({}).setApprovalMode).toBe(
    SET_APPROVAL_MODES.CLASS_END
  );
});

test("builds consecutive signed set snapshots and locks their runs", () => {
  const runs = Array.from({ length: 6 }, (_, index) => ({
    id: `run-${index + 1}`,
    draw: index + 1,
    backNumber: String(100 + index),
    scores: ["0"],
    penalties: [""],
    isActive: index === 2,
  }));
  const firstRange = getNextSetRange({
    runs,
    approvals: [],
    endIndex: 2,
  });
  const firstApproval = buildSetApproval({
    setRange: firstRange,
    judgeName: "Judge One",
    judgeSignature: "data:image/png;base64,signature",
    signedAt: "2026-07-20T12:00:00.000Z",
  });
  const secondRange = getNextSetRange({
    runs,
    approvals: [firstApproval],
    endIndex: 5,
  });
  const secondApproval = buildSetApproval({
    setRange: secondRange,
    judgeName: "Judge One",
    judgeSignature: "data:image/png;base64,signature-2",
    signedAt: "2026-07-20T13:00:00.000Z",
  });

  expect(firstRange).toMatchObject({
    setNumber: 1,
    startIndex: 0,
    endIndex: 2,
    startDraw: 1,
    endDraw: 3,
  });
  expect(secondRange).toMatchObject({
    setNumber: 2,
    startIndex: 3,
    endIndex: 5,
    startDraw: 4,
    endDraw: 6,
  });
  expect(firstApproval.runs.every((run) => run.isActive === false)).toBe(true);
  expect(getLockedRunKeys([firstApproval]).has("id:run-3")).toBe(true);
  expect(
    areAllRunsApproved(runs, [firstApproval, secondApproval])
  ).toBe(true);
});

test("blocks a set approval while one of its runs is under video review", () => {
  const setRange = {
    runs: [
      { id: "run-1", penalties: [""], scores: ["0"] },
      {
        id: "run-2",
        penalties: ["Révision vidéo"],
        scores: [""],
      },
    ],
  };

  expect(getPendingVideoReviewRunsForSet(setRange)).toEqual([
    setRange.runs[1],
  ]);
});

test("creates an adjustable multi-set draw only for a test association", () => {
  const draw = buildScoringTestDraw(16);

  expect(isScoringTestAssociation({ isTestMode: true })).toBe(true);
  expect(isScoringTestAssociation({ name: "Test by name only" })).toBe(false);
  expect(draw).toHaveLength(16);
  expect(TEST_DRAW_RUN_COUNT).toBeGreaterThan(8);
  expect(draw.length / TEST_DRAG_INTERVAL).toBe(4);
  expect(draw[0]).toMatchObject({
    draw: 1,
    backNumber: "101",
    rider: "Amélie Tremblay",
  });
});

test("fills test scoring only through the next drag", () => {
  const runs = buildScoringTestDraw().map((run) => ({
    ...run,
    scores: Array(7).fill(""),
    penalties: Array(7).fill(""),
  }));
  const firstRange = getScoringTestFillRange({
    runs,
    maneuverCount: 7,
    dragInterval: TEST_DRAG_INTERVAL,
  });
  const completedRun = buildCompletedScoringTestRun({
    run: runs[0],
    runIndex: 0,
    maneuverCount: 7,
    scoreOptionsByIndex: Array(7).fill([
      "-1",
      "-½",
      "0",
      "+½",
      "+1",
    ]),
    penaltyOptions: ["½", "1", "2", "P2", "5", "P5", "Score 0"],
    scoringCalculationOptions: { baseScore: 70 },
    completedAt: "2026-07-20T15:00:00.000Z",
  });

  expect(firstRange).toEqual({ startIndex: 0, endIndex: 3 });
  expect(completedRun.scores.every(Boolean)).toBe(true);
  expect(completedRun.scoreTotal).not.toBe("");
  expect(completedRun.completedAt).toBe("2026-07-20T15:00:00.000Z");
});

test("test scoring generates varied penalties and notes", () => {
  const runs = buildScoringTestDraw(6).map((run) => ({
    ...run,
    scores: Array(7).fill(""),
    penalties: Array(7).fill(""),
    note: "",
  }));
  const completedRuns = runs.map((run, runIndex) =>
    buildCompletedScoringTestRun({
      run,
      runIndex,
      maneuverCount: 7,
      scoreOptionsByIndex: Array(7).fill([
        "-1",
        "-½",
        "0",
        "+½",
        "+1",
      ]),
      penaltyOptions: ["½", "1", "2", "P2", "5", "P5", "Score 0"],
      scoringCalculationOptions: { baseScore: 70 },
      completedAt: "2026-07-20T15:00:00.000Z",
    })
  );

  expect(
    completedRuns.flatMap((run) => run.penalties).filter(Boolean).length
  ).toBeGreaterThan(0);
  expect(completedRuns.filter((run) => run.note).length).toBeGreaterThan(0);
  expect(new Set(completedRuns.map((run) => run.scoreTotal)).size).toBeGreaterThan(
    1
  );
});
