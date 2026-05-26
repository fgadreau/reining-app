import React, { useEffect, useMemo, useRef, useState } from "react";
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
  parseImportedDraw,
  parseImportedDrawFile,
} from "../../features/classes/classSetupImport";
import { getClassRecord } from "../../features/classes/classRecordStorage";
import {
  getClassStatus,
  getClassStatusLabel,
} from "../../features/classes/classStatusSelectors";
import { hasScoringStarted } from "../../features/scoring/scoringSelectors";
import { appStyles as styles } from "../../styles/appStyles";
import {
  createDefaultCustomPattern,
  getCustomPatternConfigForPattern,
  getPatternHeaders,
  getPatternSelectValue,
  isCustomPatternReady,
  PATTERN_OPTION_GROUPS,
  normalizeCustomPattern,
} from "../../features/patterns/patternDefinitions";
import { loadScoringRunsRepository } from "../../features/scoring/scoringRepository";
import {
  DEFAULT_DRAG_DURATION_MINUTES,
  DRAG_INTERVAL_OPTIONS,
} from "../../features/classes/classTiming";
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import { savePublicationStateRepository } from "../../features/publication/publicationCloudRepository";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import { loadAssociations } from "../../features/associations/associationsData";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getDayById } from "../../features/days/daySelectors";
import { getShowById } from "../../features/shows/showSelectors";
import { createId } from "../../utils/createId";

function isOfficiallyFinalized(record) {
  return Boolean(
    record?.official?.finalized || record?.official?.judgeSignedAt
  );
}

