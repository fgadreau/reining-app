import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteClassCompletelyRepository,
  getClassesForDayRepository,
  saveClassItemRepository,
  saveSetupForClassRepository,
} from "../../features/classes/classRepository";
import { getClassSetupRepository } from "../../features/classes/classSetupRepository";
import {
  deletePaidWarmupRepository,
  getPaidWarmupsForDayRepository,
  savePaidWarmupRepository,
} from "../../features/paidWarmups/paidWarmupRepository";
import {
  DEFAULT_PAID_WARMUP_DURATION_MINUTES,
  getPaidWarmupStats,
} from "../../features/paidWarmups/paidWarmupStorage";
import { getClassStatus, getClassStatusLabel } from "../../features/classes/classStatusSelectors";
import { getDayById } from "../../features/days/daySelectors";
import { getShowById } from "../../features/shows/showSelectors";
import { loadAssociations } from "../../features/associations/associationsData";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  createDefaultCustomPattern,
  getCustomPatternConfigForPattern,
  getPatternDisplayName,
  getPatternHeaders,
  getPatternSelectValue,
  normalizeCustomPattern,
  PATTERN_OPTION_GROUPS,
} from "../../features/patterns/patternDefinitions";
import { loadScoringRunsRepository } from "../../features/scoring/scoringRepository";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import { getClassOfficialData } from "../../features/classes/classOfficialData";
import { appStyles as styles } from "../../styles/appStyles";
import { createId } from "../../utils/createId";

