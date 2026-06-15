import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getClassFullData,
  getClassFullDataRepository,
  saveClassItemRepository,
  saveSetupForClassRepository,
} from "../../features/classes/classRepository";
import {
  createEmptyRun,
  resequenceRuns,
} from "../../features/classes/classSetupStorage";
import {
  CLASS_START_MODE_AFTER_PREVIOUS,
  CLASS_START_MODE_FIXED,
  normalizeClassScheduleDetails,
  normalizeClassScheduleStart,
} from "../../features/classes/classSchedule";
import {
  MAX_CLASS_JUDGES,
  createClassJudge,
  getJudgeDisplayName,
  getPrimaryJudgeName,
  normalizeClassJudges,
} from "../../features/classes/classJudges";
import {
  parseImportedDraw,
  parseImportedDrawFile,
} from "../../features/classes/classSetupImport";
import { getClassRecord } from "../../features/classes/classRecordStorage";
import { getAllClasses } from "../../features/classes/classSelectors";
import { buildArenaOptions } from "../../features/classes/arenaOptions";
import {
  getClassStatus,
} from "../../features/classes/classStatusSelectors";
import { resolveClassScoringId } from "../../features/classes/classScoringGroups";
import { hasScoringStarted } from "../../features/scoring/scoringSelectors";
import { appStyles as styles } from "../../styles/appStyles";
import {
  createDefaultCustomPattern,
  getCustomPatternConfigForPattern,
  getPatternHeaders,
  getPatternSelectValue,
  isCustomPatternReady,
  isNoPatternValue,
  PATTERN_OPTION_GROUPS,
  normalizeCustomPattern,
} from "../../features/patterns/patternDefinitions";
import { loadScoringRunsRepository } from "../../features/scoring/scoringRepository";
import {
  DEFAULT_DRAG_DURATION_MINUTES,
  DRAG_INTERVAL_OPTIONS,
} from "../../features/classes/classTiming";
import {
  getPlannedLiveStatus,
  isLivePublicationStatus,
  PUBLICATION_STATUSES,
} from "../../features/publication/publicationRepository";
import {
  savePublicationStateRepository,
} from "../../features/publication/publicationCloudRepository";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import { loadAssociations } from "../../features/associations/associationsData";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { getDayById } from "../../features/days/daySelectors";
import { getShowById } from "../../features/shows/showSelectors";
import { createId } from "../../utils/createId";

function isOfficiallyFinalized(record) {
  return Boolean(
    record?.official?.finalized || record?.official?.judgeSignedAt
  );
}

const PUBLIC_LIVE_STATUS_OPTIONS = [
  {
    value: PUBLICATION_STATUSES.HIDDEN,
    labelKey: "public.status.hidden",
    descriptionKey: "management.classSetup.publicHiddenDescription",
  },
  {
    value: PUBLICATION_STATUSES.LIVE_NO_SCORE,
    labelKey: "public.status.liveNoScore",
    descriptionKey: "management.classSetup.publicLiveNoScoreDescription",
  },
  {
    value: PUBLICATION_STATUSES.LIVE_SCORING,
    labelKey: "public.status.liveScoring",
    descriptionKey: "management.classSetup.publicLiveScoringDescription",
  },
  {
    value: PUBLICATION_STATUSES.LIVE,
    labelKey: "public.status.live",
    descriptionKey: "management.classSetup.publicLiveDescription",
  },
];

function getPublicationStatusDescription(status, t) {
  const option = PUBLIC_LIVE_STATUS_OPTIONS.find((item) => item.value === status);

  if (option) {
    return t(option.descriptionKey);
  }

  if (isLivePublicationStatus(status)) {
    return t("management.classSetup.publicLiveFallbackDescription");
  }

  return t("management.classSetup.publicChooseDescription");
}

function normalizeSetupPublicationStatus(status) {
  return status === PUBLICATION_STATUSES.LIVE_FINISHED
    ? PUBLICATION_STATUSES.LIVE_SCORING
    : status || PUBLICATION_STATUSES.HIDDEN;
}

function normalizePublicationStatusForJudges(status, judges) {
  const normalizedStatus = normalizeSetupPublicationStatus(status);
  const judgeCount = Array.isArray(judges) ? judges.length : 1;

  if (judgeCount > 1 && normalizedStatus === PUBLICATION_STATUSES.LIVE) {
    return PUBLICATION_STATUSES.LIVE_SCORING;
  }

  return normalizedStatus;
}

function normalizePlannedLiveStatusForSetup(publication, judges) {
  return normalizePublicationStatusForJudges(
    getPlannedLiveStatus(publication),
    judges
  );
}

function getPublicLiveStatusOptions(judges, isScheduleOnly = false) {
  if (isScheduleOnly) {
    return PUBLIC_LIVE_STATUS_OPTIONS.filter((option) =>
      [
        PUBLICATION_STATUSES.HIDDEN,
        PUBLICATION_STATUSES.LIVE_NO_SCORE,
      ].includes(option.value)
    );
  }

  const judgeCount = Array.isArray(judges) ? judges.length : 1;

  if (judgeCount <= 1) {
    return PUBLIC_LIVE_STATUS_OPTIONS;
  }

  return PUBLIC_LIVE_STATUS_OPTIONS.filter(
    (option) => option.value !== PUBLICATION_STATUSES.LIVE
  );
}

function getRunDrawNumber(run, index = 0) {
  const parsed = Number(run?.draw ?? run?.order ?? index + 1);
  return Number.isFinite(parsed) ? parsed : index + 1;
}

function getNextLateEntryDraw(runs) {
  const negativeDraws = (Array.isArray(runs) ? runs : [])
    .map(getRunDrawNumber)
    .filter((value) => value < 0);

  if (!negativeDraws.length) return -1;

  return Math.min(...negativeDraws) - 1;
}

function sortRunsByDraw(runs) {
  return resequenceRuns(
    [...runs].sort((a, b) => getRunDrawNumber(a) - getRunDrawNumber(b))
  );
}

function normalizeImportedClassCode(value) {
  return String(value || "").trim().toUpperCase();
}

function getRunClassCodes(run) {
  return Array.from(
    new Set(
      Array.isArray(run?.classCodes)
        ? run.classCodes.map(normalizeImportedClassCode).filter(Boolean)
        : []
    )
  );
}

function buildImportedBlockClassSummary(blockClasses, runs) {
  const classesByCode = new Map();
  const normalizedRuns = Array.isArray(runs) ? runs : [];
  const entryCountsByCode = new Map();

  (Array.isArray(blockClasses) ? blockClasses : []).forEach((classEntry) => {
    const code = normalizeImportedClassCode(classEntry?.code);
    if (!code) return;

    classesByCode.set(code, {
      code,
      name: String(classEntry?.name || "").trim(),
      classNumber: String(classEntry?.classNumber || "").trim(),
      association: String(classEntry?.association || "").trim(),
      entryCount: 0,
    });
  });

  normalizedRuns.forEach((run) => {
    const classCodes = getRunClassCodes(run);

    classCodes.forEach((code) => {
      entryCountsByCode.set(code, (entryCountsByCode.get(code) || 0) + 1);

      if (!classesByCode.has(code)) {
        classesByCode.set(code, {
          code,
          name: "",
          classNumber: "",
          association: "",
          entryCount: 0,
        });
      }
    });
  });

  const classSummaries = Array.from(classesByCode.values());

  if (
    classSummaries.length === 1 &&
    normalizedRuns.length > 0 &&
    entryCountsByCode.size === 0
  ) {
    classSummaries[0].entryCount = normalizedRuns.length;
    return classSummaries;
  }

  return classSummaries.map((classEntry) => ({
    ...classEntry,
    entryCount: entryCountsByCode.get(classEntry.code) || 0,
  }));
}