function ClassSetupPage() {
  const { associationId, classId } = useParams();
  const navigate = useNavigate();
  const access = useAssociationAccess(associationId);

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
  const [runs, setRuns] = useState(classSetup?.runs || []);
  const [isDrawImported, setIsDrawImported] = useState(
    Boolean(classSetup?.isDrawImported)
  );
  const [dragInterval, setDragInterval] = useState(
    String(classSetup?.dragInterval || "")
  );
  const [dragDurationMinutes, setDragDurationMinutes] = useState(
    String(classSetup?.dragDurationMinutes || DEFAULT_DRAG_DURATION_MINUTES)
  );
  const [publicationStatus, setPublicationStatus] = useState(
    classData?.publication?.status || PUBLICATION_STATUSES.HIDDEN
  );
  const [isPublicLiveEnabled, setIsPublicLiveEnabled] = useState(
    classData?.publication?.status === PUBLICATION_STATUSES.LIVE
  );
  const [isFinalized, setIsFinalized] = useState(
    isOfficiallyFinalized(classRecord)
  );
  const [runCountInput, setRunCountInput] = useState(
    String((classSetup?.runs || []).length)
  );
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [showImportBox, setShowImportBox] = useState(false);

  const scoringStarted = hasScoringStarted(classId);
  const isStructureLocked = scoringStarted;
  const isFullyLocked = isStructureLocked || isFinalized;
  const isOrderLocked = isFullyLocked || isDrawImported;
  const isPublicationLocked = [
    PUBLICATION_STATUSES.OFFICIAL,
    PUBLICATION_STATUSES.PUBLISHED,
  ].includes(publicationStatus);
  const canManageSetup = access.canManageAssociation;
  const canEditRunIdentity =
    !isFinalized &&
    (canManageSetup ||
      (scoringStarted && !isDrawImported && access.canEditManualDraw));

  const classStatus = isFinalized ? "completed" : getClassStatus(classItem);
  const classStatusLabel = getClassStatusLabel(classStatus);
  const customPatternConfig = getCustomPatternConfigForPattern(pattern);
  const normalizedCustomPattern = customPatternConfig
    ? normalizeCustomPattern(customPattern, pattern)
    : null;
  const isSelectedCustomPattern = Boolean(customPatternConfig);
  const isCustomPatternComplete = isCustomPatternReady(
    pattern,
    normalizedCustomPattern
  );

  function showLockedMessage(actionLabel) {
    alert(
      `${actionLabel} est bloqué parce que le scoring de cette classe a déjà commencé.`
    );
  }

  function showFinalizedMessage() {
    alert("Cette classe est finalisée. Le setup ne peut plus être modifié.");
  }

  function showDrawLockedMessage() {
    alert(
      "L’ordre de passage est verrouillé parce qu’il provient d’un draw importé."
    );
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

      if (!isMounted) return;

      setupRef.current = nextSetup;
      setClassData(resolvedData);
      setPattern(nextPattern);
      setCustomPattern(nextCustomPattern);
      setRuns(nextRuns);
      setIsDrawImported(Boolean(nextSetup.isDrawImported));
      setDragInterval(String(nextSetup.dragInterval || ""));
      setDragDurationMinutes(
        String(nextSetup.dragDurationMinutes || DEFAULT_DRAG_DURATION_MINUTES)
      );
      setPublicationStatus(
        resolvedData.publication?.status || PUBLICATION_STATUSES.HIDDEN
      );
      setIsPublicLiveEnabled(
        resolvedData.publication?.status === PUBLICATION_STATUSES.LIVE
      );
      setIsFinalized(isOfficiallyFinalized(nextRecord));
      setRunCountInput(String(nextRuns.length));
      setShowImportBox(false);
      setImportText("");
      setImportMessage("");
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
      const savedSetup = await saveSetupForClassRepository(classId, {
        ...setupRef.current,
        pattern,
        customPattern: nextCustomPattern,
        runs,
        isDrawImported,
        dragInterval: dragInterval || null,
        dragDurationMinutes,
      });

      const classCustomPattern = nextCustomPattern || null;
      const shouldSyncClassPattern =
        canManageSetup &&
        classItem?.id &&
        (classItem.pattern !== pattern ||
          JSON.stringify(classItem.customPattern || null) !==
            JSON.stringify(classCustomPattern));

      let savedClassItem = null;

      if (shouldSyncClassPattern) {
        savedClassItem = await saveClassItemRepository({
          ...classItem,
          pattern,
          customPattern: classCustomPattern,
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
    runs,
    isDrawImported,
    dragInterval,
    dragDurationMinutes,
    hasLoadedSetup,
    canManageSetup,
    classItem,
  ]);

  useEffect(() => {
    if (!hasLoadedSetup || !canManageSetup) return undefined;
    if (isFinalized) return undefined;

    const nextStatus = isPublicLiveEnabled
      ? PUBLICATION_STATUSES.LIVE
      : publicationStatus === PUBLICATION_STATUSES.LIVE
        ? PUBLICATION_STATUSES.HIDDEN
        : publicationStatus;

    if (nextStatus === publicationStatus) {
      return undefined;
    }

    let isCancelled = false;

    async function persistPublicationState() {
      const savedPublication = await savePublicationStateRepository(classId, {
        status: nextStatus,
        publishedAt: null,
        publishedBy: null,
      });

      if (isCancelled) return;

      setPublicationStatus(savedPublication.status);
      setClassData((currentData) =>
        currentData
          ? {
              ...currentData,
              publication: savedPublication,
            }
          : currentData
      );
    }

    persistPublicationState();

    return () => {
      isCancelled = true;
    };
  }, [
    canManageSetup,
    classId,
    hasLoadedSetup,
    isFinalized,
    isPublicLiveEnabled,
    publicationStatus,
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

  const deleteRun = (runId) => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage("La suppression d’un run");
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
      showLockedMessage("Le réordonnancement des runs");
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
      showLockedMessage("Le réordonnancement des runs");
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
      showLockedMessage("La duplication d’un run");
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
      showLockedMessage("La réduction du nombre de runs");
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
      showLockedMessage("La modification du patron custom");
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

  const updateCustomManeuverField = (index, field, value) => {
    if (!canManageSetup || !customPatternConfig) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage("La modification du patron custom");
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

  const applyImportedDraw = (importedDraw) => {
    const resequencedRuns = importedDraw?.runs || [];

    if (!resequencedRuns.length) {
      setImportMessage("Aucun participant détecté dans cet import.");
      return;
    }

    setRuns(resequencedRuns);
    setRunCountInput(String(resequencedRuns.length));
    setIsDrawImported(true);

    if (importedDraw.dragInterval) {
      setDragInterval(String(importedDraw.dragInterval));
      setImportMessage(
        `${resequencedRuns.length} participant(s) importés. Drag détecté après chaque ${importedDraw.dragInterval} participant(s).`
      );
    } else {
      setImportMessage(`${resequencedRuns.length} participant(s) importés.`);
    }
  };

  const importRunsFromText = () => {
    if (!canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage("L’import du draw");
      return;
    }

    applyImportedDraw(parseImportedDraw(importText));
  };

  const importRunsFromFile = async (file) => {
    if (!file || !canManageSetup) return;

    if (isFinalized) {
      showFinalizedMessage();
      return;
    }

    if (isStructureLocked) {
      showLockedMessage("L’import du draw");
      return;
    }

    setImportMessage("Lecture du fichier en cours...");

    try {
      const importedDraw = await parseImportedDrawFile(file);
      applyImportedDraw(importedDraw);
    } catch (error) {
      console.error("Erreur import draw:", error);
      const details = error?.message ? ` (${error.message})` : "";
      setImportMessage(
        `Impossible de lire ce fichier${details}. Essaie le CSV ou copie-colle le texte du draw.`
      );
    }
  };

  const handleDownloadOfficialPdf = async () => {
    const scoringRuns = await loadScoringRunsRepository(classId);
    const headers = getPatternHeaders(pattern, normalizedCustomPattern);
    const record = getClassRecord(classId);

    const pdf = generateScorePdf({
      associationName: association?.name || "Association",
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
      className: classItem?.name || "classe",
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
            ← Retour
          </button>
        </div>
        <div style={emptyStateStyle}>
          Ce rôle n’a pas accès au setup de classe.
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

      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>Setup de classe</h1>
          <p style={subtitleStyle}>
            Prépare l’ordre de passage et les participants avant le scoring.
          </p>
        </div>

        <div style={headerActionsStyle}>
          <div style={statusBadgeStyle(classStatus)}>
            Statut : {classStatusLabel}
          </div>

          {isFinalized && canManageSetup && (
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

      {isFinalized && (
        <div style={finalizedBannerStyle}>
          Cette classe est finalisée. Le setup est maintenant verrouillé.
        </div>
      )}

      {!isFinalized && isStructureLocked && (
        <div style={lockBannerStyle}>
          Le scoring a déjà commencé pour cette classe. Les modifications
          structurelles du setup sont verrouillées.
        </div>
      )}

      {isDrawImported && !isFullyLocked && (
        <div style={drawLockBannerStyle}>
          L’ordre de passage est verrouillé parce qu’il provient d’un draw importé.
        </div>
      )}

      {isDrawImported && scoringStarted && access.canScoreAssociation && !canManageSetup && (
        <div style={drawLockBannerStyle}>
          Draw importé verrouillé pour le scribe après le début du scoring.
        </div>
      )}

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Infos générales</h2>
        </div>

        <div style={fieldGridStyle}>
          <div>
            <label style={labelStyle}>Pattern</label>
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
                  showLockedMessage("La modification du pattern");
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
              <option value="">Choisir un pattern</option>
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
              <label style={labelStyle}>Nombre de runs</label>
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
                  Appliquer
                </button>
              </div>
            </div>
          )}

          {canManageSetup && (
            <div>
              <label style={labelStyle}>Drag de surface</label>
              <div style={inlineFieldStyle}>
                <select
                  value={dragInterval}
                  onChange={(e) => setDragInterval(e.target.value)}
                  style={inputStyle}
                  disabled={isFinalized}
                >
                  <option value="">Aucun drag planifié</option>
                  {DRAG_INTERVAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      Après chaque {option} participant(s)
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
                  aria-label="Durée du drag en minutes"
                />
              </div>
              <div style={helperTextStyle}>
                Durée estimée d’un drag en minutes.
              </div>
            </div>
          )}

          {canManageSetup && (
            <div>
              <label style={labelStyle}>Vitrine publique</label>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={isPublicLiveEnabled}
                  onChange={(event) => {
                    if (isFinalized) {
                      showFinalizedMessage();
                      return;
                    }

                    setIsPublicLiveEnabled(event.target.checked);
                  }}
                  disabled={isFinalized || isPublicationLocked}
                />
                <span>Autoriser le live public pour cette classe</span>
              </label>
              <div style={helperTextStyle}>
                {isPublicationLocked
                  ? "La publication finale se gère au secrétariat."
                  : "Affiche la run en cours, la prochaine et les deux derniers passés dans la vitrine publique."}
              </div>
            </div>
          )}
        </div>
      </section>

      {isSelectedCustomPattern && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>{customPatternConfig.name}</h2>
              <p style={helperTextStyle}>
                Minimum {customPatternConfig.minManeuvers} manoeuvres pour cette
                discipline.
              </p>
            </div>
          </div>

          {!isCustomPatternComplete && (
            <div style={customPatternWarningStyle}>
              Complète l’abréviation et la description de chaque manoeuvre avant
              d’ouvrir le scoring.
            </div>
          )}

          <div style={customPatternCountStyle}>
            <label style={labelStyle}>Nombre d’obstacles/manoeuvres</label>
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
                  <label style={labelStyle}>Abréviation</label>
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
                  <label style={labelStyle}>Description complète</label>
                  <input
                    type="text"
                    value={maneuver.description}
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
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Runs</h2>

          {canManageSetup && (
            <div style={buttonRowStyle}>
              <button onClick={addRun} style={buttonStyle} disabled={isFinalized}>
                + Ajouter un run
              </button>

              <button
                onClick={() => {
                  if (isFinalized) {
                    showFinalizedMessage();
                    return;
                  }

                  if (isStructureLocked) {
                    showLockedMessage("L’import du draw");
                    return;
                  }

                  setShowImportBox((prev) => !prev);
                }}
                style={buttonStyle}
                disabled={isFullyLocked}
              >
                Importer un draw
              </button>
            </div>
          )}
        </div>

        {showImportBox && (
          <div style={importBoxStyle}>
            <p style={helperTextStyle}>
              Import CSV/PDF :
              <br />
              les lignes <code>Tractor</code> sont utilisées pour détecter
              automatiquement l’intervalle de drag.
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
              Copier-coller manuel :
              <br />
              <code>draw, backNumber, rider, horse, owner</code>
              <br />
              Une ligne par run.
              <br />
              Exemple :
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
                Remplacer les runs avec cet import
              </button>
            </div>

            {importMessage && (
              <div style={importMessageStyle}>{importMessage}</div>
            )}
          </div>
        )}

        {runs.length === 0 ? (
          <div style={emptyStateStyle}>
            {canManageSetup ? (
              <>
                Aucun run pour l’instant. Entre un nombre de runs ou clique sur
                <strong> Ajouter un run</strong>.
              </>
            ) : (
              "Aucun run pour cette classe."
            )}
          </div>
        ) : (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Back #</th>
                  <th style={thStyle}>Rider</th>
                  <th style={thStyle}>Horse</th>
                  <th style={thStyle}>Owner</th>
                  {canManageSetup && <th style={thStyle}>Ordre</th>}
                  {canManageSetup && <th style={thStyle}>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {runs.map((run, index) => (
                  <tr key={run.id}>
                    <td style={tdStyle}>{index + 1}</td>

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
                        placeholder="Nom du rider"
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
                        placeholder="Nom du cheval"
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
                        placeholder="Nom du owner"
                        style={cellInputStyle}
                        disabled={!canEditRunIdentity}
                      />
                    </td>

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
                            Dupliquer
                          </button>
                          <button
                            onClick={() => deleteRun(run.id)}
                            style={dangerButtonStyle}
                            disabled={isFullyLocked}
                          >
                            Supprimer
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

const customPatternCountStyle = {
  maxWidth: 280,
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

const inlineFieldStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const checkboxRowStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  minHeight: 40,
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

const helperTextStyle = {
  marginTop: 0,
  color: "#555",
  fontSize: "14px",
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

export default ClassSetupPage;
