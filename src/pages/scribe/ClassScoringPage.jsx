import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ScoreTable from "../../components/ScoreTable";
import SignaturePad from "../../components/SignaturePad";
import {
  getClassFullData,
  getClassFullDataRepository,
  saveSetupForClassRepository,
} from "../../features/classes/classRepository";
import { getClassSetup } from "../../features/classes/classSetupStorage";
import {
  finalizeClassWithJudge,
  saveFinalPdfFileName,
} from "../../features/classes/classFinalizationService";
import {
  getClassStatus,
  getClassStatusLabel,
} from "../../features/classes/classStatusSelectors";
import { loadAssociations } from "../../features/associations/associationsData";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getDayById } from "../../features/days/daySelectors";
import { getShowById } from "../../features/shows/showSelectors";
import { getPatternHeaders } from "../../features/patterns/patternDefinitions";
import { getScoringOptionsForPattern } from "../../features/scoring/scoringOptions";
import {
  isScoredRunComplete,
  recalculateRun,
  runHasVideoReview,
} from "../../utils/scoring";
import {
  loadActiveManoeuvre,
  loadScoringRuns,
  flushScoringSyncQueue,
  getScoringRunsSyncStatus,
  saveActiveManoeuvreRepository,
  saveScoringStartedAtRepository,
  saveScoringRunsRepository,
  SCORING_SYNC_STATUS,
} from "../../features/scoring/scoringRepository";
import {
  calculateClassTimingSummary,
  formatClockTime,
  formatDuration,
  stampRunTiming,
} from "../../features/classes/classTiming";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import { appStyles as styles } from "../../styles/appStyles";

function normalizeRunArrays(run, targetLength) {
  const nextScores = Array.isArray(run.scores) ? [...run.scores] : [];
  const nextPenalties = Array.isArray(run.penalties) ? [...run.penalties] : [];

  while (nextScores.length < targetLength) nextScores.push("");
  while (nextPenalties.length < targetLength) nextPenalties.push("");

  return {
    ...run,
    scores: nextScores.slice(0, targetLength),
    penalties: nextPenalties.slice(0, targetLength),
  };
}

function buildBaseRunsFromSetup(classId, maneuverCount) {
  const setup = getClassSetup(classId);
  const setupRuns = Array.isArray(setup?.runs) ? setup.runs : [];

  return setupRuns.map((run, index) =>
    recalculateRun(
      normalizeRunArrays(
        {
          id: run.id,
          draw: index + 1,
          order: index + 1,
          backNumber: run.backNumber || "",
          rider: run.rider || "",
          horse: run.horse || "",
          owner: run.owner || "",
          scores: [],
          penalties: [],
          penTotal: 0,
          scoreTotal: 70,
          isActive: false,
          note: "",
        },
        maneuverCount
      )
    )
  );
}

