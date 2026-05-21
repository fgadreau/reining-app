import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ScoreTable from "../../components/ScoreTable";
import SignaturePad from "../../components/SignaturePad";
import {
  getClassFullData,
  getClassFullDataRepository,
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
import {
  isScoredRunComplete,
  recalculateRun,
  runHasVideoReview,
} from "../../utils/scoring";
import {
  loadActiveManoeuvre,
  loadScoringRuns,
  saveActiveManoeuvreRepository,
  saveScoringRunsRepository,
} from "../../features/scoring/scoringRepository";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import { appStyles as styles } from "../../styles/appStyles";

const scoreOptions = ["-1.5", "-1", "-0.5", "0", "+0.5", "+1", "+1.5"];
const penaltyOptions = ["½", "1", "2", "5", "Score 0"];
const SPECIAL_TOKENS = ["Score 0", "No score", "Scratch", "Révision vidéo"];

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
  const headers = useMemo(() => getPatternHeaders(patternValue), [patternValue]);
  const maneuverCount = headers.length;

  const [runs, setRuns] = useState(() =>
    loadRunsForClass(classId, maneuverCount)
  );
  const [activeManoeuvre, setActiveManoeuvre] = useState(() =>
    isCompleted ? null : loadActiveManoeuvre(classId)
  );
  const [hasLoadedSession, setHasLoadedSession] = useState(false);

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
      const nextManeuverCount = getPatternHeaders(nextPatternValue).length;
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
      setActiveManoeuvre(nextIsCompleted ? null : nextActiveManoeuvre);
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
    saveScoringRunsRepository(classId, runs);
  }, [classId, runs, hasLoadedSession]);

  useEffect(() => {
    if (!hasLoadedSession) return;
    saveActiveManoeuvreRepository(classId, activeManoeuvre);
  }, [classId, activeManoeuvre, hasLoadedSession]);

  useEffect(() => {
    setJudgeName(assignedJudgeName);
    setJudgeSignature(classSetup?.judgeSignature || null);
  }, [assignedJudgeName, classSetup?.judgeSignature]);

  const activeRunDraw = useMemo(() => {
    if (activeManoeuvre?.draw != null) return activeManoeuvre.draw;
    return runs.find((run) => run.isActive)?.draw ?? null;
  }, [activeManoeuvre, runs]);

  const runCount = runs.length;
  const canFinalize = canFinalizeClass(runs, maneuverCount);
  const hasPendingVideoReview = runs.some(runHasVideoReview);

  const normalizeSpaces = (value) =>
    String(value || "").replace(/\s+/g, " ").trim();

  const removeSpecialTokens = (value) => {
    let cleaned = String(value || "");
    SPECIAL_TOKENS.forEach((token) => {
      cleaned = cleaned.replaceAll(token, " ");
    });
    return normalizeSpaces(cleaned);
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

  const updateScoreCell = (draw, manoeuvreIndex, newValue) => {
    if (isCompleted) return;

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

        return recalculateRun({
          ...run,
          isActive: true,
          scores: nextScores.slice(0, maneuverCount),
        });
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

        if (SPECIAL_TOKENS.includes(token)) {
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

        return recalculateRun({
          ...run,
          isActive: true,
          penalties: nextPenalties.slice(0, maneuverCount),
        });
      })
    );

    setActiveManoeuvre({
      draw,
      manoeuvreIndex,
    });
  };

  const toggleSpecialPenalty = (draw, manoeuvreIndex, token) => {
    if (isCompleted) return;

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

        return recalculateRun({
          ...run,
          isActive: true,
          penalties: nextPenalties.slice(0, maneuverCount),
        });
      })
    );

    setActiveManoeuvre({
      draw,
      manoeuvreIndex,
    });
  };

  const clearPenaltyCell = (draw, manoeuvreIndex) => {
    if (isCompleted) return;

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

        return recalculateRun({
          ...run,
          isActive: true,
          penalties: nextPenalties.slice(0, maneuverCount),
        });
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

    const headersForPdf = getPatternHeaders(patternValue);

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

          {!isCompleted && (
            <button
              type="button"
              onClick={() => setShowFinalizeBox(true)}
              style={primaryButtonStyle}
              disabled={!canFinalize}
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

      <ScoreTable
        headers={headers}
        runs={runs}
        activeManoeuvre={activeManoeuvre}
        setActiveManoeuvre={setActiveManoeuvreWithRun}
        scoreOptions={scoreOptions}
        penaltyOptions={penaltyOptions}
        updateScoreCell={updateScoreCell}
        clearScoreCell={clearScoreCell}
        addPenaltyToken={addPenaltyToken}
        toggleSpecialPenalty={toggleSpecialPenalty}
        clearPenaltyCell={clearPenaltyCell}
        updateBackNumber={updateBackNumber}
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