function isImportedRunScratched(run) {
  const status = String(run?.status || "").toLowerCase();
  const score = String(run?.scoreTotal ?? run?.score ?? "").toLowerCase();
  const owner = String(run?.owner || "").toLowerCase();

  return (
    run?.scratched === true ||
    status === "scr" ||
    status.includes("scratch") ||
    score === "scr" ||
    score.includes("scratch") ||
    owner.includes("scratch")
  );
}

function getImportSourceLabel(file) {
  if (!file) return "manual";

  const fileName = String(file.name || "");
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    return "PDF";
  }

  if (lowerName.endsWith(".csv") || file.type === "text/csv") {
    return "CSV";
  }

  return "TXT";
}

function buildImportSummary(importedDraw, runs, source = {}) {
  const normalizedRuns = Array.isArray(runs) ? runs : [];
  const blockClassSummary = buildImportedBlockClassSummary(
    importedDraw?.blockClasses,
    normalizedRuns
  );

  return {
    sourceLabel: source.label || source.type || "",
    participantCount: normalizedRuns.length,
    classCount: blockClassSummary.length,
    scratchedCount: normalizedRuns.filter(isImportedRunScratched).length,
    blockClasses: blockClassSummary,
  };
}

function formatImportedBlockClassDetails(classEntry) {
  return [
    classEntry?.classNumber,
    classEntry?.association,
    classEntry?.name,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ");
}

function normalizeEditableJudges(input = {}) {
  return normalizeClassJudges(input, { trimNames: false });
}

function ClassSetupPage() {
  const { associationId, classId: routeClassId } = useParams();
  const classId = resolveClassScoringId(routeClassId);
  const navigate = useNavigate();
  const access = useAssociationAccess(associationId);
  const { t } = useTranslation();

  const [classData, setClassData] = useState(() => getClassFullData(classId));
  const setupRef = useRef(classData.setup || {});
  const [hasLoadedSetup, setHasLoadedSetup] = useState(false);

  const classItem = classData?.classItem;
  const classSetup = classData?.setup;
  const classRecord = classData?.record;

  const day = getDayById(classItem?.dayId);
  const show = getShowById(classItem?.showId);

  const association = useMemo(() => {
    const allAssociations = loadAssociations();
    return allAssociations.find((item) => item.id === associationId) || null;
  }, [associationId]);

  const [pattern, setPattern] = useState(
    classSetup?.pattern || classItem?.pattern || ""
  );
  const [customPattern, setCustomPattern] = useState(() =>
    normalizeCustomPattern(
      classSetup?.customPattern || classItem?.customPattern || null,
      classSetup?.pattern || classItem?.pattern || ""
    )
  );
  const [arena, setArena] = useState(classItem?.arena || "");
  const [judges, setJudges] = useState(() =>
    normalizeClassJudges({
      judges: classSetup?.judges,
      judgeName: classSetup?.judgeName || classItem?.judgeName,
    })
  );
  const [runs, setRuns] = useState(classSetup?.runs || []);
  const [blockClasses, setBlockClasses] = useState(
    classSetup?.blockClasses || []
  );
  const [scheduleDetails, setScheduleDetails] = useState(() =>
    normalizeClassScheduleDetails({
      ...classItem,
      ...classSetup?.scheduleDetails,
    })
  );
  const [isDrawImported, setIsDrawImported] = useState(
    Boolean(classSetup?.isDrawImported)
  );
  const [dragInterval, setDragInterval] = useState(
    String(classSetup?.dragInterval || "")
  );
  const [dragDurationMinutes, setDragDurationMinutes] = useState(
    String(classSetup?.dragDurationMinutes || DEFAULT_DRAG_DURATION_MINUTES)
  );
  const [plannedLiveStatus, setPlannedLiveStatus] = useState(
    normalizePlannedLiveStatusForSetup(classData?.publication, classSetup?.judges)
  );
  const [isFinalized, setIsFinalized] = useState(
    isOfficiallyFinalized(classRecord)
  );
  const [runCountInput, setRunCountInput] = useState(
    String((classSetup?.runs || []).length)
  );
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [importSummary, setImportSummary] = useState(null);
  const [showImportBox, setShowImportBox] = useState(false);
  const arenaOptions = useMemo(
    () =>
      buildArenaOptions(
        getAllClasses().filter((item) => item.showId === classItem?.showId),
        arena
      ),
    [arena, classItem?.showId]
  );

  const scoringStarted = hasScoringStarted(classId);
  const isStructureLocked = scoringStarted;
  const isFullyLocked = isStructureLocked || isFinalized;
  const isOrderLocked = isFullyLocked || isDrawImported;
  const isPublicationLocked = [
    PUBLICATION_STATUSES.OFFICIAL,
    PUBLICATION_STATUSES.PUBLISHED,
  ].includes(classData?.publication?.status);
  const hasRunClassCodes = runs.some(
    (run) => Array.isArray(run.classCodes) && run.classCodes.length > 0
  );
  const blockClassesWithCounts = useMemo(
    () => buildImportedBlockClassSummary(blockClasses, runs),
    [blockClasses, runs]
  );
  const canManageSetup = access.canManageAssociation;
  const canEditRunIdentity =
    !isFinalized &&
    (canManageSetup ||
      (scoringStarted && !isDrawImported && access.canEditManualDraw));

  const classStatus = isFinalized ? "completed" : getClassStatus(classItem);
  const classStatusLabel = getClassStatusLabel(classStatus, t);
  const customPatternConfig = getCustomPatternConfigForPattern(pattern);
  const normalizedCustomPattern = customPatternConfig
    ? normalizeCustomPattern(customPattern, pattern)
    : null;
  const isSelectedCustomPattern = Boolean(customPatternConfig);
  const isScheduleOnly = isNoPatternValue(pattern);
  const isCustomPatternComplete = isCustomPatternReady(
    pattern,
    normalizedCustomPattern
  );

  function showLockedMessage(actionLabel) {
    alert(
      t("management.classSetup.lockedActionMessage", { action: actionLabel })
    );
  }

  function showFinalizedMessage() {
    alert(t("management.classSetup.finalizedMessage"));
  }

  function showDrawLockedMessage() {
    alert(t("management.classSetup.drawLockedMessage"));
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSetup() {
      setHasLoadedSetup(false);

      const localData = getClassFullData(classId);
      const nextData = await getClassFullDataRepository(classId);
      const resolvedData = nextData?.classItem ? nextData : localData;
      const nextClassItem = resolvedData.classItem;
      const nextSetup = resolvedData.setup || {};
      const nextRecord = resolvedData.record || getClassRecord(classId);
      const nextPattern = nextSetup.pattern || nextClassItem?.pattern || "";
      const nextCustomPattern = normalizeCustomPattern(
        nextSetup.customPattern || nextClassItem?.customPattern || null,
        nextPattern
      );
      const nextRuns = nextSetup.runs || [];
      const nextBlockClasses = nextSetup.blockClasses || [];
      const nextJudges = normalizeClassJudges({
        judges: nextSetup.judges,
        judgeName: nextSetup.judgeName || nextClassItem?.judgeName,
      });

      if (!isMounted) return;

      setupRef.current = nextSetup;
      setClassData(resolvedData);
      setPattern(nextPattern);
      setCustomPattern(nextCustomPattern);
      setArena(nextClassItem?.arena || "");
      setJudges(nextJudges);
      setRuns(nextRuns);
      setBlockClasses(nextBlockClasses);
      const nextScheduleStart = normalizeClassScheduleStart({
        ...nextClassItem,
        ...nextSetup.scheduleDetails,
      });
      setScheduleDetails(
        normalizeClassScheduleDetails({
          ...nextSetup.scheduleDetails,
          startMode: nextScheduleStart.startMode,
          startTime: nextScheduleStart.startTime,
        })
      );
      setIsDrawImported(Boolean(nextSetup.isDrawImported));
      setDragInterval(String(nextSetup.dragInterval || ""));
      setDragDurationMinutes(
        String(nextSetup.dragDurationMinutes || DEFAULT_DRAG_DURATION_MINUTES)
      );
      setPlannedLiveStatus(
        normalizePlannedLiveStatusForSetup(resolvedData.publication, nextJudges)
      );
      setIsFinalized(isOfficiallyFinalized(nextRecord));
      setRunCountInput(String(nextRuns.length));
      setShowImportBox(false);
      setImportText("");
      setImportMessage("");
      setImportSummary(null);
      setHasLoadedSetup(true);
    }

    loadSetup();

    return () => {
      isMounted = false;
    };
  }, [classId]);

  useEffect(() => {
    if (!hasLoadedSetup) return undefined;

    let isCancelled = false;

    async function persistSetup() {
      const currentRecord = getClassRecord(classId);

      if (isOfficiallyFinalized(currentRecord)) {
        return;
      }

      const nextCustomPattern = getCustomPatternConfigForPattern(pattern)
        ? normalizeCustomPattern(customPattern, pattern)
        : null;
      const normalizedJudges = normalizeClassJudges({
        judges,
        judgeName: classItem?.judgeName,
      });
      const primaryJudgeName = getPrimaryJudgeName({ judges: normalizedJudges });
      const savedSetup = await saveSetupForClassRepository(classId, {
        ...setupRef.current,
        pattern,
        customPattern: nextCustomPattern,
        judges: normalizedJudges,
        judgeName: primaryJudgeName,
        blockClasses,
        runs,
        scheduleDetails,
        isDrawImported,
        dragInterval: dragInterval || null,
        dragDurationMinutes,
      });

      const classCustomPattern = nextCustomPattern || null;
      const scheduleStart = normalizeClassScheduleStart(scheduleDetails);
      const shouldSyncClassPattern =
        canManageSetup &&
        classItem?.id &&
        (classItem.pattern !== pattern ||
          String(classItem.arena || "") !== String(arena || "") ||
          String(classItem.scheduleStartMode || "") !==
            String(scheduleStart.startMode || "") ||
          String(classItem.scheduleStartTime || "") !==
            String(scheduleStart.startTime || "") ||
          String(classItem.judgeName || "") !== String(primaryJudgeName || "") ||
          JSON.stringify(classItem.customPattern || null) !==
            JSON.stringify(classCustomPattern));

      let savedClassItem = null;

      if (shouldSyncClassPattern) {
        savedClassItem = await saveClassItemRepository({
          ...classItem,
          pattern,
          arena,
          judgeName: primaryJudgeName,
          customPattern: classCustomPattern,
          scheduleStartMode: scheduleStart.startMode,
          scheduleStartTime: scheduleStart.startTime,
        });
      }

      if (isCancelled) return;

      setupRef.current = savedSetup;
      setClassData((currentData) =>
        currentData
          ? {
              ...currentData,
              classItem: savedClassItem || currentData.classItem,
              setup: savedSetup,
            }
          : currentData
      );
    }

    persistSetup();

    return () => {
      isCancelled = true;
    };
  }, [
    classId,
    pattern,
    customPattern,
    arena,
    judges,
    blockClasses,
    runs,
    scheduleDetails,
    isDrawImported,
    dragInterval,
    dragDurationMinutes,
    hasLoadedSetup,
    canManageSetup,
    classItem,
  ]);

  const updateJudgeName = (judgeId, name) => {
    if (!canManageSetup || isFullyLocked) {
      if (isFinalized) showFinalizedMessage();
      return;
    }

    setJudges((current) =>
      normalizeEditableJudges({
        judges: current.map((judge) =>
          judge.id === judgeId ? { ...judge, name } : judge
        ),
      })
    );
  };

  const addJudge = () => {
    if (!canManageSetup || isFullyLocked) {
      if (isFinalized) showFinalizedMessage();
      return;
    }

    setJudges((current) => {
      if (current.length >= MAX_CLASS_JUDGES) return current;
      return normalizeEditableJudges({
        judges: [...current, createClassJudge(current.length)],
      });
    });
  };

  const removeJudge = (judgeId) => {
    if (!canManageSetup || isFullyLocked) {
      if (isFinalized) showFinalizedMessage();
      return;
    }

    setJudges((current) => {
      if (current.length <= 1) return current;
      return normalizeEditableJudges({
        judges: current.filter((judge) => judge.id !== judgeId),
      });
    });
  };

  const updatePlannedLiveStatus = useCallback(async (nextStatus) => {
    if (!canManageSetup || !hasLoadedSetup || isPublicationLocked) {
      return;
    }

    const normalizedNextStatus = normalizePublicationStatusForJudges(
      nextStatus,
      judges
    );
    const savedPublication = await savePublicationStateRepository(classId, {
      plannedLiveStatus: normalizedNextStatus,
    });

    setPlannedLiveStatus(
      normalizePlannedLiveStatusForSetup(savedPublication, judges)
    );
    setClassData((currentData) =>
      currentData
        ? {
            ...currentData,
            publication: savedPublication,
          }
        : currentData
    );
  }, [
    canManageSetup,
    classId,
    hasLoadedSetup,
    isPublicationLocked,
    judges,
  ]);

  useEffect(() => {
    if (!hasLoadedSetup || !canManageSetup || isPublicationLocked) {
      return;
    }

    if (
      isScheduleOnly &&
      plannedLiveStatus !== PUBLICATION_STATUSES.HIDDEN &&
      plannedLiveStatus !== PUBLICATION_STATUSES.LIVE_NO_SCORE
    ) {
      updatePlannedLiveStatus(PUBLICATION_STATUSES.LIVE_NO_SCORE);
      return;
    }

    const normalizedStatus = normalizePublicationStatusForJudges(
      plannedLiveStatus,
      judges
    );

    if (normalizedStatus !== plannedLiveStatus) {
      updatePlannedLiveStatus(normalizedStatus);
    }
  }, [
    judges,
    plannedLiveStatus,
    hasLoadedSetup,
    canManageSetup,
    isPublicationLocked,
    isScheduleOnly,
    updatePlannedLiveStatus,
  ]);

  const addRun = () => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    setIsDrawImported(false);
    setRuns((prev) => [...prev, createEmptyRun(prev.length + 1)]);
  };

  const addLateEntryRun = () => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionAddLateEntry"));
      return;
    }

    const nextDraw = getNextLateEntryDraw(runs);
    setRunCountInput(String(runs.length + 1));
    setRuns((prev) =>
      sortRunsByDraw([
        ...prev,
        {
          ...createEmptyRun(prev.length + 1),
          draw: nextDraw,
        },
      ])
    );
  };

  const deleteRun = (runId) => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionDeleteRun"));
      return;
    }

    setIsDrawImported(false);
    setRuns((prev) => resequenceRuns(prev.filter((run) => run.id !== runId)));
  };

  const updateRunField = (runId, field, value) => {
    if (!canEditRunIdentity) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    setRuns((prev) =>
      prev.map((run) => (run.id === runId ? { ...run, [field]: value } : run))
    );
  };

  const moveRunUp = (index) => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionReorderRuns"));
      return;
    }

    if (isDrawImported) {
      showDrawLockedMessage();
      return;
    }

    if (index === 0) return;

    setRuns((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return resequenceRuns(next);
    });
  };

  const moveRunDown = (index) => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionReorderRuns"));
      return;
    }

    if (isDrawImported) {
      showDrawLockedMessage();
      return;
    }

    setRuns((prev) => {
      if (index >= prev.length - 1) return prev;

      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return resequenceRuns(next);
    });
  };

  const duplicateRun = (index) => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionDuplicateRun"));
      return;
    }

    if (isDrawImported) {
      showDrawLockedMessage();
      return;
    }

    setIsDrawImported(false);

    setRuns((prev) => {
      const source = prev[index];
      if (!source) return prev;

      const copy = {
        ...source,
        id: createId("run"),
      };

      const next = [...prev];
      next.splice(index + 1, 0, copy);

      return resequenceRuns(next);
    });
  };

  const applyRunCount = () => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    const targetCount = parseInt(runCountInput, 10);

    if (Number.isNaN(targetCount) || targetCount < 0) {
      return;
    }

    if (isStructureLocked && targetCount < runs.length) {
      showLockedMessage(t("management.classSetup.actionReduceRuns"));
      return;
    }

    if (targetCount !== runs.length) {
      setIsDrawImported(false);
    }

    setRuns((prev) => {
      if (targetCount === prev.length) return prev;

      if (targetCount < prev.length) {
        return resequenceRuns(prev.slice(0, targetCount));
      }

      const next = [...prev];

      while (next.length < targetCount) {
        next.push(createEmptyRun(next.length + 1));
      }

      return resequenceRuns(next);
    });
  };

  const updateCustomManeuverCount = (value) => {
    if (!canManageSetup || !customPatternConfig) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionEditCustomPattern"));
      return;
    }

    const parsedCount = parseInt(value, 10);
    const targetCount = Number.isFinite(parsedCount)
      ? Math.max(parsedCount, customPatternConfig.minManeuvers)
      : customPatternConfig.minManeuvers;

    setCustomPattern((prev) => {
      const current =
        normalizeCustomPattern(prev, pattern) ||
        createDefaultCustomPattern(pattern);
      const nextManeuvers = current.maneuvers.slice(0, targetCount);

      while (nextManeuvers.length < targetCount) {
        nextManeuvers.push({
          abbreviation: `${customPatternConfig.defaultManeuverPrefix || "M"}${
            nextManeuvers.length + 1
          }`,
          description: "",
        });
      }

      return normalizeCustomPattern(
        {
          ...current,
          maneuvers: nextManeuvers,
        },
        pattern
      );
    });
  };

  const updateCustomPatternName = (value) => {
    if (!canManageSetup || !customPatternConfig) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionEditCustomPattern"));
      return;
    }

    setCustomPattern((prev) => {
      const current =
        normalizeCustomPattern(prev, pattern) ||
        createDefaultCustomPattern(pattern);

      return normalizeCustomPattern(
        {
          ...current,
          name: value,
        },
        pattern
      );
    });
  };

  const updateCustomManeuverField = (index, field, value) => {
    if (!canManageSetup || !customPatternConfig) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionEditCustomPattern"));
      return;
    }

    setCustomPattern((prev) => {
      const current =
        normalizeCustomPattern(prev, pattern) ||
        createDefaultCustomPattern(pattern);
      const nextManeuvers = current.maneuvers.map((maneuver, maneuverIndex) =>
        maneuverIndex === index
          ? {
              ...maneuver,
              [field]: value,
            }
          : maneuver
      );

      return normalizeCustomPattern(
        {
          ...current,
          maneuvers: nextManeuvers,
        },
        pattern
      );
    });
  };

  const applyImportedDraw = (importedDraw, source = {}) => {
    const resequencedRuns = importedDraw?.runs || [];
    const importedBlockClasses = Array.isArray(importedDraw?.blockClasses)
      ? importedDraw.blockClasses
      : [];

    if (!resequencedRuns.length) {
      setImportSummary(null);
      setImportMessage(t("management.classSetup.importNoParticipants"));
      return;
    }

    setRuns(resequencedRuns);
    setBlockClasses(importedBlockClasses);
    setRunCountInput(String(resequencedRuns.length));
    setIsDrawImported(true);
    setImportSummary(buildImportSummary(importedDraw, resequencedRuns, source));

    if (importedDraw.dragInterval) {
      setDragInterval(String(importedDraw.dragInterval));
      setImportMessage(
        t("management.classSetup.importedWithDrag", {
          count: resequencedRuns.length,
          interval: importedDraw.dragInterval,
        })
      );
    } else {
      setImportMessage(
        t("management.classSetup.importedParticipants", {
          count: resequencedRuns.length,
        })
      );
    }
  };

  const importRunsFromText = () => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionImportDraw"));
      return;
    }

    applyImportedDraw(parseImportedDraw(importText), {
      type: t("management.classSetup.importSummaryManualSource"),
      label: t("management.classSetup.importSummaryManualSource"),
    });
  };

  const importRunsFromFile = async (file) => {
    if (!file || !canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage(t("management.classSetup.actionImportDraw"));
      return;
    }

    setImportMessage(t("management.classSetup.fileReading"));
    setImportSummary(null);

    try {
      const importedDraw = await parseImportedDrawFile(file);
      const type = getImportSourceLabel(file);
      applyImportedDraw(importedDraw, {
        type,
        label: `${type} · ${file.name || t("management.classSetup.importSummaryFile")}`,
      });
    } catch (error) {
      console.error("Erreur import draw:", error);
      const details = error?.message ? ` (${error.message})` : "";
      setImportMessage(
        t("management.classSetup.fileReadFailed", { details })
      );
    }
  };

  const handleDownloadOfficialPdf = async () => {
    const scoringRuns = await loadScoringRunsRepository(classId);
    const headers = getPatternHeaders(pattern, normalizedCustomPattern);
    const record = getClassRecord(classId);

    const pdf = generateScorePdf({
      associationName: association?.name || t("common.association"),
      associationLogoDataUrl: association?.logoDataUrl || null,
      eventName: show?.name || "",
      eventDate: day?.date || "",
      classItem,
      classSetup: {
        ...setupRef.current,
        judgeName: record?.official?.judgeName || "",
        judgeSignature: record?.official?.judgeSignature || null,
        finalizedAt: record?.official?.finalizedAt || null,
        judgeSignedAt: record?.official?.judgeSignedAt || null,
      },
      runs: scoringRuns,
      headers,
    });

    const fileName = buildScorePdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: show?.name || "show",
      className: classItem?.name || "block",
      finalizedAt:
        record?.official?.finalizedAt ||
        record?.official?.judgeSignedAt ||
        new Date().toISOString(),
    });

    pdf.save(fileName);
  };

  if (
    !access.isLoadingAccess &&
    !access.canManageAssociation &&
    !access.canScoreAssociation
  ) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
            {t("public.results.back")}
          </button>
        </div>
        <div style={emptyStateStyle}>
          {t("management.classSetup.accessDenied")}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>{t("management.classSetup.title")}</h1>
          <p style={subtitleStyle}>
            {t("management.classSetup.subtitle")}
          </p>
        </div>

        <div style={headerActionsStyle}>
          <div style={statusBadgeStyle(classStatus)}>
            {t("management.shows.statusPrefix")}: {classStatusLabel}
          </div>

          {isFinalized && canManageSetup && (
            <button
              type="button"
              onClick={handleDownloadOfficialPdf}
              style={primaryButtonStyle}
            >
              {t("management.classSetup.downloadOfficialPdf")}
            </button>
          )}
        </div>
      </div>

      {isFinalized && (
        <div style={finalizedBannerStyle}>
          {t("management.classSetup.finalizedBanner")}
        </div>
      )}

      {!isFinalized && isStructureLocked && (
        <div style={lockBannerStyle}>
          {t("management.classSetup.structureLockedBanner")}
        </div>
      )}

      {isDrawImported && !isFullyLocked && (
        <div style={drawLockBannerStyle}>
          {t("management.classSetup.drawLockedMessage")}
        </div>
      )}

      {isDrawImported && scoringStarted && access.canScoreAssociation && !canManageSetup && (
        <div style={drawLockBannerStyle}>
          {t("management.classSetup.scribeDrawLockedBanner")}
        </div>
      )}

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>
            {t("management.classSetup.generalInfo")}
          </h2>
        </div>

        <div style={fieldGridStyle}>
          <div>
            <label style={labelStyle}>{t("public.results.pattern")}</label>
            <select
              value={getPatternSelectValue(pattern)}
              onChange={(e) => {
                if (isFinalized) {
                  showFinalizedMessage();
                  return;
                }

                if (!canManageSetup) {
                  return;
                }

                if (isStructureLocked) {
                  showLockedMessage(t("management.classSetup.actionEditPattern"));
                  return;
                }

                const nextPattern = e.target.value;
                const nextConfig = getCustomPatternConfigForPattern(nextPattern);
                setPattern(nextPattern);
                setCustomPattern((currentCustomPattern) =>
                  nextConfig
                    ? normalizeCustomPattern(
                        currentCustomPattern ||
                          classSetup?.customPattern ||
                          classItem?.customPattern ||
                          createDefaultCustomPattern(nextPattern),
                        nextPattern
                      )
                    : null
                );
              }}
              style={inputStyle}
              disabled={!canManageSetup || isFullyLocked}
            >
              <option value="">{t("management.classes.choosePattern")}</option>
              {PATTERN_OPTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {canManageSetup && (
            <div>
              <label style={labelStyle}>
                {t("management.classes.arenaLabel")}
              </label>
              <input
                type="text"
                list="class-setup-arena-options"
                value={arena}
                onChange={(e) => setArena(e.target.value)}
                placeholder={t("management.classes.arenaPlaceholder")}
                style={inputStyle}
                disabled={!canManageSetup}
              />
              {arenaOptions.length > 0 && (
                <datalist id="class-setup-arena-options">
                  {arenaOptions.map((arenaOption) => (
                    <option key={arenaOption} value={arenaOption} />
                  ))}
                </datalist>
              )}
              <div style={helperTextStyle}>
                {t("management.classSetup.arenaHelper")}
              </div>
            </div>
          )}

          {canManageSetup && !isScheduleOnly && (
            <div>
              <label style={labelStyle}>
                {t("management.classSetup.runCount")}
              </label>
              <div style={inlineFieldStyle}>
                <input
                  type="number"
                  min="0"
                  value={runCountInput}
                  onChange={(e) => setRunCountInput(e.target.value)}
                  style={inputStyle}
                  disabled={isFinalized}
                />
                <button
                  onClick={applyRunCount}
                  style={buttonStyle}
                  disabled={isFinalized}
                >
                  {t("management.classSetup.apply")}
                </button>
              </div>
            </div>
          )}

          {canManageSetup && (
            <>
              <div>
                <label style={labelStyle}>
                  {t("management.classes.scheduleStartLabel")}
                </label>
                <select
                  value={scheduleDetails.startMode}
                  onChange={(event) =>
                    setScheduleDetails((current) =>
                      normalizeClassScheduleDetails({
                        ...current,
                        startMode: event.target.value,
                        startTime:
                          event.target.value === CLASS_START_MODE_FIXED
                            ? current.startTime
                            : "",
                      })
                    )
                  }
                  style={inputStyle}
                  disabled={!canManageSetup || isFinalized}
                >
                  <option value={CLASS_START_MODE_AFTER_PREVIOUS}>
                    {t("management.classes.startAfterPrevious")}
                  </option>
                  <option value={CLASS_START_MODE_FIXED}>
                    {t("management.classes.startFixed")}
                  </option>
                </select>
              </div>

              {scheduleDetails.startMode === CLASS_START_MODE_FIXED && (
                <div>
                  <label style={labelStyle}>
                    {t("management.classes.startTimeLabel")}
                  </label>
                  <input
                    type="time"
                    value={scheduleDetails.startTime}
                    onChange={(event) =>
                      setScheduleDetails((current) =>
                        normalizeClassScheduleDetails({
                          ...current,
                          startTime: event.target.value,
                        })
                      )
                    }
                    style={inputStyle}
                    disabled={!canManageSetup || isFinalized}
                  />
                </div>
              )}
            </>
          )}

          {canManageSetup && isScheduleOnly && (
            <>
              <div>
                <label style={labelStyle}>
                  {t("management.classSetup.participantCount")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={scheduleDetails.participantCount}
                  onChange={(event) =>
                    setScheduleDetails((current) =>
                      normalizeClassScheduleDetails({
                        ...current,
                        participantCount: event.target.value,
                      })
                    )
                  }
                  style={inputStyle}
                  disabled={!canManageSetup || isFinalized}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  {t("management.classSetup.sectionCount")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={scheduleDetails.sectionCount}
                  onChange={(event) =>
                    setScheduleDetails((current) =>
                      normalizeClassScheduleDetails({
                        ...current,
                        sectionCount: event.target.value,
                      })
                    )
                  }
                  style={inputStyle}
                  disabled={!canManageSetup || isFinalized}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  {t("management.classSetup.sectionSize")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={scheduleDetails.sectionSize}
                  onChange={(event) =>
                    setScheduleDetails((current) =>
                      normalizeClassScheduleDetails({
                        ...current,
                        sectionSize: event.target.value,
                      })
                    )
                  }
                  style={inputStyle}
                  disabled={!canManageSetup || isFinalized}
                />
              </div>

              <div>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={scheduleDetails.hasFinal}
                    onChange={(event) =>
                      setScheduleDetails((current) =>
                        normalizeClassScheduleDetails({
                          ...current,
                          hasFinal: event.target.checked,
                          finalCompleted: event.target.checked
                            ? current.finalCompleted
                            : false,
                        })
                      )
                    }
                    disabled={!canManageSetup || isFinalized}
                  />
                  {t("management.classSetup.hasFinal")}
                </label>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>
                  {t("management.classSetup.scheduleNote")}
                </label>
                <textarea
                  value={scheduleDetails.note}
                  onChange={(event) =>
                    setScheduleDetails((current) =>
                      normalizeClassScheduleDetails({
                        ...current,
                        note: event.target.value,
                      })
                    )
                  }
                  placeholder={t("management.classSetup.scheduleNotePlaceholder")}
                  style={textareaStyle}
                  disabled={!canManageSetup || isFinalized}
                />
                <div style={helperTextStyle}>
                  {t("management.classSetup.scheduleOnlyHelper")}
                </div>
              </div>
            </>
          )}

          {canManageSetup && !isScheduleOnly && (
            <div>
              <label style={labelStyle}>{t("public.results.dragSurface")}</label>
              <div style={inlineFieldStyle}>
                <select
                  value={dragInterval}
                  onChange={(e) => setDragInterval(e.target.value)}
                  style={inputStyle}
                  disabled={isFinalized}
                >
                  <option value="">
                    {t("management.classes.noDragPlanned")}
                  </option>
                  {DRAG_INTERVAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t("management.classSetup.afterEachParticipants", {
                        count: option,
                      })}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={dragDurationMinutes}
                  onChange={(e) => setDragDurationMinutes(e.target.value)}
                  style={smallNumberInputStyle}
                  disabled={isFinalized || !dragInterval}
                  aria-label={t("management.classSetup.dragDurationAria")}
                />
              </div>
              <div style={helperTextStyle}>
                {t("management.classSetup.dragDurationHelper")}
              </div>
            </div>
          )}

          {canManageSetup && (
            <div>
              <label style={labelStyle}>
                {t("management.classSetup.publicLiveStatus")}
              </label>
              <select
                value={plannedLiveStatus}
                onChange={(event) => updatePlannedLiveStatus(event.target.value)}
                style={inputStyle}
                disabled={isPublicationLocked}
              >
                {getPublicLiveStatusOptions(judges, isScheduleOnly).map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
                {isPublicationLocked && (
                  <option value={plannedLiveStatus}>
                    {getPublicationStatusLabel(plannedLiveStatus, t)}
                  </option>
                )}
              </select>
              <div style={helperTextStyle}>
                {isPublicationLocked
                  ? t("management.classSetup.finalPublicationAtSecretariat")
                  : judges.length > 1 &&
                      plannedLiveStatus === PUBLICATION_STATUSES.LIVE_SCORING
                    ? t("management.classSetup.publicLiveMultiJudgeLimited")
                    : getPublicationStatusDescription(plannedLiveStatus, t)}
                {" "}
                {t("management.classSetup.publicCurrentStatus", {
                  status: getPublicationStatusLabel(
                    classData?.publication?.status || PUBLICATION_STATUSES.HIDDEN,
                    t
                  ),
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {!isScheduleOnly && (
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              {t("management.classSetup.judgesTitle")}
            </h2>
            <p style={helperTextStyle}>
              {t("management.classSetup.judgesHelper")}
            </p>
          </div>

          {canManageSetup && (
            <button
              type="button"
              onClick={addJudge}
              style={buttonStyle}
              disabled={isFullyLocked || judges.length >= MAX_CLASS_JUDGES}
            >
              {t("management.classSetup.addJudge")}
            </button>
          )}
        </div>

        <div style={judgeListStyle}>
          {judges.map((judge, index) => (
            <div key={judge.id} style={judgeRowStyle}>
              <div style={judgeIndexStyle}>{index + 1}</div>
              <div>
                <label style={labelStyle}>
                  {t("management.classSetup.judgeName", {
                    number: index + 1,
                  })}
                </label>
                <input
                  type="text"
                  value={judge.name}
                  onChange={(event) => updateJudgeName(judge.id, event.target.value)}
                  placeholder={getJudgeDisplayName(judge, index)}
                  style={inputStyle}
                  disabled={!canManageSetup || isFullyLocked}
                />
              </div>
              {canManageSetup && judges.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeJudge(judge.id)}
                  style={secondaryButtonStyle}
                  disabled={isFullyLocked}
                >
                  {t("management.classSetup.removeJudge")}
                </button>
              )}
            </div>
          ))}
        </div>

        {isStructureLocked && !isFinalized && (
          <div style={helperTextStyle}>
            {t("management.classSetup.judgesLockedHelper")}
          </div>
        )}
      </section>
      )}

      {!isScheduleOnly && isSelectedCustomPattern && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>{customPatternConfig.name}</h2>
              <p style={helperTextStyle}>
                {t("management.classSetup.customPatternMinimum", {
                  count: customPatternConfig.minManeuvers,
                })}
              </p>
            </div>
          </div>

          {!isCustomPatternComplete && (
            <div style={customPatternWarningStyle}>
              {t("management.classSetup.customPatternIncomplete")}
            </div>
          )}

          <div style={customPatternNameStyle}>
            <label style={labelStyle}>
              {t("management.classSetup.customPatternName")}
            </label>
            <input
              type="text"
              value={normalizedCustomPattern?.name || ""}
              maxLength={customPatternConfig.maxNameLength || 80}
              onChange={(event) => updateCustomPatternName(event.target.value)}
              placeholder={customPatternConfig.name}
              style={inputStyle}
              disabled={!canManageSetup || isFullyLocked}
            />
            <div style={characterCountStyle}>
              {String(normalizedCustomPattern?.name || "").length}/
              {customPatternConfig.maxNameLength || 80}
            </div>
          </div>

          <div style={customPatternCountStyle}>
            <label style={labelStyle}>
              {t("management.classSetup.customManeuverCount")}
            </label>
            <input
              type="number"
              min={customPatternConfig.minManeuvers}
              value={normalizedCustomPattern?.maneuvers.length || 0}
              onChange={(event) => updateCustomManeuverCount(event.target.value)}
              style={smallNumberInputStyle}
              disabled={!canManageSetup || isFullyLocked}
            />
          </div>

          <div style={customPatternGridStyle}>
            {(normalizedCustomPattern?.maneuvers || []).map((maneuver, index) => (
              <div key={index} style={customManeuverRowStyle}>
                <div style={customManeuverIndexStyle}>#{index + 1}</div>

                <div>
                  <label style={labelStyle}>
                    {t("management.classSetup.abbreviation")}
                  </label>
                  <input
                    type="text"
                    value={maneuver.abbreviation}
                    onChange={(event) =>
                      updateCustomManeuverField(
                        index,
                        "abbreviation",
                        event.target.value
                      )
                    }
                    placeholder="GATE"
                    style={cellInputStyle}
                    disabled={!canManageSetup || isFullyLocked}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    {t("management.classSetup.fullDescription")}
                  </label>
                  <input
                    type="text"
                    value={maneuver.description}
                    maxLength={customPatternConfig.maxDescriptionLength || 80}
                    onChange={(event) =>
                      updateCustomManeuverField(
                        index,
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Gate"
                    style={cellInputStyle}
                    disabled={!canManageSetup || isFullyLocked}
                  />
                  <div style={characterCountStyle}>
                    {String(maneuver.description || "").length}/
                    {customPatternConfig.maxDescriptionLength || 80}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isScheduleOnly && (
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t("management.classSetup.runs")}</h2>

          {canManageSetup && (
            <div style={buttonRowStyle}>
              <button onClick={addRun} style={buttonStyle} disabled={isFinalized}>
                {t("management.classSetup.addRun")}
              </button>

              <button
                onClick={addLateEntryRun}
                style={buttonStyle}
                disabled={isFullyLocked}
              >
                {t("management.classSetup.addLateEntry")}
              </button>

              <button
                onClick={() => {
                  if (isFinalized) {
                    showFinalizedMessage();
                    return;
                  }

                  if (isStructureLocked) {
                    showLockedMessage(t("management.classSetup.actionImportDraw"));
                    return;
                  }

                  setShowImportBox((prev) => !prev);
                }}
                style={buttonStyle}
                disabled={isFullyLocked}
              >
                {t("management.classSetup.importDraw")}
              </button>
            </div>
          )}
        </div>

        {showImportBox && (
          <div style={importBoxStyle}>
            <p style={helperTextStyle}>
              {t("management.classSetup.importFileTitle")}
              <br />
              {t("management.classSetup.importFileHelpBefore")}{" "}
              <code>Tractor</code>{" "}
              {t("management.classSetup.importFileHelpAfter")}
            </p>

            <input
              type="file"
              accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0];
                importRunsFromFile(file);
                event.target.value = "";
              }}
              style={fileInputStyle}
            />

            <p style={helperTextStyle}>
              {t("management.classSetup.manualPasteTitle")}
              <br />
              <code>draw, backNumber, rider, horse, owner</code>
              <br />
              {t("management.classSetup.oneLinePerRun")}
              <br />
              {t("management.classSetup.lateEntryNegativeDrawBefore")} (
              <code>-1</code>, <code>-2</code>, etc.){" "}
              {t("management.classSetup.lateEntryNegativeDrawAfter")}
              <br />
              {t("management.classSetup.example")}
              <br />
              <code>1, 101, Félix Gadreau, Smart Spook, Jean Tremblay</code>
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`1, 101, Félix Gadreau, Smart Spook, Jean Tremblay
2, 102, Marie Roy, Custom Whiz, Luc Roy
3, 103, Alex Martin, Gunnatrashya, Sophie Martin`}
              style={textareaStyle}
            />

            <div style={buttonRowStyle}>
              <button onClick={importRunsFromText} style={buttonStyle}>
                {t("management.classSetup.replaceRunsWithImport")}
              </button>
            </div>

            {importMessage && (
              <div style={importMessageStyle}>{importMessage}</div>
            )}

            {blockClassesWithCounts.length > 0 && (
              <div style={classCodeSummaryStyle}>
                <span style={classCodeSummaryLabelStyle}>
                  {t("management.classSetup.detectedClassCodes")}
                </span>
                <div style={classCodePillListStyle}>
                  {blockClassesWithCounts.map((classEntry) => (
                    <span key={classEntry.code} style={classCodePillStyle}>
                      <strong>{classEntry.code}</strong>
                      {formatImportedBlockClassDetails(classEntry) && (
                        <span style={classCodeNameStyle}>
                          {formatImportedBlockClassDetails(classEntry)}
                        </span>
                      )}
                      <span style={classCodeEntryCountStyle}>
                        {t("management.classSetup.importSummaryEntryCount", {
                          count: classEntry.entryCount || 0,
                        })}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {runs.length === 0 ? (
          <div style={emptyStateStyle}>
            {canManageSetup ? (
              <>
                {t("management.classSetup.noRunsManager")}{" "}
                <strong>{t("management.classSetup.addRunPlain")}</strong>.
              </>
            ) : (
              t("management.classSetup.noRuns")
            )}
          </div>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>{t("public.results.backNumber")} #</th>
                  <th style={thStyle}>{t("management.classSetup.riderColumn")}</th>
                  <th style={thStyle}>{t("management.classSetup.horseColumn")}</th>
                  <th style={thStyle}>{t("public.results.owner")}</th>
                  {hasRunClassCodes && (
                    <th style={thStyle}>
                      {t("management.classSetup.classCodesColumn")}
                    </th>
                  )}
                  {canManageSetup && (
                    <th style={thStyle}>{t("management.days.orderLabel")}</th>
                  )}
                  {canManageSetup && (
                    <th style={thStyle}>
                      {t("management.classSetup.actions")}
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {runs.map((run, index) => (
                  <tr key={run.id}>
                    <td style={tdStyle}>{run.draw ?? run.order ?? index + 1}</td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={run.backNumber}
                        onChange={(e) =>
                          updateRunField(run.id, "backNumber", e.target.value)
                        }
                        placeholder="101"
                        style={cellInputStyle}
                        disabled={!canEditRunIdentity}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={run.rider}
                        onChange={(e) =>
                          updateRunField(run.id, "rider", e.target.value)
                        }
                        placeholder={t("management.classSetup.riderPlaceholder")}
                        style={cellInputStyle}
                        disabled={!canEditRunIdentity}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={run.horse}
                        onChange={(e) =>
                          updateRunField(run.id, "horse", e.target.value)
                        }
                        placeholder={t("management.classSetup.horsePlaceholder")}
                        style={cellInputStyle}
                        disabled={!canEditRunIdentity}
                      />
                    </td>

                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={run.owner}
                        onChange={(e) =>
                          updateRunField(run.id, "owner", e.target.value)
                        }
                        placeholder={t("management.classSetup.ownerPlaceholder")}
                        style={cellInputStyle}
                        disabled={!canEditRunIdentity}
                      />
                    </td>

                    {hasRunClassCodes && (
                      <td style={tdStyle}>
                        <div style={classCodePillListStyle}>
                          {(Array.isArray(run.classCodes)
                            ? run.classCodes
                            : []
                          ).map((code) => (
                            <span key={code} style={classCodePillStyle}>
                              {code}
                            </span>
                          ))}
                          {(!Array.isArray(run.classCodes) ||
                            run.classCodes.length === 0) && (
                            <span style={mutedClassCodeStyle}>
                              {t("management.classSetup.noClassCode")}
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {canManageSetup && (
                      <td style={tdStyle}>
                        <div style={orderButtonsStyle}>
                          <button
                            onClick={() => moveRunUp(index)}
                            disabled={isOrderLocked || index === 0}
                            style={smallButtonStyle}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveRunDown(index)}
                            disabled={isOrderLocked || index === runs.length - 1}
                            style={smallButtonStyle}
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                    )}

                    {canManageSetup && (
                      <td style={tdStyle}>
                        <div style={actionButtonsStyle}>
                          <button
                            onClick={() => duplicateRun(index)}
                            style={smallButtonStyle}
                            disabled={isOrderLocked}
                          >
                            {t("management.classes.duplicate")}
                          </button>
                          <button
                            onClick={() => deleteRun(run.id)}
                            style={dangerButtonStyle}
                            disabled={isFullyLocked}
                          >
                            {t("management.classes.delete")}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {importSummary && (
        <div
          style={modalBackdropStyle}
          role="presentation"
          onClick={() => setImportSummary(null)}
        >
          <div
            style={importSummaryModalStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-summary-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div style={importSummaryHeaderStyle}>
              <div>
                <div style={importSummaryEyebrowStyle}>
                  {importSummary.sourceLabel ||
                    t("management.classSetup.importSummaryManualSource")}
                </div>
                <h2 id="import-summary-title" style={importSummaryTitleStyle}>
                  {t("management.classSetup.importSummaryTitle")}
                </h2>
              </div>
              <button
                type="button"
                style={smallButtonStyle}
                onClick={() => setImportSummary(null)}
              >
                {t("management.classSetup.importSummaryClose")}
              </button>
            </div>

            <div style={importSummaryStatsStyle}>
              <ImportSummaryStat
                label={t("management.classSetup.importSummaryParticipants")}
                value={importSummary.participantCount}
              />
              <ImportSummaryStat
                label={t("management.classSetup.importSummaryClasses")}
                value={importSummary.classCount}
              />
              <ImportSummaryStat
                label={t("management.classSetup.importSummaryScratched")}
                value={importSummary.scratchedCount}
              />
            </div>

            <div style={importSummaryClassListStyle}>
              <div style={classCodeSummaryLabelStyle}>
                {t("management.classSetup.importSummaryBlockClasses")}
              </div>
              {importSummary.blockClasses.length > 0 ? (
                importSummary.blockClasses.map((classEntry) => (
                  <div key={classEntry.code} style={importSummaryClassRowStyle}>
                    <span style={importSummaryClassCodeStyle}>
                      {classEntry.code}
                    </span>
                    <span style={importSummaryClassNameStyle}>
                      {formatImportedBlockClassDetails(classEntry) ||
                        t("management.classSetup.importSummaryUnnamedClass")}
                    </span>
                    <span style={importSummaryClassCountStyle}>
                      {t("management.classSetup.importSummaryEntryCount", {
                        count: classEntry.entryCount || 0,
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <div style={mutedTextStyle}>
                  {t("management.classSetup.importSummaryNoClasses")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportSummaryStat({ label, value }) {
  return (
    <div style={importSummaryStatStyle}>
      <div style={importSummaryStatValueStyle}>{value}</div>
      <div style={importSummaryStatLabelStyle}>{label}</div>
    </div>
  );
}

const headerRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const headerActionsStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const titleStyle = {
  margin: 0,
  fontSize: "28px",
};

const subtitleStyle = {
  marginTop: "6px",
  color: "#666",
};

const finalizedBannerStyle = {
  marginBottom: "16px",
  padding: "12px 14px",
  borderRadius: "8px",
  background: "#ecfdf5",
  border: "1px solid #86efac",
  color: "#166534",
};

const lockBannerStyle = {
  marginBottom: "16px",
  padding: "12px 14px",
  borderRadius: "8px",
  background: "#fff7ed",
  border: "1px solid #fdba74",
  color: "#9a3412",
};

const drawLockBannerStyle = {
  marginBottom: "16px",
  padding: "12px 14px",
  borderRadius: "8px",
  background: "#eff6ff",
  border: "1px solid #93c5fd",
  color: "#1d4ed8",
};

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: "10px",
  padding: "16px",
  background: "#fff",
  marginBottom: "20px",
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

const judgeListStyle = {
  display: "grid",
  gap: 10,
};

const judgeRowStyle = {
  display: "grid",
  gridTemplateColumns: "44px minmax(220px, 1fr) auto",
  gap: 10,
  alignItems: "end",
};

const judgeIndexStyle = {
  minHeight: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  background: "#f1f5f9",
  color: "#334155",
  fontWeight: 800,
};

const customPatternCountStyle = {
  maxWidth: 280,
  marginBottom: 16,
};

const customPatternNameStyle = {
  maxWidth: 520,
  marginBottom: 16,
};

const customPatternGridStyle = {
  display: "grid",
  gap: 10,
};

const customManeuverRowStyle = {
  display: "grid",
  gridTemplateColumns: "48px minmax(120px, 180px) minmax(220px, 1fr)",
  gap: 10,
  alignItems: "end",
};

const customManeuverIndexStyle = {
  paddingBottom: 10,
  fontWeight: 700,
  color: "#475569",
};

const customPatternWarningStyle = {
  marginBottom: 16,
  padding: "10px 12px",
  borderRadius: 8,
  background: "#fff7ed",
  border: "1px solid #fdba74",
  color: "#9a3412",
  fontWeight: 600,
};

const characterCountStyle = {
  marginTop: 4,
  color: "#64748b",
  fontSize: 12,
  textAlign: "right",
};

const inlineFieldStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
};

const checkboxLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 42,
  fontWeight: 700,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const smallNumberInputStyle = {
  ...inputStyle,
  width: "96px",
  flex: "0 0 96px",
};

const cellInputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
};

const tableWrapperStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #ddd",
  background: "#f8f8f8",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};

const buttonRowStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "16px",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
};

const smallButtonStyle = {
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid #d99",
  background: "#fff5f5",
  cursor: "pointer",
};

const orderButtonsStyle = {
  display: "flex",
  gap: "6px",
};

const actionButtonsStyle = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
};

const emptyStateStyle = {
  padding: "20px",
  border: "1px dashed #ccc",
  borderRadius: "8px",
  color: "#666",
};

const importBoxStyle = {
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "12px",
  marginBottom: "16px",
  background: "#fafafa",
};

const textareaStyle = {
  width: "100%",
  minHeight: "120px",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  boxSizing: "border-box",
  marginBottom: "12px",
  fontFamily: "inherit",
};

const fileInputStyle = {
  display: "block",
  marginBottom: "12px",
};

const importMessageStyle = {
  marginTop: "10px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "#ecfeff",
  border: "1px solid #67e8f9",
  color: "#155e75",
  fontSize: "14px",
  fontWeight: 600,
};

const classCodeSummaryStyle = {
  marginTop: "10px",
  display: "grid",
  gap: "8px",
};

const classCodeSummaryLabelStyle = {
  color: "#374151",
  fontSize: "13px",
  fontWeight: 700,
};

const classCodePillListStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
};

const classCodePillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "wrap",
  minHeight: "22px",
  padding: "2px 7px",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontSize: "12px",
  fontWeight: 700,
};

const classCodeNameStyle = {
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 600,
};

const classCodeEntryCountStyle = {
  padding: "1px 6px",
  borderRadius: "999px",
  background: "#e0f2fe",
  color: "#075985",
  fontSize: "11px",
  fontWeight: 800,
};

const mutedClassCodeStyle = {
  color: "#9ca3af",
  fontSize: "12px",
};

const mutedTextStyle = {
  color: "#64748b",
  fontSize: "14px",
};

const helperTextStyle = {
  marginTop: 0,
  color: "#555",
  fontSize: "14px",
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  background: "rgba(15, 23, 42, 0.48)",
};

const importSummaryModalStyle = {
  width: "min(680px, 100%)",
  maxHeight: "calc(100vh - 40px)",
  overflow: "auto",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.28)",
  padding: "20px",
};

const importSummaryHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "18px",
};

const importSummaryEyebrowStyle = {
  color: "#475569",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const importSummaryTitleStyle = {
  margin: "4px 0 0",
  fontSize: "22px",
  color: "#111827",
};

const importSummaryStatsStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "10px",
  marginBottom: "18px",
};

const importSummaryStatStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "12px",
  background: "#f8fafc",
};

const importSummaryStatValueStyle = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: 800,
  lineHeight: 1,
};

const importSummaryStatLabelStyle = {
  marginTop: "6px",
  color: "#475569",
  fontSize: "13px",
  fontWeight: 700,
};

const importSummaryClassListStyle = {
  display: "grid",
  gap: "8px",
};

const importSummaryClassRowStyle = {
  display: "grid",
  gridTemplateColumns: "90px 1fr auto",
  gap: "10px",
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "10px 12px",
};

const importSummaryClassCodeStyle = {
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 800,
};

const importSummaryClassNameStyle = {
  color: "#334155",
  fontSize: "14px",
  fontWeight: 600,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const importSummaryClassCountStyle = {
  justifySelf: "end",
  padding: "4px 8px",
  borderRadius: "999px",
  background: "#e0f2fe",
  color: "#075985",
  fontSize: "12px",
  fontWeight: 800,
  whiteSpace: "nowrap",
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

function getPublicationStatusLabel(status, t) {
  switch (status) {
    case PUBLICATION_STATUSES.LIVE:
      return t("public.status.live");
    case PUBLICATION_STATUSES.LIVE_NO_SCORE:
      return t("public.status.liveNoScore");
    case PUBLICATION_STATUSES.LIVE_SCORING:
      return t("public.status.liveScoring");
    case PUBLICATION_STATUSES.LIVE_FINISHED:
      return t("public.status.liveFinished");
    case PUBLICATION_STATUSES.OFFICIAL:
      return t("public.status.official");
    case PUBLICATION_STATUSES.PUBLISHED:
      return t("public.status.published");
    case PUBLICATION_STATUSES.HIDDEN:
    default:
      return t("public.status.hidden");
  }
}

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

export default ClassSetupPage;