function mergeScoringRuns(baseRuns, savedRuns, maneuverCount) {
  if (!Array.isArray(savedRuns) || savedRuns.length === 0) {
    return baseRuns.map((run) =>
      recalculateRun(normalizeRunArrays(run, maneuverCount))
    );
  }

  const savedById = new Map(savedRuns.map((run) => [run.id, run]));

  return baseRuns.map((baseRun) => {
    const saved = savedById.get(baseRun.id);

    if (!saved) {
      return recalculateRun(normalizeRunArrays(baseRun, maneuverCount));
    }

    return recalculateRun(
      normalizeRunArrays(
        {
          ...baseRun,
          backNumber: saved.backNumber ?? baseRun.backNumber,
          rider: saved.rider ?? baseRun.rider,
          horse: saved.horse ?? baseRun.horse,
          owner: saved.owner ?? baseRun.owner,
          penalties: Array.isArray(saved.penalties)
            ? saved.penalties
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
      )
    );
  });
}

function loadRunsForClass(classId, maneuverCount) {
  const baseRuns = buildBaseRunsFromSetup(classId, maneuverCount);
  const savedRuns = loadScoringRuns(classId);
  return mergeScoringRuns(baseRuns, savedRuns, maneuverCount);
}

function sameActiveManoeuvre(a, b) {
  return a?.draw === b?.draw && a?.manoeuvreIndex === b?.manoeuvreIndex;
}

function isRunComplete(run, maneuverCount) {
  return isScoredRunComplete(run, maneuverCount);
}

function canFinalizeClass(runs, maneuverCount) {
  if (!Array.isArray(runs) || runs.length === 0) return false;
  return runs.every((run) => isRunComplete(run, maneuverCount));
}

const SCORING_SYNC_DEBOUNCE_MS = 800;

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
  const { associationId, classId } = useParams();
  const navigate = useNavigate();
  const access = useAssociationAccess(associationId);

  const [classData, setClassData] = useState(() => getClassFullData(classId));
  const classItem = classData?.classItem;
  const classSetup = classData?.setup;
  const assignedJudgeName = String(
    classSetup?.judgeName || classItem?.judgeName || ""
  ).trim();
  const day = getDayById(classItem?.dayId);
  const show = getShowById(classItem?.showId);

  const association = useMemo(() => {
    const allAssociations = loadAssociations();
    return allAssociations.find((item) => item.id === associationId) || null;
  }, [associationId]);

  const isCompleted = Boolean(
    classSetup?.finalized ||
      classSetup?.judgeSignedAt ||
      classItem?.finalized ||
      classItem?.judgeSignedAt
  );
  const isSecretariatValidated = Boolean(
    classData?.official?.isSecretariatValidated
  );

  const classStatus = isCompleted ? "completed" : getClassStatus(classItem);
  const classStatusLabel = getClassStatusLabel(classStatus);

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
  const maneuverCount = headers.length;

  const [runs, setRuns] = useState(() =>
    loadRunsForClass(classId, maneuverCount)
  );
  const lastPersistedRunsRef = useRef(JSON.stringify(runs));
  const [activeManoeuvre, setActiveManoeuvre] = useState(() =>
    isCompleted ? null : loadActiveManoeuvre(classId)
  );
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [scoringSyncStatus, setScoringSyncStatus] = useState(() =>
    getScoringRunsSyncStatus(classId)
  );

  const [showFinalizeBox, setShowFinalizeBox] = useState(false);
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
      const nextPatternValue = nextSetup.pattern || nextClassItem?.pattern || "";
      const nextCustomPattern =
        nextSetup.customPattern || nextClassItem?.customPattern || null;
      const nextManeuverCount = getPatternHeaders(
        nextPatternValue,
        nextCustomPattern
      ).length;
      const baseRuns = buildBaseRunsFromSetup(classId, nextManeuverCount);
      const nextRuns = mergeScoringRuns(
        baseRuns,
        nextData?.scoringRuns || [],
        nextManeuverCount
      );
      const nextActiveManoeuvre = loadActiveManoeuvre(classId);
      const nextIsCompleted = Boolean(
        nextSetup?.finalized ||
          nextSetup?.judgeSignedAt ||
          nextClassItem?.finalized ||
          nextClassItem?.judgeSignedAt
      );

      setClassData(nextData);
      setRuns(nextRuns);
      lastPersistedRunsRef.current = JSON.stringify(nextRuns);
      setActiveManoeuvre(nextIsCompleted ? null : nextActiveManoeuvre);
      setScoringSyncStatus(getScoringRunsSyncStatus(classId));
      setHasLoadedSession(true);
    }

    loadClassData();

    return () => {
      isMounted = false;
    };
  }, [classId]);

  useEffect(() => {
    const nextRuns = loadRunsForClass(classId, maneuverCount);

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

    if (
      nextActiveManoeuvre &&
      nextRuns.some((run) => run.draw === nextActiveManoeuvre.draw)
    ) {
      setActiveManoeuvre((prev) =>
        sameActiveManoeuvre(prev, nextActiveManoeuvre)
          ? prev
          : nextActiveManoeuvre
      );
    } else {
      setActiveManoeuvre((prev) => (prev ? null : prev));
    }
  }, [classId, maneuverCount, isCompleted]);

  useEffect(() => {
    const setupRuns = Array.isArray(classSetup?.runs) ? classSetup.runs : [];

    setRuns((prevRuns) => {
      const baseRuns = buildBaseRunsFromSetup(classId, maneuverCount);
      const mergedRuns = mergeScoringRuns(baseRuns, prevRuns, maneuverCount);

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

      const stillExists = setupRuns.some((_, index) => index + 1 === prevActive.draw);
      const manoeuvreStillExists = prevActive.manoeuvreIndex < maneuverCount;

      return stillExists && manoeuvreStillExists ? prevActive : null;
    });
  }, [classId, classSetup, maneuverCount, isCompleted]);

  useEffect(() => {
    if (!hasLoadedSession) return;
    const serializedRuns = JSON.stringify(runs);

    if (lastPersistedRunsRef.current === serializedRuns) {
      setScoringSyncStatus(getScoringRunsSyncStatus(classId));
      return;
    }

    lastPersistedRunsRef.current = serializedRuns;

    saveScoringRunsRepository(classId, runs, {
      debounceMs: SCORING_SYNC_DEBOUNCE_MS,
      onStatusChange: setScoringSyncStatus,
    })
      .catch(() => {
        setScoringSyncStatus(SCORING_SYNC_STATUS.PENDING);
      });
  }, [classId, runs, hasLoadedSession]);

  useEffect(() => {
    let isMounted = true;

    const updateSyncStatus = (status) => {
      if (isMounted) setScoringSyncStatus(status);
    };

    const retryPendingSync = () => {
      updateSyncStatus(getScoringRunsSyncStatus(classId));
      flushScoringSyncQueue({
        classId,
        onStatusChange: updateSyncStatus,
      })
        .then(() => {
          updateSyncStatus(getScoringRunsSyncStatus(classId));
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
  }, [classId]);

  useEffect(() => {
    if (!hasLoadedSession) return;
    saveActiveManoeuvreRepository(classId, activeManoeuvre);
  }, [classId, activeManoeuvre, hasLoadedSession]);

  useEffect(() => {
    setJudgeName(assignedJudgeName);
    setJudgeSignature(classSetup?.judgeSignature || null);
  }, [assignedJudgeName, classSetup?.judgeSignature]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const activeRunDraw = useMemo(() => {
    if (activeManoeuvre?.draw != null) return activeManoeuvre.draw;
    return runs.find((run) => run.isActive)?.draw ?? null;
  }, [activeManoeuvre, runs]);

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
  const canSignClass = canFinalize && !hasBlockingScoringSync;

  const normalizeSpaces = (value) =>
    String(value || "").replace(/\s+/g, " ").trim();

  const removeSpecialTokens = (value) => {
    let cleaned = String(value || "");
    specialPenaltyTokens.forEach((token) => {
      cleaned = cleaned.replaceAll(token, " ");
    });
    return normalizeSpaces(cleaned);
  };

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
      console.error("Erreur démarrage classe:", error);
    });
    saveScoringStartedAtRepository(classId, timestamp).catch((error) => {
      console.error("Erreur démarrage scoring:", error);
    });

    return timestamp;
  };

  const updateBackNumber = (draw, newValue) => {
    if (isCompleted) return;

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
    if (isCompleted) return;

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
    if (isCompleted) return;

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
          recalculateRun({
            ...run,
            isActive: true,
            scores: nextScores.slice(0, maneuverCount),
          }),
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
    if (isCompleted) return;
    updateScoreCell(draw, manoeuvreIndex, "");
  };

  const addPenaltyToken = (draw, manoeuvreIndex, token) => {
    if (isCompleted) return;

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

        const current = normalizeSpaces(nextPenalties[manoeuvreIndex] || "");

        if (specialPenaltyTokens.includes(token)) {
          const alreadySelected = current.includes(token);
          const cleaned = removeSpecialTokens(current);

          if (alreadySelected) {
            nextPenalties[manoeuvreIndex] = cleaned;
          } else {
            nextPenalties[manoeuvreIndex] = cleaned
              ? `${cleaned} ${token}`
              : token;
          }
        } else {
          nextPenalties[manoeuvreIndex] = current
            ? `${current} ${token}`
            : token;
        }

        return stampRunTiming(
          recalculateRun({
            ...run,
            isActive: true,
            penalties: nextPenalties.slice(0, maneuverCount),
          }),
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

  const toggleSpecialPenalty = (draw, manoeuvreIndex, token) => {
    if (isCompleted) return;

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

        const current = normalizeSpaces(nextPenalties[manoeuvreIndex] || "");
        const alreadySelected = current.includes(token);
        const cleaned = removeSpecialTokens(current);

        if (alreadySelected) {
          nextPenalties[manoeuvreIndex] = cleaned;
        } else {
          nextPenalties[manoeuvreIndex] = cleaned
            ? `${cleaned} ${token}`
            : token;
        }

        return stampRunTiming(
          recalculateRun({
            ...run,
            isActive: true,
            penalties: nextPenalties.slice(0, maneuverCount),
          }),
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
    if (isCompleted) return;

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
        nextPenalties[manoeuvreIndex] = "";

        return stampRunTiming(
          recalculateRun({
            ...run,
            isActive: true,
            penalties: nextPenalties.slice(0, maneuverCount),
          }),
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

  const setActiveManoeuvreWithRun = (value) => {
    if (isCompleted) return;

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

  const handleDownloadOfficialPdf = () => {
    if (!isSecretariatValidated) {
      alert("Le PDF officiel sera disponible après validation du secrétariat.");
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
      className: classItem?.name || "classe",
      finalizedAt:
        getClassSetup(classId)?.finalizedAt || new Date().toISOString(),
    });

    pdf.save(fileName);
  };

  const handleRetryScoringSync = () => {
    setScoringSyncStatus(SCORING_SYNC_STATUS.SYNCING);

    flushScoringSyncQueue({
      classId,
      onStatusChange: setScoringSyncStatus,
    })
      .then(() => {
        setScoringSyncStatus(getScoringRunsSyncStatus(classId));
      })
      .catch(() => {
        setScoringSyncStatus(SCORING_SYNC_STATUS.PENDING);
      });
  };

  const handleExportLocalScoringBackup = () => {
    const exportedAt = new Date().toISOString();
    const payload = {
      type: "reining-app-scoring-backup",
      version: 1,
      exportedAt,
      classId,
      scoringSyncStatus: getScoringRunsSyncStatus(classId),
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
      sanitizeFilePart(classItem?.name, "classe"),
      sanitizeFilePart(exportedAt.slice(0, 19), "date"),
    ].join("-");

    link.href = url;
    link.download = `${fileName}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const ensureScoringSyncedBeforeFinalize = async () => {
    const currentStatus = getScoringRunsSyncStatus(classId);

    if (!isScoringSyncBlockingStatus(currentStatus)) {
      return true;
    }

    setScoringSyncStatus(SCORING_SYNC_STATUS.SYNCING);

    try {
      await flushScoringSyncQueue({
        classId,
        onStatusChange: setScoringSyncStatus,
      });
    } catch (error) {
      setScoringSyncStatus(SCORING_SYNC_STATUS.PENDING);
    }

    const nextStatus = getScoringRunsSyncStatus(classId);
    setScoringSyncStatus(nextStatus);

    if (isScoringSyncBlockingStatus(nextStatus)) {
      alert(
        "Impossible de finaliser : les scores sont sauvegardés localement, mais pas encore synchronisés. Réessaie la sync ou exporte une sauvegarde locale avant de continuer."
      );
      return false;
    }

    return true;
  };

  const handleFinalizeScoring = async () => {
    if (isCompleted) return;

    if (hasPendingVideoReview) {
      alert("Impossible de finaliser : une révision vidéo est encore en attente.");
      return;
    }

    if (!canFinalize) {
      alert("Impossible de finaliser : certains runs ne sont pas complets.");
      return;
    }

    const isScoringSynced = await ensureScoringSyncedBeforeFinalize();

    if (!isScoringSynced) {
      return;
    }

    const signingJudgeName = assignedJudgeName || judgeName.trim();

    if (!signingJudgeName) {
      alert("Le nom du juge est requis.");
      return;
    }

    if (!judgeSignature) {
      alert("La signature du juge est requise.");
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
        className: classItem?.name || "classe",
        finalizedAt: finalized.finalizedAt,
      });

      pdf.save(fileName);
      await saveFinalPdfFileName(classId, fileName);

      const nextData = await getClassFullDataRepository(classId);
      setClassData(nextData);
      setShowFinalizeBox(false);

      alert("Classe finalisée avec signature. Le PDF a été généré.");
    } catch (error) {
      alert(error.message || "Impossible de finaliser cette classe.");
    }
  };

  if (!access.isLoadingAccess && !access.canScoreAssociation) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
            ← Retour
          </button>
        </div>
        <div style={lockBannerStyle}>
          Ce rôle n’a pas accès au scoring de cette association.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
      </div>

      <div style={topHeaderStyle}>
        <div style={styles.topbarWrap}>
          <div style={styles.topbar}>
            {(classItem?.name || "Classe") +
              (patternValue ? ` | Pattern ${patternValue}` : "") +
              (classSetup?.judgeName || classItem?.judgeName
                ? ` | Juge ${classSetup?.judgeName || classItem?.judgeName}`
                : "") +
              ` | ${runCount} run(s)` +
              (activeRunDraw != null ? ` | Run active: ${activeRunDraw}` : "")}
          </div>
        </div>

        <div style={headerButtonsStyle}>
          <div style={statusBadgeStyle(classStatus)}>
            Statut : {classStatusLabel}
          </div>

          <div style={scoringSyncBadgeStyle(scoringSyncStatus)}>
            {getScoringSyncLabel(scoringSyncStatus)}
          </div>

          {scoringSyncStatus === SCORING_SYNC_STATUS.PENDING && (
            <button
              type="button"
              onClick={handleRetryScoringSync}
              style={secondaryButtonStyle}
            >
              Réessayer sync
            </button>
          )}

          <button
            type="button"
            onClick={handleExportLocalScoringBackup}
            style={secondaryButtonStyle}
          >
            Exporter sauvegarde
          </button>

          {!isCompleted && (
            <button
              type="button"
              onClick={() => setShowFinalizeBox(true)}
              style={primaryButtonStyle}
              disabled={!canSignClass}
            >
              Signer la classe
            </button>
          )}

          {isCompleted && isSecretariatValidated && access.canManageAssociation && (
            <button
              type="button"
              onClick={handleDownloadOfficialPdf}
              style={primaryButtonStyle}
            >
              Télécharger le PDF officiel
            </button>
          )}
        </div>
      </div>

      {isCompleted && (
        <div style={lockBannerStyle}>
          Cette classe est terminée. Les scores, pénalités et back numbers sont verrouillés.
        </div>
      )}

      {!isCompleted && hasPendingVideoReview && (
        <div style={warningBannerStyle}>
          Une révision vidéo est en attente. Le score du run concerné reste caché
          et la classe ne peut pas être finalisée.
        </div>
      )}

      {!isCompleted && getScoringSyncNotice(scoringSyncStatus) && (
        <div style={scoringSyncNoticeStyle(scoringSyncStatus)}>
          {getScoringSyncNotice(scoringSyncStatus)}
        </div>
      )}

      {!isCompleted && !hasPendingVideoReview && !canFinalize && (
        <div style={warningBannerStyle}>
          La classe ne peut pas être finalisée tant que tous les runs ne sont pas complets.
        </div>
      )}

      {showFinalizeBox && !isCompleted && (
        <section style={finalizeCardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>
              Signature du juge
              {assignedJudgeName ? ` ${assignedJudgeName}` : ""}
            </h2>
          </div>

          {assignedJudgeName ? (
            <div style={judgeNoticeStyle}>
              Le juge associé à cette classe est {assignedJudgeName}.
            </div>
          ) : (
            <div style={fieldGridStyle}>
              <div>
                <label style={labelStyle}>Nom du juge</label>
                <input
                  type="text"
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  placeholder="Nom du juge"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Signature du juge</label>
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
              Confirmer la signature et finaliser
            </button>

            <button
              type="button"
              onClick={() => setShowFinalizeBox(false)}
              style={secondaryButtonStyle}
            >
              Annuler
            </button>
          </div>
        </section>
      )}

      <section style={timingCardStyle}>
        <div style={timingHeaderStyle}>
          <h2 style={sectionTitleStyle}>Gestion du temps</h2>
        </div>

        <div style={timingGridStyle}>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>Début</span>
            <strong>{formatClockTime(classSetup?.startedAt)}</strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>Complétés</span>
            <strong>
              {timingSummary.completedRuns}/{runCount}
            </strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>Moyenne/run</span>
            <strong>{formatDuration(timingSummary.averageRunSeconds)}</strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>Drags restants</span>
            <strong>{timingSummary.remainingDragBreaks}</strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>Temps restant</span>
            <strong>{formatDuration(timingSummary.remainingSeconds)}</strong>
          </div>
          <div style={timingMetricStyle}>
            <span style={timingLabelStyle}>Fin estimée</span>
            <strong>{formatClockTime(timingSummary.estimatedEndAt)}</strong>
          </div>
        </div>

        {timingSummary.averageRunSeconds == null && (
          <div style={timingHintStyle}>
            Le début réel sera enregistré au premier score ou à la première
            pénalité. L’estimation s’activera après le premier run complété avec
            un temps mesuré.
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
        scoreOptions={scoreOptions}
        penaltyOptions={penaltyOptions}
        statusPenaltyOptions={statusPenaltyOptions}
        updateScoreCell={updateScoreCell}
        clearScoreCell={clearScoreCell}
        addPenaltyToken={addPenaltyToken}
        toggleSpecialPenalty={toggleSpecialPenalty}
        clearPenaltyCell={clearPenaltyCell}
        updateBackNumber={updateBackNumber}
        updateRunNote={updateRunNote}
        isLocked={isCompleted}
        styles={styles}
      />
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

function getScoringSyncLabel(status) {
  if (status === SCORING_SYNC_STATUS.SYNCING) return "Synchronisation";
  if (status === SCORING_SYNC_STATUS.SYNCED) return "Synchronisé";
  if (status === SCORING_SYNC_STATUS.PENDING) return "Sync en attente";
  return "Sauvé localement";
}

function getScoringSyncNotice(status) {
  if (status === SCORING_SYNC_STATUS.SYNCING) {
    return "Synchronisation des scores en cours. La signature sera disponible dès que Supabase aura confirmé la sauvegarde.";
  }

  if (status === SCORING_SYNC_STATUS.PENDING) {
    return "Les scores sont sauvegardés localement sur cet appareil, mais ils ne sont pas encore synchronisés. Garde cette page ouverte, réessaie la sync au besoin, ou exporte une sauvegarde locale.";
  }

  if (status === SCORING_SYNC_STATUS.LOCAL) {
    return "Les derniers changements sont sauvegardés localement sur cet appareil.";
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

function scoringSyncNoticeStyle(status) {
  if (status === SCORING_SYNC_STATUS.PENDING) {
    return {
      ...warningBannerStyle,
      background: "#fff7ed",
      border: "1px solid #fdba74",
      color: "#9a3412",
    };
  }

  if (status === SCORING_SYNC_STATUS.SYNCING) {
    return warningBannerStyle;
  }

  return {
    ...warningBannerStyle,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
  };
}

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

const finalizeCardStyle = {
  border: "1px solid #ddd",
  borderRadius: "10px",
  padding: "16px",
  background: "#fff",
  marginBottom: "20px",
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