function DayClassesPage() {
  const { associationId, showId, dayId } = useParams();
  const navigate = useNavigate();

  const day = getDayById(dayId);
  const show = getShowById(showId);
  const access = useAssociationAccess(associationId);

  const association = useMemo(() => {
    const allAssociations = loadAssociations();
    return allAssociations.find((item) => item.id === associationId) || null;
  }, [associationId]);

  const [classes, setClasses] = useState([]);
  const [paidWarmups, setPaidWarmups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    name: "",
    classCode: "",
    pattern: "",
    judgeName: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextClasses, nextPaidWarmups] = await Promise.all([
        getClassesForDayRepository(dayId),
        getPaidWarmupsForDayRepository(dayId),
      ]);
      if (!isMounted) return;
      setClasses(nextClasses);
      setPaidWarmups(nextPaidWarmups);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [dayId]);

  const startCreateClass = async () => {
    const newClass = {
      id: createId("class"),
      dayId,
      showId,
      associationId,
      name: "Nouvelle classe",
      classCode: "",
      pattern: "",
      customPattern: null,
      judgeName: "",
      showName: show?.name || "",
      date: day?.date || "",
      dayLabel: day?.label || "",
      sortOrder: classes.length + paidWarmups.length + 1,
    };

    setIsSaving(true);
    await saveClassItemRepository(newClass);
    setClasses((current) => [...current, newClass]);
    setIsSaving(false);

    setEditingId(newClass.id);
    setDraft({
      name: newClass.name,
      classCode: newClass.classCode,
      pattern: newClass.pattern,
      judgeName: newClass.judgeName,
    });
  };

  const startCreatePaidWarmup = async () => {
    const newWarmup = {
      id: createId("paid_warmup"),
      dayId,
      showId,
      associationId,
      name: "Nouveau paid warm up",
      durationMinutesPerRider: DEFAULT_PAID_WARMUP_DURATION_MINUTES,
      dragInterval: null,
      dragDurationMinutes: 8,
      entries: [],
      sortOrder: classes.length + paidWarmups.length + 1,
    };

    setIsSaving(true);
    const saved = await savePaidWarmupRepository(newWarmup);
    setPaidWarmups((current) => [...current, saved]);
    setIsSaving(false);

    navigate(
      `/associations/${associationId}/shows/${showId}/days/${dayId}/paid-warmups/${saved.id}/setup`
    );
  };

  const startEditClass = (item) => {
    setEditingId(item.id);
    setDraft({
      name: item.name || "",
      classCode: item.classCode || "",
      pattern: item.pattern || "",
      judgeName: item.judgeName || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({
      name: "",
      classCode: "",
      pattern: "",
      judgeName: "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const currentClass = classes.find((item) => item.id === editingId);
    const customPatternConfig = getCustomPatternConfigForPattern(draft.pattern);
    const customPattern = customPatternConfig
      ? normalizeCustomPattern(
          currentClass?.customPattern || createDefaultCustomPattern(draft.pattern),
          draft.pattern
        )
      : null;
    const nextClass = {
      ...currentClass,
      name: draft.name,
      classCode: draft.classCode,
      pattern: draft.pattern,
      customPattern,
      judgeName: draft.judgeName,
      showId,
      associationId,
      showName: show?.name || "",
      date: day?.date || "",
      dayLabel: day?.label || "",
    };

    setIsSaving(true);
    await saveClassItemRepository(nextClass);
    setClasses((current) =>
      current.map((item) => (item.id === editingId ? nextClass : item))
    );
    setIsSaving(false);

    setEditingId(null);
  };

  const handleDeleteClass = async (id) => {
    const confirmed = window.confirm("Supprimer cette classe ?");
    if (!confirmed) return;

    setIsSaving(true);
    await deleteClassCompletelyRepository(id);
    setClasses((current) => current.filter((item) => item.id !== id));
    setIsSaving(false);

    if (editingId === id) {
      cancelEdit();
    }
  };

  const handleDuplicateClass = async (item) => {
    if (!item?.id) return;

    setIsSaving(true);

    try {
      const sourceSetup = await getClassSetupRepository(item.id);
      const sourcePattern = sourceSetup.pattern || item.pattern || "";
      const sourceCustomPattern =
        sourceSetup.customPattern || item.customPattern || null;
      const customPattern = getCustomPatternConfigForPattern(sourcePattern)
        ? normalizeCustomPattern(
            sourceCustomPattern || createDefaultCustomPattern(sourcePattern),
            sourcePattern
          )
        : null;
      const newClass = {
        ...item,
        id: createId("class"),
        name: `${item.name || "Classe"} copie`,
        pattern: sourcePattern,
        customPattern,
        sortOrder: classes.length + paidWarmups.length + 1,
        finalized: false,
        finalizedAt: null,
        judgeSignedAt: null,
        showId,
        dayId,
        associationId,
        showName: show?.name || "",
        date: day?.date || "",
        dayLabel: day?.label || "",
      };
      const newSetup = {
        ...sourceSetup,
        pattern: sourcePattern,
        customPattern,
        runs: [],
        isDrawImported: false,
        startedAt: null,
        lockedAt: null,
        lockedBy: null,
        finalized: false,
        finalizedAt: null,
        judgeSignature: null,
        judgeSignedAt: null,
        finalPdf: null,
        finalPdfFileName: null,
      };

      const savedClass = await saveClassItemRepository(newClass);
      await saveSetupForClassRepository(savedClass.id, newSetup);

      setClasses((current) => [...current, savedClass]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePaidWarmup = async (id) => {
    const confirmed = window.confirm("Supprimer ce paid warm up ?");
    if (!confirmed) return;

    setIsSaving(true);
    await deletePaidWarmupRepository(id);
    setPaidWarmups((current) => current.filter((item) => item.id !== id));
    setIsSaving(false);
  };

  const scheduleItems = useMemo(() => {
    return [
      ...classes.map((item) => ({
        id: item.id,
        type: "class",
        sortOrder: item.sortOrder || 1,
        item,
      })),
      ...paidWarmups.map((item) => ({
        id: item.id,
        type: "paid_warmup",
        sortOrder: item.sortOrder || 1,
        item,
      })),
    ].sort((a, b) => {
      const sortOrder = a.sortOrder - b.sortOrder;
      if (sortOrder !== 0) return sortOrder;
      return String(a.item.name || "").localeCompare(String(b.item.name || ""));
    });
  }, [classes, paidWarmups]);

  const handleOpenScoring = (event, item) => {
    const officialData = getClassOfficialData(item.id, item);
    const status = officialData.isFinalized
      ? "completed"
      : getClassStatus(item);

    if (status === "draft") {
      event.preventDefault();
      alert(
        "Cette classe n’est pas prête pour le scoring. Complète d’abord le setup avec un pattern et des runs."
      );
    }
  };

  const handleDownloadOfficialPdf = async (item) => {
    const officialData = getClassOfficialData(item.id, item);

    if (!officialData.isSecretariatValidated) {
      alert("Le PDF officiel sera disponible après validation du secrétariat.");
      return;
    }

    const scoringRuns = await loadScoringRunsRepository(item.id);
    const headers = getPatternHeaders(
      officialData.patternValue || officialData.pattern,
      officialData.customPattern
    );

    const pdf = generateScorePdf({
      associationName: association?.name || "Association",
      associationLogoDataUrl: association?.logoDataUrl || null,
      eventName: officialData.eventName || "",
      eventDate: officialData.eventDate || "",
      classItem: item,
      classSetup: {
        ...officialData.setup,
        judgeName: officialData.judgeName,
        judgeSignature: officialData.judgeSignature,
        finalizedAt: officialData.finalizedAt,
        judgeSignedAt: officialData.judgeSignedAt,
      },
      runs: scoringRuns,
      headers,
    });

    const fileName = buildScorePdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: officialData.eventName || "show",
      className: item?.name || "classe",
      finalizedAt: officialData.finalizedAt || new Date().toISOString(),
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
          Ce rôle n’a pas accès à la gestion des classes.
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

      <div style={headerWrapStyle}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{show?.name || "Show"}</h1>
          <h2 style={{ fontSize: 20, margin: 0, color: "#475569" }}>
            {day?.label || "Journée"} {day?.date ? `— ${day.date}` : ""}
          </h2>
        </div>

        {access.canManageAssociation && (
          <div style={headerActionsStyle}>
            <button
              onClick={startCreateClass}
              style={primaryButtonStyle}
              disabled={isSaving}
            >
              + Ajouter une classe
            </button>
            <button
              onClick={startCreatePaidWarmup}
              style={secondaryButtonStyle}
              disabled={isSaving}
            >
              + Ajouter un paid warm up
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement de la journée…</div>
      ) : scheduleItems.length === 0 ? (
        <div style={emptyStateStyle}>
          Aucune classe ou paid warm up pour cette journée.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {scheduleItems.map((scheduleItem) => {
            if (scheduleItem.type === "paid_warmup") {
              const warmup = scheduleItem.item;
              const stats = getPaidWarmupStats(warmup.entries);

              return (
                <div key={warmup.id} style={cardStyle}>
                  <div style={cardHeaderStyle}>
                    <div>
                      <div style={cardTitleStyle}>
                        {warmup.name || "Paid warm up"}
                      </div>
                      <div style={cardMetaStyle}>
                        {warmup.durationMinutesPerRider} min/cavalier •{" "}
                        {formatPaidWarmupDrag(warmup)} • {stats.total} cavalier
                        {stats.total > 1 ? "s" : ""}
                      </div>
                      <div style={warmupStatsStyle}>
                        {stats.pending} à venir • {stats.done} passés •{" "}
                        {stats.noShow} no show • {stats.scratch} scratch
                      </div>
                    </div>

                    <div style={warmupBadgeStyle}>Paid warm up</div>
                  </div>

                  <div style={actionRowStyle}>
                    {access.canManageAssociation && (
                      <Link
                        to={`/associations/${associationId}/shows/${showId}/days/${dayId}/paid-warmups/${warmup.id}/setup`}
                        style={linkButtonStyle}
                      >
                        Gérer l’ordre de passage
                      </Link>
                    )}

                    {access.canManageAssociation && (
                      <button
                        type="button"
                        onClick={() => handleDeletePaidWarmup(warmup.id)}
                        style={dangerButtonStyle}
                        disabled={isSaving}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            const item = scheduleItem.item;
            const isEditing = editingId === item.id;
            const officialData = getClassOfficialData(item.id, item);

            const status = officialData.isFinalized
              ? "completed"
              : getClassStatus(item);

            const statusLabel = getClassStatusLabel(status);
            const scoringDisabled = status === "draft";
            const isCompleted = status === "completed";

            return (
              <div key={item.id} style={cardStyle}>
                {!isEditing ? (
                  <>
                    <div style={cardHeaderStyle}>
                      <div>
                        <div style={cardTitleStyle}>
                          {item.name || "Classe sans nom"}{" "}
                          {item.classCode ? `(${item.classCode})` : ""}
                        </div>

                        <div style={cardMetaStyle}>
                          Pattern{" "}
                          {getPatternDisplayName(
                            item.pattern,
                            item.customPattern
                          ) || "—"}{" "}
                          • Juge {officialData.judgeName || "—"}
                        </div>
                      </div>

                      <div style={statusBadgeStyle(status)}>
                        {statusLabel}
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      {(access.canManageAssociation ||
                        access.canScoreAssociation) && (
                        <Link
                          to={`/associations/${associationId}/classes/${item.id}/setup`}
                          style={linkButtonStyle}
                        >
                          Ouvrir setup
                        </Link>
                      )}

                      {access.canScoreAssociation && (
                        <Link
                          to={`/associations/${associationId}/scribe/classes/${item.id}`}
                          style={
                            scoringDisabled
                              ? disabledLinkButtonStyle
                              : linkButtonStyle
                          }
                          onClick={(event) => handleOpenScoring(event, item)}
                          aria-disabled={scoringDisabled}
                        >
                          Ouvrir scoring
                        </Link>
                      )}

                      {officialData.isSecretariatValidated &&
                        access.canManageAssociation && (
                        <button
                          type="button"
                          onClick={() => handleDownloadOfficialPdf(item)}
                          style={secondaryButtonStyle}
                        >
                          Télécharger PDF
                        </button>
                      )}

                      {access.canManageAssociation && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (isCompleted) return;
                              startEditClass(item);
                            }}
                            style={secondaryButtonStyle}
                            disabled={isCompleted || isSaving}
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicateClass(item)}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            Dupliquer
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteClass(item.id)}
                            style={dangerButtonStyle}
                            disabled={isSaving}
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={editGridStyle}>
                      <div>
                        <label style={labelStyle}>Nom</label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Code</label>
                        <input
                          type="text"
                          value={draft.classCode}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              classCode: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Pattern</label>
                        <select
                          value={getPatternSelectValue(draft.pattern)}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              pattern: e.target.value,
                            }))
                          }
                          style={inputStyle}
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

                      <div>
                        <label style={labelStyle}>Juge</label>
                        <input
                          type="text"
                          value={draft.judgeName}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              judgeName: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <button
                        type="button"
                        onClick={saveEdit}
                        style={primaryButtonStyle}
                        disabled={isSaving}
                      >
                        Enregistrer
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={secondaryButtonStyle}
                        disabled={isSaving}
                      >
                        Annuler
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const headerWrapStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 20,
  flexWrap: "wrap",
};

const headerActionsStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const cardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const cardTitleStyle = {
  fontWeight: 700,
  fontSize: 18,
};

const cardMetaStyle = {
  color: "#64748b",
  marginTop: 6,
};

const warmupStatsStyle = {
  color: "#475569",
  marginTop: 8,
  fontSize: 14,
};

const warmupBadgeStyle = {
  padding: "8px 12px",
  borderRadius: "999px",
  background: "#fefce8",
  border: "1px solid #fde68a",
  color: "#854d0e",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const actionRowStyle = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const editGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #ef4444",
  background: "#fff5f5",
  color: "#991b1b",
  cursor: "pointer",
};

const linkButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  textDecoration: "none",
};

const disabledLinkButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#94a3b8",
  textDecoration: "none",
  cursor: "not-allowed",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

function formatPaidWarmupDrag(warmup) {
  if (!warmup?.dragInterval) return "Aucun drag planifié";

  return `Drag après ${warmup.dragInterval} cavalier${
    warmup.dragInterval > 1 ? "s" : ""
  }`;
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

export default DayClassesPage;
