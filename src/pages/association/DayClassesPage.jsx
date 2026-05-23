import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteClassCompletelyRepository,
  getClassesForDayRepository,
  saveClassItemRepository,
} from "../../features/classes/classRepository";
import { getClassStatus, getClassStatusLabel } from "../../features/classes/classStatusSelectors";
import { getDayById } from "../../features/days/daySelectors";
import { getShowById } from "../../features/shows/showSelectors";
import { loadAssociations } from "../../features/associations/associationsData";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  getPatternDisplayName,
  getPatternHeaders,
  getPatternSelectValue,
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
      const nextClasses = await getClassesForDayRepository(dayId);
      if (!isMounted) return;
      setClasses(nextClasses);
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
      judgeName: "",
      showName: show?.name || "",
      date: day?.date || "",
      dayLabel: day?.label || "",
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
    const nextClass = {
      ...currentClass,
      name: draft.name,
      classCode: draft.classCode,
      pattern: draft.pattern,
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
    const headers = getPatternHeaders(officialData.pattern);

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
          <button
            onClick={startCreateClass}
            style={primaryButtonStyle}
            disabled={isSaving}
          >
            + Ajouter une classe
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement des classes…</div>
      ) : classes.length === 0 ? (
        <div style={emptyStateStyle}>Aucune classe pour cette journée.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {classes.map((item) => {
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
                          Pattern {getPatternDisplayName(item.pattern) || "—"} • Juge{" "}
                          {officialData.judgeName || "—"}
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
