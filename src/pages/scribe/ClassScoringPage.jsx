import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ScoreTable from "../../components/ScoreTable";
import SignaturePad from "../../components/SignaturePad";
import {
  getClassFullData,
  getClassFullDataRepository,
  saveSetupForClassRepository,
} from "../../features/classes/classRepository";
import {
  getJudgeDisplayName,
  normalizeClassJudges,
} from "../../features/classes/classJudges";
import {
  getClassSetup,
  getRunIntegrationMetadata,
} from "../../features/classes/classSetupStorage";
import {
  buildUniqueRunIdentityIndex,
  findRunIdentityMatch,
  getRunUsageKey,
} from "../../features/classes/runIdentity";
import {
  LIVE_QUEUE_ITEM_TYPES,
  getLiveDragItemId,
} from "../../features/live/liveQueueItems";
import {
  finalizeClassWithJudge,
  saveFinalPdfFileName,
} from "../../features/classes/classFinalizationService";
import {
  getClassStatus,
  isClassScoringFinalized,
} from "../../features/classes/classStatusSelectors";
import { resolveClassScoringId } from "../../features/classes/classScoringGroups";
import { loadAssociations } from "../../features/associations/associationsData";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useAuthUser } from "../../features/auth/useAuthUser";
import { getDayById } from "../../features/days/daySelectors";
import { getShowById } from "../../features/shows/showSelectors";
import { activateShowForScoringRepository } from "../../features/shows/showRepository";
import {
  getPatternHeaders,
  isNoPatternValue,
  patternHasRailAdjustment,
} from "../../features/patterns/patternDefinitions";
import { getScoringOptionsForPattern } from "../../features/scoring/scoringOptions";
import {
  applySetupRunScratchPenalty,
  buildSetupRunScoringPenalties,
} from "../../features/scoring/setupRunScoring";
import { buildProvisionalRanking } from "../../features/scoring/provisionalRanking";
import {
  buildScoringDataLossWarning,
} from "../../features/scoring/scoringDataIntegrity";
import {
  SET_APPROVAL_MODES,
  areAllRunsApproved,
  buildSetApproval,
  getLockedRunKeys,
  getNextSetRange,
  getPendingVideoReviewRunsForSet,
  getRunApprovalKey,
  normalizeSetApprovalMode,
  normalizeSetApprovals,
} from "../../features/scoring/setApprovals";
import {
  buildCompletedScoringTestRun,
  getScoringTestFillRange,
  isScoringTestAssociation,
} from "../../features/scoring/scoringTestMode";
import {
  appendPenaltyToken,
  formatPenaltyValue,
  formatScoreValue,
  formatTotalValue,
  isScoredRunComplete,
  recalculateRun,
  removeLastPenaltyToken,
  runHasVideoReview,
  splitPenaltyTokens,
  togglePenaltySpecialToken,
} from "../../utils/scoring";
import {
  SPECIAL_PENALTY_REASON_TOKENS,
  isSpecialPenaltyReasonRequired,
  isValidSpecialPenaltyReason,
  normalizeSpecialPenaltyReasonNote,
  removeSpecialPenaltyReasonNote,
  upsertSpecialPenaltyReasonNote,
} from "../../features/scoring/specialPenaltyReasons";
import {
  loadActiveManoeuvre,
  loadScoringRuns,
  flushScoringSyncQueue,
  getScoringRunsSyncFailure,
  getScoringRunsSyncStatus,
  saveActiveManoeuvreRepository,
  saveScoringStartedAtRepository,
  saveScoringRunsRepository,
  SCORING_SYNC_STATUS,
} from "../../features/scoring/scoringRepository";
import {
  claimJudgeScoringSessionRepository,
  flushJudgeScoringSessionSyncQueue,
  getJudgeScoringSessionSyncFailure,
  getJudgeScoringSessionSyncStatus,
  saveJudgeScoringSessionRepository,
} from "../../features/scoring/judgeScoringSessionRepository";
import {
  advanceArenaLiveClassAfterCompletionRepository,
  saveArenaCurrentLiveClassRepository,
} from "../../features/publication/publicationCloudRepository";
import {
  getPlannedLiveStatus,
  isLivePublicationStatus,
  PUBLICATION_STATUSES,
} from "../../features/publication/publicationRepository";
import {
  calculateClassTimingSummary,
  formatClockTime,
  formatDuration,
  stampRunTiming,
} from "../../features/classes/classTiming";
import {
  buildJudgeScorePdfFileName,
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import { buildSetApprovalPdf } from "../../features/classes/officialPdfService";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

function normalizeRunArrays(run, targetLength) {
  const nextScores = Array.isArray(run.scores) ? [...run.scores] : [];
  const nextPenalties = Array.isArray(run.penalties) ? [...run.penalties] : [];

  while (nextScores.length < targetLength) nextScores.push("");
  while (nextPenalties.length < targetLength) nextPenalties.push("");

  return {
    ...run,
    note: normalizeSpecialPenaltyReasonNote(run.note),
    scores: nextScores.slice(0, targetLength),
    penalties: nextPenalties.slice(0, targetLength),
  };
}

function getPenaltyDisabledIndexes(headers, scoringOptions) {
  const disabledHeaders = new Set(scoringOptions.penaltyDisabledHeaders || []);

  return headers.reduce((indexes, header, index) => {
    if (disabledHeaders.has(header)) {
      indexes.push(index);
    }

    return indexes;
  }, []);
}

function getScoreOptionsByIndex(headers, scoringOptions) {
  const scoreOptionsByHeader = scoringOptions.scoreOptionsByHeader || {};

  return headers.map(
    (header) => scoreOptionsByHeader[header] || scoringOptions.scoreOptions
  );
}

function getScoringCalculationOptions(headers, scoringOptions) {
  return {
    baseScore: scoringOptions.baseScore ?? 70,
    penaltyDisabledIndexes: getPenaltyDisabledIndexes(headers, scoringOptions),
  };
}

function penaltiesContainToken(penalties, token, specialPenaltyTokens) {
  return (Array.isArray(penalties) ? penalties : []).some((penalty) =>
    splitPenaltyTokens(penalty, specialPenaltyTokens).includes(token)
  );
}

function syncSpecialPenaltyReasonNotes(
  note,
  penalties,
  specialPenaltyTokens,
  selectedToken,
  reasonId,
  manualComment = ""
) {
  let nextNote = String(note || "");

  SPECIAL_PENALTY_REASON_TOKENS.forEach((token) => {
    if (!penaltiesContainToken(penalties, token, specialPenaltyTokens)) {
      nextNote = removeSpecialPenaltyReasonNote(nextNote, token);
    }
  });

  if (
    selectedToken &&
    isSpecialPenaltyReasonRequired(selectedToken) &&
    penaltiesContainToken(penalties, selectedToken, specialPenaltyTokens) &&
    isValidSpecialPenaltyReason(selectedToken, reasonId, manualComment)
  ) {
    nextNote = upsertSpecialPenaltyReasonNote(
      nextNote,
      selectedToken,
      reasonId,
      manualComment
    );
  }

  return nextNote;
}

function getSetupRunDraw(run, index) {
  return run?.draw ?? run?.order ?? index + 1;
}

function buildBaseRunsFromSetup(
  classId,
  maneuverCount,
  scoringCalculationOptions = {}
) {
  const setup = getClassSetup(classId);
  const setupRuns = Array.isArray(setup?.runs) ? setup.runs : [];

  return setupRuns.map((run, index) =>
    recalculateRun(
      normalizeRunArrays(
        {
          id: run.id,
          draw: getSetupRunDraw(run, index),
          order: run.order ?? index + 1,
          backNumber: run.backNumber || "",
          rider: run.rider || "",
          horse: run.horse || "",
          owner: run.owner || "",
          status: run.status || "",
          ...getRunIntegrationMetadata(run),
          classCodes: Array.isArray(run.classCodes) ? run.classCodes : [],
          scores: [],
          penalties: buildSetupRunScoringPenalties(run, maneuverCount),
          penTotal: 0,
          scoreTotal: 70,
          isActive: false,
          note: "",
        },
        maneuverCount
      ),
      scoringCalculationOptions
    )
  );
}

function mergeScoringRuns(
  baseRuns,
  savedRuns,
  maneuverCount,
  scoringCalculationOptions = {}
) {
  if (!Array.isArray(savedRuns) || savedRuns.length === 0) {
    return baseRuns.map((run) =>
      recalculateRun(
        normalizeRunArrays(run, maneuverCount),
        scoringCalculationOptions
      )
    );
  }

  const savedById = new Map();
  const savedIdentityIndex = buildUniqueRunIdentityIndex(savedRuns, {
    includeDraw: true,
  });
  const usedSavedKeys = new Set();

  savedRuns.forEach((run, runIndex) => {
    if (run?.id) {
      savedById.set(run.id, { run, runIndex });
    }
  });

  return baseRuns.map((baseRun) => {
    let savedEntry = savedById.get(baseRun.id);

    if (!savedEntry) {
      savedEntry = findRunIdentityMatch(
        baseRun,
        savedIdentityIndex,
        usedSavedKeys,
        { includeDraw: true }
      );
    }

    const saved = savedEntry?.run;

    if (!saved) {
      return recalculateRun(
        normalizeRunArrays(baseRun, maneuverCount),
        scoringCalculationOptions
      );
    }

    usedSavedKeys.add(getRunUsageKey(saved, savedEntry.runIndex));

    return recalculateRun(
      normalizeRunArrays(
        {
          ...baseRun,
          status: saved.status || baseRun.status || "",
          backNumber: saved.backNumber ?? baseRun.backNumber,
          rider: saved.rider ?? baseRun.rider,
          horse: saved.horse ?? baseRun.horse,
          owner: saved.owner ?? baseRun.owner,
          classCodes: Array.isArray(saved.classCodes)
            ? saved.classCodes
            : baseRun.classCodes,
          ...getRunIntegrationMetadata(baseRun),
          ...getRunIntegrationMetadata(saved),
          penalties: Array.isArray(saved.penalties)
            ? applySetupRunScratchPenalty(baseRun, saved.penalties)
            : baseRun.penalties,
          scores: Array.isArray(saved.scores) ? saved.scores : baseRun.scores,
          penTotal: saved.penTotal ?? baseRun.penTotal,
          scoreTotal: saved.scoreTotal ?? baseRun.scoreTotal,
          isActive: saved.isActive ?? baseRun.isActive,
          note: saved.note ?? baseRun.note ?? "",
          startedAt: saved.startedAt ?? null,
          completedAt: saved.completedAt ?? null,
          durationSeconds: saved.durationSeconds ?? null,
        },
        maneuverCount
      ),
      scoringCalculationOptions
    );
  });
}

function loadRunsForClass(
  classId,
  maneuverCount,
  scoringCalculationOptions = {}
) {
  const baseRuns = buildBaseRunsFromSetup(
    classId,
    maneuverCount,
    scoringCalculationOptions
  );
  const savedRuns = loadScoringRuns(classId);
  return mergeScoringRuns(
    baseRuns,
    savedRuns,
    maneuverCount,
    scoringCalculationOptions
  );
}

function sameActiveManoeuvre(a, b) {
  if (a?.type !== b?.type) return false;

  if (a?.type === LIVE_QUEUE_ITEM_TYPES.DRAG) {
    return (
      a?.id === b?.id &&
      a?.afterIndex === b?.afterIndex &&
      a?.startedAt === b?.startedAt
    );
  }

  return a?.draw === b?.draw && a?.manoeuvreIndex === b?.manoeuvreIndex;
}

function activeManoeuvreExistsInRuns(activeManoeuvre, runs) {
  if (!activeManoeuvre) return false;

  if (activeManoeuvre.type === LIVE_QUEUE_ITEM_TYPES.DRAG) {
    return (
      Number.isInteger(activeManoeuvre.afterIndex) &&
      activeManoeuvre.afterIndex >= 0 &&
      activeManoeuvre.afterIndex < runs.length
    );
  }

  return runs.some((run) => run.draw === activeManoeuvre.draw);
}

function isRunComplete(run, maneuverCount) {
  return isScoredRunComplete(run, maneuverCount);
}

function canFinalizeClass(runs, maneuverCount) {
  if (!Array.isArray(runs) || runs.length === 0) return false;
  return runs.every((run) => isRunComplete(run, maneuverCount));
}

const SCORING_SYNC_DEBOUNCE_MS = 800;
const SCORING_SYNC_RETRY_MS = 5000;

function isScoringSyncBlockingStatus(status) {
  return (
    status === SCORING_SYNC_STATUS.PENDING ||
    status === SCORING_SYNC_STATUS.SYNCING
  );
}

function sanitizeFilePart(value, fallback = "export") {
  const cleaned = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return cleaned || fallback;
}

function ClassScoringPage() {
  const { associationId, classId: routeClassId } = useParams();
  const classId = resolveClassScoringId(routeClassId);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const access = useAssociationAccess(associationId);
  const auth = useAuthUser();

  const [classData, setClassData] = useState(() => getClassFullData(classId));
  const classItem = classData?.classItem;
  const classSetup = classData?.setup;
  const classJudges = useMemo(
    () =>
      normalizeClassJudges({
        judges: classSetup?.judges,
        judgeName: classSetup?.judgeName || classItem?.judgeName,
      }),
    [classItem?.judgeName, classSetup?.judgeName, classSetup?.judges]
  );
  const isMultiJudgeMode = classJudges.length > 1;
  const [activeJudgeId, setActiveJudgeId] = useState("");
  const activeJudgeIndex = classJudges.findIndex(
    (judge) => judge.id === activeJudgeId
  );
  const activeJudge =
    activeJudgeIndex >= 0 ? classJudges[activeJudgeIndex] : null;
  const activeJudgeName = activeJudge
    ? getJudgeDisplayName(activeJudge, activeJudgeIndex)
    : "";
  const legacyAssignedJudgeName = String(
    classSetup?.judgeName || classItem?.judgeName || ""
  ).trim();
  const assignedJudgeName = isMultiJudgeMode
    ? activeJudgeName
    : legacyAssignedJudgeName;
  const day = getDayById(classItem?.dayId);
  const show = getShowById(classItem?.showId);

  const association = useMemo(() => {
    const allAssociations = loadAssociations();
    return allAssociations.find((item) => item.id === associationId) || null;
  }, [associationId]);
  const isTestAssociation = isScoringTestAssociation(association);

  const isClassCompleted = isClassScoringFinalized(classData);
  const [activeJudgeSession, setActiveJudgeSession] = useState(null);
  const [judgeClaimState, setJudgeClaimState] = useState({
    status: "idle",
    session: null,
  });
  const liveActivationSyncRef = useRef("");
  const [isJudgePickerOpen, setIsJudgePickerOpen] = useState(false);
  const isActiveJudgeCompleted = Boolean(activeJudgeSession?.finalized);
  const isCompleted = isMultiJudgeMode ? isActiveJudgeCompleted : isClassCompleted;
  const isSecretariatValidated = Boolean(
    classData?.official?.isSecretariatValidated
  );

  const classStatus = isCompleted ? "completed" : getClassStatus(classItem);
  const classStatusLabel = getClassStatusLabel(classStatus, t);
  const publicationStatus = classData?.publication?.status || "";
  const plannedLiveStatus = getPlannedLiveStatus(classData?.publication);

  const patternValue = classSetup?.pattern || classItem?.pattern || "";
  const customPattern =
    classSetup?.customPattern || classItem?.customPattern || null;
  const headers = useMemo(
    () => getPatternHeaders(patternValue, customPattern),
    [patternValue, customPattern]
  );
  const scoringOptions = useMemo(
    () => getScoringOptionsForPattern(patternValue, customPattern),
    [patternValue, customPattern]
  );
  const scoreOptions = scoringOptions.scoreOptions;
  const penaltyOptions = scoringOptions.penaltyOptions;
  const specialPenaltyTokens = scoringOptions.specialPenaltyTokens;
  const statusPenaltyOptions = scoringOptions.statusPenaltyOptions;
  const scoreOptionsByIndex = useMemo(
    () => getScoreOptionsByIndex(headers, scoringOptions),
    [headers, scoringOptions]
  );
  const penaltyDisabledIndexes = useMemo(
    () => getPenaltyDisabledIndexes(headers, scoringOptions),
    [headers, scoringOptions]
  );
  const penaltyDisabledIndexSet = useMemo(
    () => new Set(penaltyDisabledIndexes),
    [penaltyDisabledIndexes]
  );
  const scoringCalculationOptions = useMemo(
    () => getScoringCalculationOptions(headers, scoringOptions),
    [headers, scoringOptions]
  );
  const maneuverCount = headers.length;
  const hasRailAdjustment = patternHasRailAdjustment(patternValue, customPattern);
  const isDrawImported = Boolean(classSetup?.isDrawImported);
  const canEditBackNumbers =
    !isCompleted &&
    !isDrawImported &&
    (!isMultiJudgeMode || judgeClaimState.status === "claimed");

  const [runs, setRuns] = useState(() =>
    loadRunsForClass(classId, maneuverCount, scoringCalculationOptions)
  );
  const setApprovalMode = normalizeSetApprovalMode(
    classSetup?.setApprovalMode
  );
  const activeSetApprovals = useMemo(
    () =>
      normalizeSetApprovals(
        isMultiJudgeMode
          ? activeJudgeSession?.setApprovals
          : classSetup?.setApprovals
      ),
    [
      activeJudgeSession?.setApprovals,
      classSetup?.setApprovals,
      isMultiJudgeMode,
    ]
  );
  const lockedRunKeys = useMemo(
    () => getLockedRunKeys(activeSetApprovals),
    [activeSetApprovals]
  );
  const isRunLockedByApproval = useCallback(
    (run, index) => lockedRunKeys.has(getRunApprovalKey(run, index)),
    [lockedRunKeys]
  );
  const isDrawLockedByApproval = useCallback(
    (draw) => {
      const runIndex = runs.findIndex((run) => run.draw === draw);
      return (
        runIndex >= 0 &&
        isRunLockedByApproval(runs[runIndex], runIndex)
      );
    },
    [isRunLockedByApproval, runs]
  );
  const lastPersistedRunsRef = useRef(JSON.stringify(runs));
  const lastLoadedScoringRunsRef = useRef([]);
  const [activeManoeuvre, setActiveManoeuvre] = useState(() =>
    isCompleted ? null : loadActiveManoeuvre(classId)
  );
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [scoringDataLossWarning, setScoringDataLossWarning] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [scoringSyncStatus, setScoringSyncStatus] = useState(() =>
    getScoringRunsSyncStatus(classId)
  );
  const [scoringSyncError, setScoringSyncError] = useState("");
  const [scoringSyncErrorRefreshKey, setScoringSyncErrorRefreshKey] =
    useState(0);
  const updateScoringSyncStatus = useCallback((status) => {
    setScoringSyncStatus(status);
    setScoringSyncErrorRefreshKey((value) => value + 1);
  }, []);

  const [showFinalizeBox, setShowFinalizeBox] = useState(false);
  const [pendingSetApproval, setPendingSetApproval] = useState(null);
  const [setApprovalSignature, setSetApprovalSignature] = useState(null);
  const [isSavingSetApproval, setIsSavingSetApproval] = useState(false);
  const [showProvisionalRanking, setShowProvisionalRanking] = useState(false);
  const [judgeName, setJudgeName] = useState(assignedJudgeName);
  const [judgeSignature, setJudgeSignature] = useState(
    classSetup?.judgeSignature || null
  );

  useEffect(() => {
    let isMounted = true;

    async function loadClassData() {
      setHasLoadedSession(false);
      const nextData = await getClassFullDataRepository(classId);
      if (!isMounted) return;

      const nextClassItem = nextData?.classItem;
      const nextSetup = nextData?.setup || {};
      const nextJudges = normalizeClassJudges({
        judges: nextSetup?.judges,
        judgeName: nextSetup?.judgeName || nextClassItem?.judgeName,
      });
      const nextIsMultiJudgeMode = nextJudges.length > 1;
      const nextPatternValue = nextSetup.pattern || nextClassItem?.pattern || "";
      const nextCustomPattern =
        nextSetup.customPattern || nextClassItem?.customPattern || null;
      const nextManeuverCount = getPatternHeaders(
        nextPatternValue,
        nextCustomPattern
      ).length;
      const nextHeaders = getPatternHeaders(nextPatternValue, nextCustomPattern);
      const nextScoringOptions = getScoringOptionsForPattern(
        nextPatternValue,
        nextCustomPattern
      );
      const nextScoringCalculationOptions = getScoringCalculationOptions(
        nextHeaders,
        nextScoringOptions
      );
      const baseRuns = buildBaseRunsFromSetup(
        classId,
        nextManeuverCount,
        nextScoringCalculationOptions
      );
      const loadedScoringRuns = nextIsMultiJudgeMode
        ? []
        : nextData?.scoringRuns || [];
      const nextRuns = mergeScoringRuns(
        baseRuns,
        loadedScoringRuns,
        nextManeuverCount,
        nextScoringCalculationOptions
      );
      const nextScoringDataLossWarning = buildScoringDataLossWarning(
        loadedScoringRuns,
        nextRuns
      );
      const nextActiveManoeuvre = loadActiveManoeuvre(classId);
      const nextIsCompleted = isClassScoringFinalized(nextData);

      setClassData(nextData);
      setActiveJudgeId((currentJudgeId) => {
        if (!nextIsMultiJudgeMode) {
          return nextJudges[0]?.id || "judge-1";
        }

        return nextJudges.some((judge) => judge.id === currentJudgeId)
          ? currentJudgeId
          : "";
      });
      setRuns(nextRuns);
      lastPersistedRunsRef.current = JSON.stringify(nextRuns);
      lastLoadedScoringRunsRef.current = loadedScoringRuns;
      setScoringDataLossWarning(nextScoringDataLossWarning);
      setActiveManoeuvre(
        nextIsCompleted ||
          nextIsMultiJudgeMode ||
          !activeManoeuvreExistsInRuns(nextActiveManoeuvre, nextRuns)
          ? null
          : nextActiveManoeuvre
      );
      updateScoringSyncStatus(
        nextIsMultiJudgeMode
          ? getJudgeScoringSessionSyncStatus(classId)
          : getScoringRunsSyncStatus(classId)
      );
      setHasLoadedSession(!nextIsMultiJudgeMode);
    }

    loadClassData();

    return () => {
      isMounted = false;
    };
  }, [classId, updateScoringSyncStatus]);

  useEffect(() => {
    if (scoringSyncStatus !== SCORING_SYNC_STATUS.PENDING) {
      setScoringSyncError("");
      return;
    }

    const failure = isMultiJudgeMode
      ? getJudgeScoringSessionSyncFailure(classId, activeJudge?.id || null)
      : getScoringRunsSyncFailure(classId);

    setScoringSyncError(failure?.lastError || "");
  }, [
    activeJudge?.id,
    classId,
    isMultiJudgeMode,
    scoringSyncErrorRefreshKey,
    scoringSyncStatus,
  ]);

  useEffect(() => {
    if (isMultiJudgeMode) {
      if (
        activeJudgeId &&
        !classJudges.some((judge) => judge.id === activeJudgeId)
      ) {
        setActiveJudgeId("");
      }
      return;
    }

    if (!activeJudgeId && classJudges[0]?.id) {
      setActiveJudgeId(classJudges[0].id);
    }
  }, [activeJudgeId, classJudges, isMultiJudgeMode]);

  useEffect(() => {
    if (isMultiJudgeMode && !activeJudgeId) {
      setIsJudgePickerOpen(true);
    }
  }, [activeJudgeId, isMultiJudgeMode]);

  useEffect(() => {
    if (!isMultiJudgeMode) return undefined;

    if (!activeJudge?.id) {
      setActiveJudgeSession(null);
      setJudgeClaimState({ status: "idle", session: null });
      setActiveManoeuvre(null);
      setJudgeName("");
      setJudgeSignature(null);
      lastLoadedScoringRunsRef.current = [];
      setScoringDataLossWarning(null);
      setHasLoadedSession(true);
      return undefined;
    }

    let isMounted = true;

    async function loadAndClaimJudgeSession() {
      setHasLoadedSession(false);
      setJudgeClaimState({ status: "loading", session: null });

      if (auth.isLoading) {
        return;
      }

      if (!auth.user?.id) {
        setJudgeClaimState({ status: "missing-user", session: null });
        setHasLoadedSession(true);
        return;
      }

      const result = await claimJudgeScoringSessionRepository({
        classId,
        judge: activeJudge,
        user: auth.user,
      });

      if (!isMounted) return;

      const session = result.session;
      setActiveJudgeSession(session);
      setJudgeClaimState({
        status: result.ok ? "claimed" : result.reason || "claim-error",
        session,
        isLocalFallback: result.isLocalFallback || false,
      });

      const baseRuns = buildBaseRunsFromSetup(
        classId,
        maneuverCount,
        scoringCalculationOptions
      );
      const nextRuns = mergeScoringRuns(
        baseRuns,
        session?.runs || [],
        maneuverCount,
        scoringCalculationOptions
      );
      const nextScoringDataLossWarning = buildScoringDataLossWarning(
        session?.runs || [],
        nextRuns
      );

      setRuns(nextRuns);
      lastPersistedRunsRef.current = JSON.stringify(nextRuns);
      lastLoadedScoringRunsRef.current = session?.runs || [];
      setScoringDataLossWarning(nextScoringDataLossWarning);
      setActiveManoeuvre(session?.activeManoeuvre || null);
      setJudgeName(session?.judgeName || activeJudgeName);
      setJudgeSignature(session?.judgeSignature || null);
      setHasLoadedSession(true);
    }

    loadAndClaimJudgeSession();

    return () => {
      isMounted = false;
    };
  }, [
    activeJudge,
    activeJudgeName,
    auth.isLoading,
    auth.user,
    classId,
    isMultiJudgeMode,
    maneuverCount,
    scoringCalculationOptions,
  ]);

  useEffect(() => {
    if (isMultiJudgeMode) return;

    const nextRuns = loadRunsForClass(
      classId,
      maneuverCount,
      scoringCalculationOptions
    );

    setRuns((prevRuns) => {
      const prevSerialized = JSON.stringify(prevRuns);
      const nextSerialized = JSON.stringify(nextRuns);
      return prevSerialized === nextSerialized ? prevRuns : nextRuns;
    });

    if (isCompleted) {
      setActiveManoeuvre(null);
      return;
    }

    const nextActiveManoeuvre = loadActiveManoeuvre(classId);

    if (activeManoeuvreExistsInRuns(nextActiveManoeuvre, nextRuns)) {
      setActiveManoeuvre((prev) =>
        sameActiveManoeuvre(prev, nextActiveManoeuvre)
          ? prev
          : nextActiveManoeuvre
      );
    } else {
      setActiveManoeuvre((prev) => (prev ? null : prev));
    }
  }, [
    classId,
    maneuverCount,
    scoringCalculationOptions,
    isCompleted,
    isMultiJudgeMode,
  ]);

  useEffect(() => {
    const setupRuns = Array.isArray(classSetup?.runs) ? classSetup.runs : [];

    setRuns((prevRuns) => {
      const baseRuns = buildBaseRunsFromSetup(
        classId,
        maneuverCount,
        scoringCalculationOptions
      );
      const mergedRuns = mergeScoringRuns(
        baseRuns,
        prevRuns,
        maneuverCount,
        scoringCalculationOptions
      );

      const prevSerialized = JSON.stringify(prevRuns);
      const nextSerialized = JSON.stringify(mergedRuns);

      return prevSerialized === nextSerialized ? prevRuns : mergedRuns;
    });

    if (isCompleted) {
      setActiveManoeuvre(null);
      return;
    }

    setActiveManoeuvre((prevActive) => {
      if (!prevActive) return prevActive;

      if (prevActive.type === LIVE_QUEUE_ITEM_TYPES.DRAG) {
        return Number.isInteger(prevActive.afterIndex) &&
          prevActive.afterIndex >= 0 &&
          prevActive.afterIndex < setupRuns.length
          ? prevActive
          : null;
      }

      const stillExists = setupRuns.some(
        (run, index) => getSetupRunDraw(run, index) === prevActive.draw
      );
      const manoeuvreStillExists = prevActive.manoeuvreIndex < maneuverCount;

      return stillExists && manoeuvreStillExists ? prevActive : null;
    });
  }, [classId, classSetup, maneuverCount, scoringCalculationOptions, isCompleted]);

  useEffect(() => {
    if (!hasLoadedSession) return;
    const serializedRuns = JSON.stringify(runs);
    const nextScoringDataLossWarning = buildScoringDataLossWarning(
      lastLoadedScoringRunsRef.current,
      runs
    );

    if (nextScoringDataLossWarning?.severity === "blocked") {
      setScoringDataLossWarning(nextScoringDataLossWarning);
      return;
    }

    if (lastPersistedRunsRef.current === serializedRuns) {
      updateScoringSyncStatus(
        isMultiJudgeMode
          ? getJudgeScoringSessionSyncStatus(classId)
          : getScoringRunsSyncStatus(classId)
      );
      return;
    }

    lastPersistedRunsRef.current = serializedRuns;
    setScoringDataLossWarning(nextScoringDataLossWarning);

    if (isMultiJudgeMode) {
      if (judgeClaimState.status !== "claimed" || !activeJudge?.id) {
        return;
      }

      let isCancelled = false;

      saveJudgeScoringSessionRepository({
        classId,
        judge: activeJudge,
        updates: {
          ...activeJudgeSession,
          runs,
          activeManoeuvre,
          judgeName: activeJudgeName,
        },
        debounceMs: SCORING_SYNC_DEBOUNCE_MS,
        onStatusChange: updateScoringSyncStatus,
      })
        .then((session) => {
          if (isCancelled) return;

          const isClaimedByOther = Boolean(
            session?.claimedBy &&
              auth.user?.id &&
              String(session.claimedBy) !== String(auth.user.id)
          );

          setActiveJudgeSession(session);
          setJudgeClaimState((current) => ({
            ...current,
            status: isClaimedByOther ? "claimed-by-other" : current.status,
            session,
          }));
        })
        .catch(() => {
          if (!isCancelled) {
            updateScoringSyncStatus(SCORING_SYNC_STATUS.PENDING);
          }
        });

      return () => {
        isCancelled = true;
      };
    }

    saveScoringRunsRepository(classId, runs, {
      debounceMs: SCORING_SYNC_DEBOUNCE_MS,
      onStatusChange: updateScoringSyncStatus,
    })
      .catch(() => {
        updateScoringSyncStatus(SCORING_SYNC_STATUS.PENDING);
      });
  }, [
    activeJudge,
    activeJudgeName,
    activeJudgeSession,
    activeManoeuvre,
    auth.user?.id,
    classId,
    isMultiJudgeMode,
    judgeClaimState.status,
    runs,
    hasLoadedSession,
    updateScoringSyncStatus,
  ]);

  useEffect(() => {
    let isMounted = true;

    const updateSyncStatus = (status) => {
      if (isMounted) updateScoringSyncStatus(status);
    };

    const retryPendingSync = () => {
      const getStatus = isMultiJudgeMode
        ? getJudgeScoringSessionSyncStatus
        : getScoringRunsSyncStatus;
      const flushQueue = isMultiJudgeMode
        ? flushJudgeScoringSessionSyncQueue
        : flushScoringSyncQueue;

      updateSyncStatus(getStatus(classId));
      flushQueue({
        classId,
        onStatusChange: updateSyncStatus,
      })
        .then(() => {
          updateSyncStatus(getStatus(classId));
        })
        .catch(() => {
          updateSyncStatus(SCORING_SYNC_STATUS.PENDING);
        });
    };

    retryPendingSync();
    window.addEventListener("online", retryPendingSync);

    return () => {
      isMounted = false;
      window.removeEventListener("online", retryPendingSync);
    };
  }, [classId, isMultiJudgeMode, updateScoringSyncStatus]);

  useEffect(() => {
    if (scoringSyncStatus !== SCORING_SYNC_STATUS.PENDING) {
      return undefined;
    }

    let isFlushing = false;
    const retryPendingSync = async () => {
      if (isFlushing) return;
      isFlushing = true;

      const getStatus = isMultiJudgeMode
        ? getJudgeScoringSessionSyncStatus
        : getScoringRunsSyncStatus;
      const flushQueue = isMultiJudgeMode
        ? flushJudgeScoringSessionSyncQueue
        : flushScoringSyncQueue;

      try {
        await flushQueue({
          classId,
          onStatusChange: updateScoringSyncStatus,
        });
        updateScoringSyncStatus(getStatus(classId));
      } catch (error) {
        updateScoringSyncStatus(SCORING_SYNC_STATUS.PENDING);
      } finally {
        isFlushing = false;
      }
    };

    const retryTimer = window.setInterval(
      retryPendingSync,
      SCORING_SYNC_RETRY_MS
    );

    return () => {
      window.clearInterval(retryTimer);
    };
  }, [
    classId,
    isMultiJudgeMode,
    scoringSyncStatus,
    updateScoringSyncStatus,
  ]);

  useEffect(() => {
    if (!hasLoadedSession) return;
    if (scoringDataLossWarning?.severity === "blocked") return;
    if (isMultiJudgeMode) {
      return;
    }

    saveActiveManoeuvreRepository(classId, activeManoeuvre);
  }, [
    activeManoeuvre,
    classId,
    isMultiJudgeMode,
    hasLoadedSession,
    scoringDataLossWarning?.severity,
  ]);

  useEffect(() => {
    setJudgeName(assignedJudgeName);
    setJudgeSignature(
      isMultiJudgeMode
        ? activeJudgeSession?.judgeSignature || null
        : classSetup?.judgeSignature || null
    );
  }, [
    activeJudgeSession?.judgeSignature,
    assignedJudgeName,
    classSetup?.judgeSignature,
    isMultiJudgeMode,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const activeRunDraw = useMemo(() => {
    if (
      activeManoeuvre?.type !== LIVE_QUEUE_ITEM_TYPES.DRAG &&
      activeManoeuvre?.draw != null
    ) {
      return activeManoeuvre.draw;
    }
    return runs.find((run) => run.isActive)?.draw ?? null;
  }, [activeManoeuvre, runs]);
  const activeDrag = useMemo(
    () =>
      activeManoeuvre?.type === LIVE_QUEUE_ITEM_TYPES.DRAG
        ? activeManoeuvre
        : null,
    [activeManoeuvre]
  );

  const runCount = runs.length;
  const canFinalize = canFinalizeClass(runs, maneuverCount);
  const hasPendingVideoReview = runs.some(runHasVideoReview);
  const timingSummary = useMemo(
    () =>
      calculateClassTimingSummary({
        runs,
        maneuverCount,
        startedAt: classSetup?.startedAt,
        dragInterval: classSetup?.dragInterval,
        dragDurationMinutes: classSetup?.dragDurationMinutes,
        now: currentTime,
      }),
    [
      runs,
      maneuverCount,
      classSetup?.startedAt,
      classSetup?.dragInterval,
      classSetup?.dragDurationMinutes,
      currentTime,
    ]
  );
  const hasBlockingScoringSync = isScoringSyncBlockingStatus(scoringSyncStatus);
  const hasBlockedScoringDataLoss =
    scoringDataLossWarning?.severity === "blocked";
  const canUseActiveJudgeSession =
    !isMultiJudgeMode || judgeClaimState.status === "claimed";
  const canEditScores =
    !isCompleted && !hasBlockedScoringDataLoss && canUseActiveJudgeSession;
  const canSignClass =
    canFinalize &&
    !hasBlockedScoringDataLoss &&
    canUseActiveJudgeSession &&
    (isMultiJudgeMode || !hasBlockingScoringSync);
  const provisionalRanking = useMemo(() => buildProvisionalRanking(runs), [runs]);
  const canShowProvisionalRanking =
    hasRailAdjustment &&
    provisionalRanking.length > 0 &&
    (canFinalize || isCompleted);

  const ensureClassStartedAt = (timestamp = new Date().toISOString()) => {
    const localSetup = getClassSetup(classId);
    const existingStartedAt = classSetup?.startedAt || localSetup.startedAt;

    if (existingStartedAt) {
      return existingStartedAt;
    }

    const nextSetup = {
      ...localSetup,
      ...(classSetup || {}),
      startedAt: timestamp,
    };

    setClassData((currentData) =>
      currentData
        ? {
            ...currentData,
            setup: {
              ...(currentData.setup || {}),
              startedAt: timestamp,
            },
          }
        : currentData
    );

    saveSetupForClassRepository(classId, nextSetup).catch((error) => {
      console.error("Erreur démarrage bloc:", error);
    });
    saveScoringStartedAtRepository(classId, timestamp).catch((error) => {
      console.error("Erreur démarrage scoring:", error);
    });
    if (classItem?.showId && show?.status !== "active") {
      activateShowForScoringRepository({
        classId,
        showId: classItem.showId,
      }).catch((error) => {
        console.error("Erreur activation show:", error);
      });
    }

    return timestamp;
  };

  useEffect(() => {
    const startedAt = classSetup?.startedAt;
    const showId = classItem?.showId;

    if (!startedAt || !showId || isCompleted) {
      return;
    }

    if (
      isLivePublicationStatus(publicationStatus) ||
      plannedLiveStatus === PUBLICATION_STATUSES.HIDDEN
    ) {
      return;
    }

    const syncKey = [
      classId,
      startedAt,
      publicationStatus || PUBLICATION_STATUSES.HIDDEN,
      plannedLiveStatus,
    ].join(":");

    if (liveActivationSyncRef.current === syncKey) {
      return;
    }

    liveActivationSyncRef.current = syncKey;

    saveArenaCurrentLiveClassRepository({
      showId,
      arena: classItem?.arena,
      classId,
      status: plannedLiveStatus,
    })
      .then((savedPublication) => {
        if (!savedPublication) return;

        setClassData((currentData) =>
          currentData
            ? {
                ...currentData,
                publication: savedPublication,
              }
            : currentData
        );
      })
      .catch((error) => {
        console.error("Erreur activation live du bloc:", error);
      });
  }, [
    classId,
    classItem?.arena,
    classItem?.showId,
    classSetup?.startedAt,
    isCompleted,
    plannedLiveStatus,
    publicationStatus,
  ]);

  const updateBackNumber = (draw, newValue) => {
    if (!canEditBackNumbers || isDrawLockedByApproval(draw)) return;

    setRuns((prevRuns) =>
      prevRuns.map((run) =>
        run.draw === draw
          ? {
              ...run,
              backNumber: newValue,
            }
          : run
      )
    );
  };

  const updateRunNote = (draw, newValue) => {
    if (!canEditScores || isDrawLockedByApproval(draw)) return;

    setRuns((prevRuns) =>
      prevRuns.map((run) =>
        run.draw === draw
          ? {
              ...run,
              note: newValue,
              isActive: true,
            }
          : {
              ...run,
              isActive: false,
            }
      )
    );

    setActiveManoeuvre({
      draw,
      manoeuvreIndex: 0,
    });
  };

  const updateScoreCell = (draw, manoeuvreIndex, newValue) => {
    if (!canEditScores || isDrawLockedByApproval(draw)) return;

    const changedAt = new Date().toISOString();
    if (String(newValue || "").trim()) {
      ensureClassStartedAt(changedAt);
    }

    setRuns((prevRuns) =>
      prevRuns.map((run) => {
        if (run.draw !== draw) {
          return {
            ...run,
            isActive: false,
          };
        }

        const nextScores = Array.isArray(run.scores)
          ? [...run.scores]
          : Array(maneuverCount).fill("");

        while (nextScores.length < maneuverCount) nextScores.push("");
        nextScores[manoeuvreIndex] = newValue;

        return stampRunTiming(
          recalculateRun(
            {
              ...run,
              isActive: true,
              scores: nextScores.slice(0, maneuverCount),
            },
            scoringCalculationOptions
          ),
          maneuverCount,
          changedAt
        );
      })
    );

    setActiveManoeuvre({
      draw,
      manoeuvreIndex,
    });
  };

  const clearScoreCell = (draw, manoeuvreIndex) => {
    if (!canEditScores || isDrawLockedByApproval(draw)) return;
    updateScoreCell(draw, manoeuvreIndex, "");
  };

  const addPenaltyToken = (draw, manoeuvreIndex, token) => {
    if (!canEditScores || isDrawLockedByApproval(draw)) return;
    if (penaltyDisabledIndexSet.has(manoeuvreIndex)) return;
    if (isSpecialPenaltyReasonRequired(token)) return;

    const changedAt = new Date().toISOString();
    ensureClassStartedAt(changedAt);

    setRuns((prevRuns) =>
      prevRuns.map((run) => {
        if (run.draw !== draw) {
          return {
            ...run,
            isActive: false,
          };
        }

        const nextPenalties = Array.isArray(run.penalties)
          ? [...run.penalties]
          : Array(maneuverCount).fill("");

        while (nextPenalties.length < maneuverCount) nextPenalties.push("");

        nextPenalties[manoeuvreIndex] = appendPenaltyToken(
          nextPenalties[manoeuvreIndex],
          token,
          specialPenaltyTokens
        );

        return stampRunTiming(
          recalculateRun(
            {
              ...run,
              isActive: true,
              penalties: nextPenalties.slice(0, maneuverCount),
            },
            scoringCalculationOptions
          ),
          maneuverCount,
          changedAt
        );
      })
    );

    setActiveManoeuvre({
      draw,
      manoeuvreIndex,
    });
  };

  const toggleSpecialPenalty = (
    draw,
    manoeuvreIndex,
    token,
    reasonId = "",
    manualComment = ""
  ) => {
    if (!canEditScores || isDrawLockedByApproval(draw)) return;
    if (penaltyDisabledIndexSet.has(manoeuvreIndex)) return;

    const changedAt = new Date().toISOString();
    const currentRun = runs.find((run) => run.draw === draw);
    const currentPenalties = Array.isArray(currentRun?.penalties)
      ? currentRun.penalties
      : [];
    const wasSelectedBefore = splitPenaltyTokens(
      currentPenalties[manoeuvreIndex],
      specialPenaltyTokens
    ).includes(token);

    if (
      !wasSelectedBefore &&
      isSpecialPenaltyReasonRequired(token) &&
      !isValidSpecialPenaltyReason(token, reasonId, manualComment)
    ) {
      return;
    }

    ensureClassStartedAt(changedAt);

    setRuns((prevRuns) =>
      prevRuns.map((run) => {
        if (run.draw !== draw) {
          return {
            ...run,
            isActive: false,
          };
        }

        const nextPenalties = Array.isArray(run.penalties)
          ? [...run.penalties]
          : Array(maneuverCount).fill("");

        while (nextPenalties.length < maneuverCount) nextPenalties.push("");

        nextPenalties[manoeuvreIndex] = togglePenaltySpecialToken(
          nextPenalties[manoeuvreIndex],
          token,
          specialPenaltyTokens
        );

        const nextNote = syncSpecialPenaltyReasonNotes(
          run.note,
          nextPenalties,
          specialPenaltyTokens,
          token,
          reasonId,
          manualComment
        );

        return stampRunTiming(
          recalculateRun(
            {
              ...run,
              isActive: true,
              penalties: nextPenalties.slice(0, maneuverCount),
              note: nextNote,
            },
            scoringCalculationOptions
          ),
          maneuverCount,
          changedAt
        );
      })
    );

    setActiveManoeuvre({
      draw,
      manoeuvreIndex,
    });
  };

  const clearPenaltyCell = (draw, manoeuvreIndex) => {
    if (!canEditScores || isDrawLockedByApproval(draw)) return;
    if (penaltyDisabledIndexSet.has(manoeuvreIndex)) return;

    const changedAt = new Date().toISOString();

    setRuns((prevRuns) =>
      prevRuns.map((run) => {
        if (run.draw !== draw) {
          return {
            ...run,
            isActive: false,
          };
        }

        const nextPenalties = Array.isArray(run.penalties)
          ? [...run.penalties]
          : Array(maneuverCount).fill("");

        while (nextPenalties.length < maneuverCount) nextPenalties.push("");
        nextPenalties[manoeuvreIndex] = removeLastPenaltyToken(
          nextPenalties[manoeuvreIndex],
          specialPenaltyTokens
        );

        const nextNote = syncSpecialPenaltyReasonNotes(
          run.note,
          nextPenalties,
          specialPenaltyTokens,
          "",
          "",
          ""
        );

        return stampRunTiming(
          recalculateRun(
            {
              ...run,
              isActive: true,
              penalties: nextPenalties.slice(0, maneuverCount),
              note: nextNote,
            },
            scoringCalculationOptions
          ),
          maneuverCount,
          changedAt
        );
      })
    );

    setActiveManoeuvre({
      draw,
      manoeuvreIndex,
    });
  };

  const canStartDragAfterRun = useCallback(
    (afterIndex) => {
      if (!canEditScores) return false;
      if (!Number.isInteger(afterIndex) || afterIndex < 0) return false;

      return runs
        .slice(0, afterIndex + 1)
        .every(
          (run) => isRunComplete(run, maneuverCount) || runHasVideoReview(run)
        );
    },
    [canEditScores, maneuverCount, runs]
  );

  const activateDragBreak = (afterIndex) => {
    const changedAt = new Date().toISOString();
    ensureClassStartedAt(changedAt);
    const afterRun = runs[afterIndex] || null;

    setRuns((prevRuns) =>
      prevRuns.map((run) => ({
        ...run,
        isActive: false,
      }))
    );
    setActiveManoeuvre({
      type: LIVE_QUEUE_ITEM_TYPES.DRAG,
      id: getLiveDragItemId(afterRun, afterIndex),
      afterIndex,
      afterDraw: afterRun?.draw || afterIndex + 1,
      startedAt: changedAt,
      durationMinutes: timingSummary.dragDurationMinutes,
    });
  };

  const focusFirstPendingVideoReview = (setRange) => {
    const [reviewRun] = getPendingVideoReviewRunsForSet(setRange);

    if (!reviewRun) return false;

    const manoeuvreIndex = (reviewRun.penalties || []).findIndex((penalty) =>
      splitPenaltyTokens(penalty, specialPenaltyTokens).includes(
        "Révision vidéo"
      )
    );

    setActiveManoeuvre({
      draw: reviewRun.draw,
      manoeuvreIndex: Math.max(manoeuvreIndex, 0),
    });
    alert(
      t("management.scoring.setVideoReviewRequired", {
        draw: reviewRun.draw,
      })
    );
    return true;
  };

  const requestSetApproval = (
    endIndex,
    { startDragAfterApproval = false } = {}
  ) => {
    const setRange = getNextSetRange({
      runs,
      approvals: activeSetApprovals,
      endIndex,
    });

    if (!setRange) {
      if (startDragAfterApproval) {
        activateDragBreak(endIndex);
      }
      return;
    }

    if (focusFirstPendingVideoReview(setRange)) {
      return;
    }

    setPendingSetApproval({
      ...setRange,
      startDragAfterApproval,
    });
    setSetApprovalSignature(null);
    setShowFinalizeBox(false);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const startDragBreak = (afterIndex) => {
    if (!canStartDragAfterRun(afterIndex)) return;

    if (setApprovalMode === SET_APPROVAL_MODES.PER_SET) {
      requestSetApproval(afterIndex, { startDragAfterApproval: true });
      return;
    }

    activateDragBreak(afterIndex);
  };

  const stopDragBreak = (afterIndex) => {
    if (!canEditScores) return;
    if (activeDrag?.afterIndex !== afterIndex) return;

    setActiveManoeuvre(null);
  };

  const setActiveManoeuvreWithRun = (value) => {
    if (!canEditScores) return;
    if (value?.draw && isDrawLockedByApproval(value.draw)) return;

    setActiveManoeuvre(value);

    if (!value?.draw) {
      setRuns((prevRuns) =>
        prevRuns.map((run) => ({
          ...run,
          isActive: false,
        }))
      );
      return;
    }

    setRuns((prevRuns) =>
      prevRuns.map((run) => ({
        ...run,
        isActive: run.draw === value.draw,
      }))
    );
  };

  const requestJudgeChange = (judgeId) => {
    if (judgeId === activeJudgeId) {
      setIsJudgePickerOpen(false);
      return;
    }

    const nextIndex = classJudges.findIndex((judge) => judge.id === judgeId);
    const nextJudge = classJudges[nextIndex];
    const nextJudgeName = getJudgeDisplayName(nextJudge, nextIndex);
    const confirmed =
      !activeJudgeId ||
      window.confirm(
        t("management.scoring.confirmJudgeChange", {
          judgeName: nextJudgeName,
        })
      );

    if (!confirmed) return;

    setShowFinalizeBox(false);
    setActiveManoeuvre(null);
    setActiveJudgeSession(null);
    setJudgeClaimState({ status: "idle", session: null });
    setActiveJudgeId(judgeId);
    setIsJudgePickerOpen(false);
  };

  const handleDownloadOfficialPdf = () => {
    if (!isSecretariatValidated) {
      alert(t("management.classes.pdfAfterValidation"));
      return;
    }

    const headersForPdf = getPatternHeaders(patternValue, customPattern);

    const pdf = generateScorePdf({
      associationName: association?.name || "Association",
      associationLogoDataUrl: association?.logoDataUrl || null,
      eventName: show?.name || "",
      eventDate: day?.date || "",
      classItem,
      classSetup: getClassSetup(classId),
      runs,
      headers: headersForPdf,
    });

    const fileName = buildScorePdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: show?.name || "show",
      className: classItem?.name || "bloc",
      finalizedAt:
        getClassSetup(classId)?.finalizedAt || new Date().toISOString(),
    });

    pdf.save(fileName);
  };

  const handleExportProvisionalPdf = () => {
    const exportedAt = new Date().toISOString();
    const currentSetup = {
      ...(classSetup || {}),
      ...getClassSetup(classId),
    };
    const currentJudgeName =
      assignedJudgeName || currentSetup?.judgeName || classItem?.judgeName || "";

    const pdf = generateScorePdf({
      associationName: association?.name || "Association",
      associationLogoDataUrl: association?.logoDataUrl || null,
      eventName: show?.name || "",
      eventDate: day?.date || "",
      classItem,
      classSetup: {
        ...currentSetup,
        judgeName: currentJudgeName,
        judgeSignature: null,
        finalizedAt: null,
        judgeSignedAt: null,
      },
      runs,
      headers,
      titleSuffix: t("management.scoring.provisionalPdfTitle"),
    });

    const provisionalClassName = `${classItem?.name || "bloc"}-provisoire`;
    const fileName =
      isMultiJudgeMode && currentJudgeName
        ? buildJudgeScorePdfFileName({
            associationAbbreviation: association?.shortName || "ASSOC",
            showName: show?.name || "show",
            className: provisionalClassName,
            judgeName: currentJudgeName,
            finalizedAt: exportedAt,
          })
        : buildScorePdfFileName({
            associationAbbreviation: association?.shortName || "ASSOC",
            showName: show?.name || "show",
            className: provisionalClassName,
            finalizedAt: exportedAt,
          });

    pdf.save(fileName);
  };

  const handleRetryScoringSync = () => {
    updateScoringSyncStatus(SCORING_SYNC_STATUS.SYNCING);

    const getStatus = isMultiJudgeMode
      ? getJudgeScoringSessionSyncStatus
      : getScoringRunsSyncStatus;
    const flushQueue = isMultiJudgeMode
      ? flushJudgeScoringSessionSyncQueue
      : flushScoringSyncQueue;

    flushQueue({
      classId,
      onStatusChange: updateScoringSyncStatus,
    })
      .then(() => {
        updateScoringSyncStatus(getStatus(classId));
      })
      .catch(() => {
        updateScoringSyncStatus(SCORING_SYNC_STATUS.PENDING);
      });
  };

  const handleExportLocalScoringBackup = () => {
    const exportedAt = new Date().toISOString();
    const payload = {
      type: "reining-app-scoring-backup",
      version: 1,
      exportedAt,
      classId,
      scoringSyncStatus: isMultiJudgeMode
        ? getJudgeScoringSessionSyncStatus(classId)
        : getScoringRunsSyncStatus(classId),
      association,
      show,
      day,
      classItem,
      classSetup: getClassSetup(classId),
      activeManoeuvre,
      runs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const fileName = [
      "scoring-backup",
      sanitizeFilePart(classItem?.name, "bloc"),
      sanitizeFilePart(exportedAt.slice(0, 19), "date"),
    ].join("-");

    link.href = url;
    link.download = `${fileName}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const fillScoringTestData = (fillOne = false) => {
    if (!isTestAssociation || !canEditScores) return;

    const fillRange = getScoringTestFillRange({
      runs,
      maneuverCount,
      dragInterval: classSetup?.dragInterval,
      isRunLocked: isRunLockedByApproval,
      fillOne,
    });

    if (!fillRange) {
      alert(t("management.scoring.testDataComplete"));
      return;
    }

    const completedAt = new Date().toISOString();
    ensureClassStartedAt(completedAt);
    setActiveManoeuvre(null);
    setRuns((currentRuns) =>
      currentRuns.map((run, runIndex) =>
        runIndex >= fillRange.startIndex &&
        runIndex <= fillRange.endIndex &&
        !isRunLockedByApproval(run, runIndex)
          ? buildCompletedScoringTestRun({
              run,
              runIndex,
              maneuverCount,
              scoreOptionsByIndex,
              penaltyOptions,
              scoringCalculationOptions,
              completedAt,
            })
          : run
      )
    );
  };

  const ensureScoringSyncedBeforeFinalize = async () => {
    const getStatus = isMultiJudgeMode
      ? getJudgeScoringSessionSyncStatus
      : getScoringRunsSyncStatus;
    const flushQueue = isMultiJudgeMode
      ? flushJudgeScoringSessionSyncQueue
      : flushScoringSyncQueue;
    const currentStatus = getStatus(classId);

    if (!isScoringSyncBlockingStatus(currentStatus)) {
      return true;
    }

    updateScoringSyncStatus(SCORING_SYNC_STATUS.SYNCING);

    try {
      await flushQueue({
        classId,
        onStatusChange: updateScoringSyncStatus,
      });
    } catch (error) {
      updateScoringSyncStatus(SCORING_SYNC_STATUS.PENDING);
    }

    const nextStatus = getStatus(classId);
    updateScoringSyncStatus(nextStatus);

    if (isScoringSyncBlockingStatus(nextStatus)) {
      alert(t("management.scoring.finalizeSyncBlocked"));
      return false;
    }

    return true;
  };

  const handleApproveSet = async () => {
    if (
      !pendingSetApproval ||
      !setApprovalSignature ||
      isSavingSetApproval
    ) {
      return;
    }

    if (focusFirstPendingVideoReview(pendingSetApproval)) {
      setPendingSetApproval(null);
      setSetApprovalSignature(null);
      return;
    }

    const signingJudgeName = assignedJudgeName || judgeName.trim();

    if (!signingJudgeName) {
      alert(t("management.scoring.judgeNameRequired"));
      return;
    }

    const isScoringSynced = await ensureScoringSyncedBeforeFinalize();

    if (!isScoringSynced) return;

    setIsSavingSetApproval(true);

    try {
      const signedAt = new Date().toISOString();
      const draftApproval = buildSetApproval({
        setRange: pendingSetApproval,
        judgeId: isMultiJudgeMode ? activeJudge?.id : "",
        judgeName: signingJudgeName,
        judgeSignature: setApprovalSignature,
        signedAt,
      });
      const pdfClassData = {
        ...classData,
        official: {
          ...(classData?.official || {}),
          eventName: show?.name || classData?.official?.eventName || "",
          eventDate: day?.date || classData?.official?.eventDate || "",
        },
      };
      const { pdf, fileName } = buildSetApprovalPdf({
        association,
        classData: pdfClassData,
        approval: draftApproval,
      });
      const approval = buildSetApproval({
        setRange: pendingSetApproval,
        judgeId: isMultiJudgeMode ? activeJudge?.id : "",
        judgeName: signingJudgeName,
        judgeSignature: setApprovalSignature,
        signedAt,
        pdfFileName: fileName,
      });
      const nextApprovals = [...activeSetApprovals, approval];
      const isFinalSet =
        pendingSetApproval.endIndex === runs.length - 1 &&
        areAllRunsApproved(runs, nextApprovals);

      if (isMultiJudgeMode) {
        const session = await saveJudgeScoringSessionRepository({
          classId,
          judge: activeJudge,
          updates: {
            ...activeJudgeSession,
            runs,
            activeManoeuvre: null,
            setApprovals: nextApprovals,
            judgeName: signingJudgeName,
            judgeSignature: isFinalSet ? setApprovalSignature : null,
            finalized: isFinalSet,
            finalizedAt: isFinalSet ? signedAt : null,
            judgeSignedAt: isFinalSet ? signedAt : null,
          },
        });

        setActiveJudgeSession(session);
        setJudgeClaimState((current) => ({
          ...current,
          session,
        }));
      } else {
        const currentSetup = {
          ...getClassSetup(classId),
          ...(classSetup || {}),
          setApprovalMode,
          setApprovals: nextApprovals,
        };
        const savedSetup = await saveSetupForClassRepository(
          classId,
          currentSetup
        );

        setClassData((currentData) =>
          currentData
            ? {
                ...currentData,
                setup: savedSetup,
              }
            : currentData
        );

        if (isFinalSet) {
          await finalizeClassWithJudge({
            classId,
            judgeName: signingJudgeName,
            judgeSignature: setApprovalSignature,
            finalizedAt: signedAt,
          });
        }
      }

      pdf.save(fileName);
      setPendingSetApproval(null);
      setSetApprovalSignature(null);
      setActiveManoeuvre(null);

      if (isFinalSet) {
        if (!isMultiJudgeMode) {
          await advanceArenaLiveClassAfterCompletionRepository({
            showId: classItem?.showId,
            arena: classItem?.arena,
            classId,
          });
          const nextData = await getClassFullDataRepository(classId);
          setClassData(nextData);
        }

        alert(t("management.scoring.finalSetApproved"));
        return;
      }

      if (pendingSetApproval.startDragAfterApproval) {
        activateDragBreak(pendingSetApproval.endIndex);
      }

      alert(
        t("management.scoring.setApprovedAndSent", {
          set: approval.setNumber,
        })
      );
    } catch (error) {
      alert(error.message || t("management.scoring.setApprovalFailed"));
    } finally {
      setIsSavingSetApproval(false);
    }
  };

  const handleRequestClassSignature = () => {
    if (setApprovalMode === SET_APPROVAL_MODES.PER_SET) {
      requestSetApproval(runs.length - 1);
      return;
    }

    setShowFinalizeBox(true);
  };

  const handleFinalizeScoring = async () => {
    if (isCompleted || !canUseActiveJudgeSession) return;

    if (hasPendingVideoReview) {
      alert(t("management.scoring.finalizeVideoReview"));
      return;
    }

    if (!canFinalize) {
      alert(t("management.scoring.finalizeIncomplete"));
      return;
    }

    const isScoringSynced = await ensureScoringSyncedBeforeFinalize();

    if (!isScoringSynced) {
      return;
    }

    const signingJudgeName = assignedJudgeName || judgeName.trim();

    if (!signingJudgeName) {
      alert(t("management.scoring.judgeNameRequired"));
      return;
    }

    if (!judgeSignature) {
      alert(t("management.scoring.judgeSignatureRequired"));
      return;
    }

    if (isMultiJudgeMode) {
      const finalizedAt = new Date().toISOString();

      try {
        const session = await saveJudgeScoringSessionRepository({
          classId,
          judge: activeJudge,
          updates: {
            ...activeJudgeSession,
            runs,
            activeManoeuvre: null,
            judgeName: signingJudgeName,
            judgeSignature,
            finalized: true,
            finalizedAt,
            judgeSignedAt: finalizedAt,
          },
        });

        const pdf = generateScorePdf({
          associationName: association?.name || "Association",
          associationLogoDataUrl: association?.logoDataUrl || null,
          eventName: show?.name || "",
          eventDate: day?.date || "",
          classItem,
          classSetup: {
            ...classSetup,
            judgeName: signingJudgeName,
            judgeSignature,
            finalizedAt,
            judgeSignedAt: finalizedAt,
          },
          runs,
          headers,
        });

        const fileName = buildJudgeScorePdfFileName({
          associationAbbreviation: association?.shortName || "ASSOC",
          showName: show?.name || "show",
          className: classItem?.name || "bloc",
          judgeName: signingJudgeName,
          finalizedAt,
        });

        pdf.save(fileName);
        setActiveJudgeSession(session);
        setJudgeClaimState((current) => ({
          ...current,
          session,
        }));
        setShowFinalizeBox(false);
        setActiveManoeuvre(null);

        alert(t("management.scoring.judgeFinalizedSuccess"));
      } catch (error) {
        alert(error.message || t("management.scoring.finalizeFailed"));
      }

      return;
    }

    try {
      const finalized = await finalizeClassWithJudge({
        classId,
        judgeName: signingJudgeName,
        judgeSignature,
      });

      const pdf = generateScorePdf({
        associationName: association?.name || "Association",
        associationLogoDataUrl: association?.logoDataUrl || null,
        eventName: show?.name || "",
        eventDate: day?.date || "",
        classItem,
        classSetup: finalized.setup,
        runs,
        headers,
      });

      const fileName = buildScorePdfFileName({
        associationAbbreviation: association?.shortName || "ASSOC",
        showName: show?.name || "show",
        className: classItem?.name || "bloc",
        finalizedAt: finalized.finalizedAt,
      });

      pdf.save(fileName);
      await saveFinalPdfFileName(classId, fileName);
      await advanceArenaLiveClassAfterCompletionRepository({
        showId: classItem?.showId,
        arena: classItem?.arena,
        classId,
      });

      const nextData = await getClassFullDataRepository(classId);
      setClassData(nextData);
      setShowFinalizeBox(false);

      alert(t("management.scoring.finalizedSuccess"));
    } catch (error) {
      alert(error.message || t("management.scoring.finalizeFailed"));
    }
  };

  if (!access.isLoadingAccess && !access.canScoreAssociation) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
            {t("public.results.back")}
          </button>
        </div>
        <div style={lockBannerStyle}>
          {t("management.scoring.accessDenied")}
        </div>
      </div>
    );
  }

  if (isNoPatternValue(patternValue)) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
            {t("public.results.back")}
          </button>
        </div>
        <div style={lockBannerStyle}>
          {t("management.scoring.noPatternMessage")}
        </div>
      </div>
    );
  }

  const scoringSyncNotice = !isCompleted
    ? getScoringSyncNotice(scoringSyncStatus, t, scoringSyncError)
    : "";

  return (
    <div style={styles.app}>
      {scoringSyncNotice && (
        <div
          style={scoringSyncToastStyle(scoringSyncStatus)}
          role="status"
          aria-live="polite"
        >
          <div style={scoringSyncToastTitleStyle}>
            {getScoringSyncLabel(scoringSyncStatus, t)}
          </div>
          <div>{scoringSyncNotice}</div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <div style={topHeaderStyle}>
        <div style={styles.topbarWrap}>
          <div style={styles.topbar}>
            {[
              classItem?.name || t("management.classes.unnamedClass"),
              patternValue
                ? `${t("public.results.pattern")} ${patternValue}`
                : "",
              assignedJudgeName
                ? `${t("public.results.judge")} ${assignedJudgeName}`
                : "",
              t("management.scoring.runCount", { count: runCount }),
              activeRunDraw != null
                ? t("management.scoring.activeRun", {
                    draw: activeRunDraw,
                  })
                : "",
            ]
              .filter(Boolean)
              .join(" | ")}
          </div>
        </div>

        <div style={headerButtonsStyle}>
          <div style={statusBadgeStyle(classStatus)}>
            {t("management.scoring.statusPrefix")}: {classStatusLabel}
          </div>

          <div style={scoringSyncBadgeStyle(scoringSyncStatus)}>
            {getScoringSyncLabel(scoringSyncStatus, t)}
          </div>

          {scoringSyncStatus === SCORING_SYNC_STATUS.PENDING && (
            <button
              type="button"
              onClick={handleRetryScoringSync}
              style={secondaryButtonStyle}
            >
              {t("management.scoring.retrySync")}
            </button>
          )}

          <button
            type="button"
            onClick={handleExportLocalScoringBackup}
            style={secondaryButtonStyle}
          >
            {t("management.scoring.exportBackup")}
          </button>

          <button
            type="button"
            onClick={handleExportProvisionalPdf}
            style={secondaryButtonStyle}
          >
            {t("management.scoring.exportProvisionalPdf")}
          </button>

          {canShowProvisionalRanking && (
            <button
              type="button"
              onClick={() => setShowProvisionalRanking(true)}
              style={secondaryButtonStyle}
            >
              {t("management.scoring.provisionalRanking")}
            </button>
          )}

          {!isCompleted && (
            <button
              type="button"
              onClick={handleRequestClassSignature}
              style={primaryButtonStyle}
              disabled={!canSignClass}
            >
              {setApprovalMode === SET_APPROVAL_MODES.PER_SET
                ? t("management.scoring.approveFinalSet")
                : t("management.scoring.signClass")}
            </button>
          )}

          {isCompleted && isSecretariatValidated && access.canManageAssociation && (
            <button
              type="button"
              onClick={handleDownloadOfficialPdf}
              style={primaryButtonStyle}
            >
              {t("management.scoring.downloadOfficialPdf")}
            </button>
          )}
        </div>
      </div>

      {isCompleted && (
        <div style={lockBannerStyle}>
          {t("management.scoring.classCompletedBanner")}
        </div>
      )}

      {!isCompleted && hasPendingVideoReview && (
        <div style={warningBannerStyle}>
          {t("management.scoring.videoReviewBanner")}
        </div>
      )}

      {!isCompleted && hasBlockedScoringDataLoss && (
        <div style={warningBannerStyle}>
          {t("management.scoring.dataLossBlockedBanner", {
            previousCount: scoringDataLossWarning.previousCount,
            nextCount: scoringDataLossWarning.nextCount,
          })}
        </div>
      )}

      {!isCompleted &&
        !hasPendingVideoReview &&
        !hasBlockedScoringDataLoss &&
        !canFinalize &&
        (!isMultiJudgeMode || judgeClaimState.status === "claimed") && (
          <div style={warningBannerStyle}>
            {t("management.scoring.incompleteBanner")}
          </div>
        )}

      {isMultiJudgeMode && (
        <section style={judgeSessionCardStyle}>
          <div>
            <div style={judgeSessionLabelStyle}>
              {t("management.scoring.scoringForJudge")}
            </div>
            <h2 style={judgeSessionTitleStyle}>
              {activeJudgeName || t("management.scoring.noJudgeSelected")}
            </h2>
            {!activeJudgeId && (
              <div style={helperTextStyle}>
                {t("management.scoring.selectJudgeBeforeClaim")}
              </div>
            )}
            {judgeClaimState.status === "claimed" && (
              <div style={helperTextStyle}>
                {t("management.scoring.judgeClaimedBy", {
                  email:
                    judgeClaimState.session?.claimedByEmail ||
                    auth.user?.email ||
                    "—",
                })}
              </div>
            )}
            {judgeClaimState.status === "loading" && (
              <div style={helperTextStyle}>
                {t("management.scoring.judgeClaimLoading")}
              </div>
            )}
            {judgeClaimState.status === "missing-user" && (
              <div style={warningTextStyle}>
                {t("management.scoring.judgeClaimMissingUser")}
              </div>
            )}
            {judgeClaimState.status === "sync-error" && (
              <div style={warningTextStyle}>
                {t("management.scoring.judgeClaimSyncError")}
              </div>
            )}
            {judgeClaimState.status === "claimed" &&
              judgeClaimState.isLocalFallback && (
                <div style={warningTextStyle}>
                  {t("management.scoring.judgeClaimLocalFallback")}
                </div>
              )}
            {judgeClaimState.status === "claimed-by-other" && (
              <div style={warningTextStyle}>
                {t("management.scoring.judgeClaimedConflict", {
                  email: judgeClaimState.session?.claimedByEmail || "—",
                })}
              </div>
            )}
          </div>

          <div style={judgeSessionActionsStyle}>
            <button
              type="button"
              onClick={() => setIsJudgePickerOpen((current) => !current)}
              style={secondaryButtonStyle}
            >
              {activeJudgeId
                ? t("management.scoring.changeJudge")
                : t("management.scoring.selectJudge")}
            </button>
          </div>

          {isJudgePickerOpen && (
            <div style={judgePickerStyle}>
              <div style={helperTextStyle}>
                {t("management.scoring.chooseJudge")}
              </div>
              <div style={judgePickerGridStyle}>
                {classJudges.map((judge, index) => (
                  <button
                    key={judge.id}
                    type="button"
                    onClick={() => requestJudgeChange(judge.id)}
                    style={
                      judge.id === activeJudgeId
                        ? selectedJudgeButtonStyle
                        : secondaryButtonStyle
                    }
                  >
                    {getJudgeDisplayName(judge, index)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {isTestAssociation && !isCompleted && (
        <section style={judgeSessionCardStyle}>
          <div>
            <div style={judgeSessionLabelStyle}>
              {t("management.scoring.testMode")}
            </div>
            <h2 style={judgeSessionTitleStyle}>
              {t("management.scoring.testDataTitle")}
            </h2>
            <div style={helperTextStyle}>
              {t("management.scoring.testDataHelp")}
            </div>
          </div>
          <div style={judgeSessionActionsStyle}>
            <button
              type="button"
              onClick={() => fillScoringTestData(true)}
              style={secondaryButtonStyle}
              disabled={!canEditScores}
            >
              {t("management.scoring.fillNextTestRun")}
            </button>
            <button
              type="button"
              onClick={() => fillScoringTestData(false)}
              style={primaryButtonStyle}
              disabled={!canEditScores}
            >
              {t("management.scoring.fillNextTestSet")}
            </button>
          </div>
        </section>
      )}

      {pendingSetApproval && !isCompleted && (
        <SetApprovalModal
          setRange={pendingSetApproval}
          headers={headers}
          specialPenaltyTokens={specialPenaltyTokens}
          assignedJudgeName={assignedJudgeName}
          judgeName={judgeName}
          onJudgeNameChange={setJudgeName}
          signature={setApprovalSignature}
          onSignatureChange={setSetApprovalSignature}
          onApprove={handleApproveSet}
          onCancel={() => {
            setPendingSetApproval(null);
            setSetApprovalSignature(null);
          }}
          isSaving={isSavingSetApproval}
        />
      )}

      {showFinalizeBox && !isCompleted && (
        <section style={finalizeCardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>
              {t("management.scoring.judgeSignatureTitle")}
              {assignedJudgeName ? ` ${assignedJudgeName}` : ""}
            </h2>
          </div>

          {assignedJudgeName ? (
            <div style={judgeNoticeStyle}>
              {t("management.scoring.judgeAssignedNotice", {
                judgeName: assignedJudgeName,
              })}
            </div>
          ) : (
            <div style={fieldGridStyle}>
              <div>
                <label style={labelStyle}>
                  {t("management.scoring.judgeNameLabel")}
                </label>
                <input
                  type="text"
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  placeholder={t("management.scoring.judgeNameLabel")}
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>
              {t("management.scoring.judgeSignatureTitle")}
            </label>
            <SignaturePad
              value={judgeSignature}
              onChange={setJudgeSignature}
              width={560}
              height={180}
            />
          </div>

          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={handleFinalizeScoring}
              style={primaryButtonStyle}
              disabled={hasBlockingScoringSync}
            >
              {t("management.scoring.confirmFinalize")}
            </button>

            <button
              type="button"
              onClick={() => setShowFinalizeBox(false)}
              style={secondaryButtonStyle}
            >
              {t("management.access.cancel")}
            </button>
          </div>
        </section>
      )}

      {showProvisionalRanking && (
        <ProvisionalRankingModal
          ranking={provisionalRanking}
          onClose={() => setShowProvisionalRanking(false)}
        />
      )}

      <section style={timingCardStyle}>
        <div style={timingHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t("nav.dayTiming")}</h2>
        </div>

        <div style={timingGridStyle}>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>
              {t("management.scoring.timingStart")}
            </span>
            <strong>{formatClockTime(classSetup?.startedAt)}</strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>
              {t("management.scoring.timingCompleted")}
            </span>
            <strong>
              {timingSummary.completedRuns}/{runCount}
            </strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>
              {t("management.time.averagePerRun")}
            </span>
            <strong>{formatDuration(timingSummary.averageRunSeconds)}</strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>
              {t("management.time.remainingDrags")}
            </span>
            <strong>{timingSummary.remainingDragBreaks}</strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>
              {t("management.time.remainingTime")}
            </span>
            <strong>{formatDuration(timingSummary.remainingSeconds)}</strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>
              {t("management.time.estimatedEndHeader")}
            </span>
            <strong>{formatClockTime(timingSummary.estimatedEndAt)}</strong>
          </div>
        </div>

        {timingSummary.averageRunSeconds == null && (
          <div style={timingHintStyle}>
            {t("management.scoring.timingHint")}
          </div>
        )}
      </section>

      <ScoreTable
        headers={headers}
        runs={runs}
        dragInterval={timingSummary.dragInterval}
        dragDurationMinutes={timingSummary.dragDurationMinutes}
        activeManoeuvre={activeManoeuvre}
        setActiveManoeuvre={setActiveManoeuvreWithRun}
        activeDrag={activeDrag}
        scoreOptions={scoreOptions}
        scoreOptionsByIndex={scoreOptionsByIndex}
        penaltyOptions={penaltyOptions}
        specialPenaltyTokens={specialPenaltyTokens}
        penaltyDisabledIndexes={penaltyDisabledIndexes}
        statusPenaltyOptions={statusPenaltyOptions}
        updateScoreCell={updateScoreCell}
        clearScoreCell={clearScoreCell}
        addPenaltyToken={addPenaltyToken}
        toggleSpecialPenalty={toggleSpecialPenalty}
        clearPenaltyCell={clearPenaltyCell}
        updateBackNumber={updateBackNumber}
        updateRunNote={updateRunNote}
        onStartDrag={startDragBreak}
        onStopDrag={stopDragBreak}
        canStartDragAfterRun={canStartDragAfterRun}
        isLocked={!canEditScores}
        isRunLocked={isRunLockedByApproval}
        isBackNumberLocked={!canEditBackNumbers}
        styles={styles}
      />
    </div>
  );
}

function ProvisionalRankingModal({ ranking, onClose }) {
  const { t } = useTranslation();

  return (
    <div style={modalBackdropStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {t("management.scoring.provisionalRanking")}
            </h2>
            <div style={helperTextStyle}>
              {t("management.scoring.provisionalRankingNote")}
            </div>
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            {t("management.announcer.close")}
          </button>
        </div>

        <div style={rankingListStyle}>
          {ranking.map((run) => (
            <div key={run.id || run.draw} style={rankingRowStyle}>
              <div style={rankingRankStyle}>#{run.rank}</div>
              <div>
                <div style={rankingNameStyle}>
                  {t("management.announcer.draw")} {run.draw || "—"} ·{" "}
                  {t("public.results.backNumber")} {run.backNumber || "—"}
                </div>
                <div style={helperTextStyle}>
                  {run.rider || t("public.results.riderFallback")} ·{" "}
                  {run.horse || t("public.results.horseFallback")}
                </div>
              </div>
              <div style={rankingScoreStyle}>{run.scoreTotal || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SetApprovalModal({
  setRange,
  headers,
  specialPenaltyTokens,
  assignedJudgeName,
  judgeName,
  onJudgeNameChange,
  signature,
  onSignatureChange,
  onApprove,
  onCancel,
  isSaving,
}) {
  const { t } = useTranslation();

  return (
    <div style={modalBackdropStyle} role="dialog" aria-modal="true">
      <div style={setApprovalModalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {t("management.scoring.setApprovalTitle", {
                set: setRange.setNumber,
              })}
              {assignedJudgeName ? ` · ${assignedJudgeName}` : ""}
            </h2>
            <div style={helperTextStyle}>
              {t("management.scoring.setApprovalSummary", {
                start: setRange.startDraw,
                end: setRange.endDraw,
                count: setRange.runs.length,
              })}
            </div>
          </div>
          <div style={statusBadgeStyle("in_progress")}>
            {t("management.scoring.setApprovalPending")}
          </div>
        </div>

        <div style={setReviewHeadingStyle}>
          <strong>{t("management.scoring.setApprovalReviewTitle")}</strong>
          <span style={helperTextStyle}>
            {t("management.scoring.setApprovalReviewHelp")}
          </span>
        </div>

        <div style={setReviewTableWrapStyle}>
          <table style={setReviewTableStyle}>
            <thead>
              <tr>
                <th style={setReviewHeaderStyle}>
                  {t("management.announcer.draw")}
                </th>
                <th style={setReviewHeaderStyle}>
                  {t("public.results.backNumber")}
                </th>
                {headers.map((header) => (
                  <th key={header} style={setReviewManeuverHeaderStyle}>
                    {header}
                    <span style={setReviewManeuverLegendStyle}>
                      {t("management.scoring.setApprovalPenaltyShort")} /{" "}
                      {t("management.scoring.setApprovalManeuverShort")}
                    </span>
                  </th>
                ))}
                <th style={setReviewHeaderStyle}>
                  {t("management.scoring.setApprovalTotalPenalties")}
                </th>
                <th style={setReviewHeaderStyle}>
                  {t("management.scoring.setApprovalTotal")}
                </th>
                <th style={setReviewHeaderStyle}>
                  {t("management.scoring.setApprovalNote")}
                </th>
              </tr>
            </thead>
            <tbody>
              {setRange.runs.map((run) => (
                <tr key={run.id || run.draw}>
                  <td style={setReviewCellStyle}>{run.draw || "—"}</td>
                  <td style={setReviewCellStyle}>{run.backNumber || "—"}</td>
                  {headers.map((header, maneuverIndex) => {
                    const score = formatScoreValue(
                      run.scores?.[maneuverIndex]
                    );
                    const penalty = formatPenaltyValue(
                      run.penalties?.[maneuverIndex],
                      specialPenaltyTokens
                    );

                    return (
                      <td
                        key={`${run.id || run.draw}-${header}-${maneuverIndex}`}
                        style={setReviewManeuverCellStyle}
                      >
                        <div style={setReviewManeuverBoxStyle}>
                          <div style={setReviewPenaltyBoxStyle}>
                            {penalty || "\u00a0"}
                          </div>
                          <div style={setReviewManeuverScoreBoxStyle}>
                            {score || "—"}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td style={setReviewCellStyle}>{run.penTotal || "—"}</td>
                  <td style={setReviewScoreCellStyle}>
                    {formatTotalValue(run.scoreTotal) || "—"}
                  </td>
                  <td style={setReviewNoteCellStyle}>{run.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={judgeNoticeStyle}>
          {t("management.scoring.setApprovalHelp")}
        </div>

        {!assignedJudgeName && (
          <div style={fieldGridStyle}>
            <div>
              <label style={labelStyle}>
                {t("management.scoring.judgeNameLabel")}
              </label>
              <input
                type="text"
                value={judgeName}
                onChange={(event) => onJudgeNameChange(event.target.value)}
                placeholder={t("management.scoring.judgeNameLabel")}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label style={labelStyle}>
            {t("management.scoring.judgeSignatureTitle")}
          </label>
          <SignaturePad
            value={signature}
            onChange={onSignatureChange}
            width={720}
            height={180}
          />
        </div>

        <div style={setApprovalModalActionsStyle}>
          <button
            type="button"
            onClick={onApprove}
            style={primaryButtonStyle}
            disabled={!signature || isSaving}
          >
            {isSaving
              ? t("management.scoring.approvingSet")
              : t("management.scoring.approveSet")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={secondaryButtonStyle}
            disabled={isSaving}
          >
            {t("management.access.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const topHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const headerButtonsStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

function getClassStatusLabel(status, t) {
  switch (status) {
    case "draft":
      return t("management.classes.statusDraft");
    case "ready":
      return t("management.classes.statusReady");
    case "in_progress":
      return t("management.classes.statusInProgress");
    case "completed":
      return t("management.classes.statusCompleted");
    default:
      return "—";
  }
}

function getScoringSyncLabel(status, t) {
  if (status === SCORING_SYNC_STATUS.SYNCING) {
    return t("management.scoring.syncSyncing");
  }
  if (status === SCORING_SYNC_STATUS.SYNCED) {
    return t("management.scoring.syncSynced");
  }
  if (status === SCORING_SYNC_STATUS.PENDING) {
    return t("management.scoring.syncPending");
  }
  return t("management.scoring.syncLocal");
}

function getScoringSyncNotice(status, t, errorMessage = "") {
  if (status === SCORING_SYNC_STATUS.LOCAL) {
    return t("management.scoring.syncNoticeLocal");
  }

  if (status === SCORING_SYNC_STATUS.PENDING) {
    const message = String(errorMessage || "").trim();

    if (message) {
      return t("management.scoring.syncNoticePendingWithError", {
        message,
      });
    }

    return t("management.scoring.syncNoticePending");
  }

  return "";
}

function scoringSyncBadgeStyle(status) {
  if (status === SCORING_SYNC_STATUS.SYNCING) {
    return {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#eff6ff",
      border: "1px solid #93c5fd",
      color: "#1d4ed8",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }

  if (status === SCORING_SYNC_STATUS.SYNCED) {
    return {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#ecfdf5",
      border: "1px solid #86efac",
      color: "#166534",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }

  if (status === SCORING_SYNC_STATUS.PENDING) {
    return {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#fff7ed",
      border: "1px solid #fdba74",
      color: "#9a3412",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }

  return {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

function scoringSyncToastStyle(status) {
  const baseStyle = {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: 3000,
    width: "min(560px, calc(100vw - 32px))",
    padding: "12px 14px",
    borderRadius: "8px",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
    fontSize: "15px",
    lineHeight: 1.35,
    pointerEvents: "none",
  };

  if (status === SCORING_SYNC_STATUS.PENDING) {
    return {
      ...baseStyle,
      background: "#fff7ed",
      border: "1px solid #fdba74",
      color: "#9a3412",
    };
  }

  if (status === SCORING_SYNC_STATUS.SYNCING) {
    return {
      ...baseStyle,
      background: "#eff6ff",
      border: "1px solid #93c5fd",
      color: "#1d4ed8",
    };
  }

  return {
    ...baseStyle,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
  };
}

const scoringSyncToastTitleStyle = {
  marginBottom: "4px",
  color: "inherit",
  fontSize: "13px",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const lockBannerStyle = {
  marginBottom: "16px",
  padding: "12px 14px",
  borderRadius: "8px",
  background: "#fff7ed",
  border: "1px solid #fdba74",
  color: "#9a3412",
};

const warningBannerStyle = {
  marginBottom: "16px",
  padding: "12px 14px",
  borderRadius: "8px",
  background: "#eff6ff",
  border: "1px solid #93c5fd",
  color: "#1d4ed8",
};

const judgeSessionCardStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "14px",
  background: "#f8fafc",
  marginBottom: "16px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "start",
};

const judgeSessionLabelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const judgeSessionTitleStyle = {
  margin: "2px 0",
  fontSize: "22px",
};

const judgeSessionActionsStyle = {
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const judgePickerStyle = {
  gridColumn: "1 / -1",
  display: "grid",
  gap: "8px",
};

const judgePickerGridStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const selectedJudgeButtonStyle = {
  ...primaryButtonStyle,
  cursor: "default",
};

const warningTextStyle = {
  fontSize: "13px",
  lineHeight: 1.4,
  color: "#9a3412",
  fontWeight: 700,
};

const finalizeCardStyle = {
  border: "1px solid #ddd",
  borderRadius: "10px",
  padding: "16px",
  background: "#fff",
  marginBottom: "20px",
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 1000,
};

const modalStyle = {
  width: "min(720px, 100%)",
  maxHeight: "85vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: "10px",
  padding: "18px",
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
};

const setApprovalModalStyle = {
  ...modalStyle,
  width: "min(1180px, 100%)",
  maxHeight: "92vh",
};

const setReviewHeadingStyle = {
  display: "grid",
  gap: 3,
  marginBottom: 10,
};

const setReviewTableWrapStyle = {
  overflowX: "auto",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  marginBottom: 14,
};

const setReviewTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const setReviewHeaderStyle = {
  padding: "6px 7px",
  borderBottom: "1px solid #cbd5e1",
  background: "#f1f5f9",
  textAlign: "center",
  whiteSpace: "nowrap",
};

const setReviewManeuverHeaderStyle = {
  ...setReviewHeaderStyle,
  minWidth: 66,
};

const setReviewManeuverLegendStyle = {
  display: "block",
  marginTop: 2,
  color: "#64748b",
  fontSize: 9,
  fontWeight: 700,
};

const setReviewCellStyle = {
  padding: "5px 7px",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  textAlign: "center",
  verticalAlign: "top",
};

const setReviewManeuverCellStyle = {
  ...setReviewCellStyle,
  minWidth: 66,
  padding: 3,
};

const setReviewManeuverBoxStyle = {
  display: "grid",
  border: "1px solid #94a3b8",
  borderRadius: 3,
  overflow: "hidden",
  background: "#fff",
};

const setReviewPenaltyBoxStyle = {
  minHeight: 20,
  padding: "2px 4px",
  borderBottom: "1px solid #94a3b8",
  background: "#fff7ed",
  color: "#b45309",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.25,
};

const setReviewManeuverScoreBoxStyle = {
  minHeight: 22,
  padding: "3px 4px",
  color: "#111827",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.2,
};

const setReviewScoreCellStyle = {
  ...setReviewCellStyle,
  fontSize: 16,
  fontWeight: 900,
};

const setReviewNoteCellStyle = {
  ...setReviewCellStyle,
  minWidth: 150,
  whiteSpace: "normal",
  textAlign: "left",
  color: "#475569",
};

const setApprovalModalActionsStyle = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
  flexWrap: "wrap",
  marginTop: 16,
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "14px",
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.4,
};

const rankingListStyle = {
  display: "grid",
  gap: "8px",
};

const rankingRowStyle = {
  display: "grid",
  gridTemplateColumns: "64px 1fr auto",
  gap: "12px",
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "10px",
  background: "#f8fafc",
};

const rankingRankStyle = {
  fontWeight: 900,
  fontSize: "18px",
  color: "#0f172a",
};

const rankingNameStyle = {
  fontWeight: 800,
  color: "#0f172a",
};

const rankingScoreStyle = {
  fontWeight: 900,
  fontSize: "20px",
  color: "#111827",
};

const timingCardStyle = {
  border: "1px solid #ddd",
  borderRadius: "10px",
  padding: "16px",
  background: "#fff",
  marginBottom: "20px",
};

const timingHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "14px",
  flexWrap: "wrap",
};

const timingGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "10px",
};

const timingMetricStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "10px 12px",
  background: "#f8fafc",
  display: "grid",
  gap: "4px",
};

const timingLabelStyle = {
  color: "#64748b",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const timingHintStyle = {
  marginTop: "10px",
  color: "#64748b",
  fontSize: "14px",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "20px",
};

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const judgeNoticeStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  padding: "10px 12px",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 600,
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const buttonRowStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "16px",
};

function statusBadgeStyle(status) {
  if (status === "completed") {
    return {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#ecfdf5",
      border: "1px solid #86efac",
      color: "#166534",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }

  if (status === "in_progress") {
    return {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#eff6ff",
      border: "1px solid #93c5fd",
      color: "#1d4ed8",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }

  if (status === "ready") {
    return {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "#f0fdf4",
      border: "1px solid #86efac",
      color: "#166534",
      fontWeight: 600,
      whiteSpace: "nowrap",
    };
  }

  return {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

export default ClassScoringPage;
