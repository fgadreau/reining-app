import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getPaidWarmupRepository,
  savePaidWarmupRepository,
} from "../../features/paidWarmups/paidWarmupRepository";
import {
  PAID_WARMUP_STATUS_LABELS,
  getPaidWarmupStats,
} from "../../features/paidWarmups/paidWarmupStorage";
import { parsePaidWarmupEntries } from "../../features/paidWarmups/paidWarmupImport";
import { DRAG_INTERVAL_OPTIONS } from "../../features/classes/classTiming";
import { getDayById } from "../../features/days/daySelectors";
import { getShowById } from "../../features/shows/showSelectors";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { createId } from "../../utils/createId";
import { appStyles as styles } from "../../styles/appStyles";

function PaidWarmupSetupPage() {
  const { associationId, showId, dayId, paidWarmupId } = useParams();
  const navigate = useNavigate();
  const show = getShowById(showId);
  const day = getDayById(dayId);
  const access = useAssociationAccess(associationId);

  const [warmup, setWarmup] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const item = await getPaidWarmupRepository(paidWarmupId);
      if (!isMounted) return;
      setWarmup(item);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [paidWarmupId]);

  const stats = useMemo(
    () => getPaidWarmupStats(warmup?.entries || []),
    [warmup]
  );

  const updateWarmup = (updates) => {
    setWarmup((current) => (current ? { ...current, ...updates } : current));
  };

  const updateEntry = (entryId, updates) => {
    setWarmup((current) => {
      if (!current) return current;

      return {
        ...current,
        entries: current.entries.map((entry) =>
          entry.id === entryId ? { ...entry, ...updates } : entry
        ),
      };
    });
  };

  const addEntry = () => {
    setWarmup((current) => {
      if (!current) return current;

      return {
        ...current,
        entries: [
          ...current.entries,
          {
            id: createId("paid_warmup_entry"),
            order: current.entries.length + 1,
            rider: "",
            status: "pending",
          },
        ],
      };
    });
  };

  const removeEntry = (entryId) => {
    setWarmup((current) => {
      if (!current) return current;

      return {
        ...current,
        entries: current.entries
          .filter((entry) => entry.id !== entryId)
          .map((entry, index) => ({ ...entry, order: index + 1 })),
      };
    });
  };

  const saveWarmup = async (nextWarmup = warmup) => {
    if (!nextWarmup) return;

    setIsSaving(true);
    const saved = await savePaidWarmupRepository({
      ...nextWarmup,
      associationId,
      showId,
      dayId,
    });
    setWarmup(saved);
    setIsSaving(false);
    setMessage("Paid warm up enregistré.");
  };

  const importEntries = async () => {
    if (!warmup) return;

    const entries = parsePaidWarmupEntries(pasteText);
    if (entries.length === 0) {
      setMessage("Aucun cavalier détecté dans le copier-coller.");
      return;
    }

    if (
      warmup.entries.length > 0 &&
      !window.confirm("Remplacer la liste actuelle de cavaliers ?")
    ) {
      return;
    }

    const nextWarmup = {
      ...warmup,
      entries,
    };

    setWarmup(nextWarmup);
    await saveWarmup(nextWarmup);
    setMessage(`${entries.length} cavalier(s) importé(s) dans l’ordre fourni.`);
  };

  const shouldShowDragAfter = (index) => {
    if (!warmup?.dragInterval) return false;
    if (index >= warmup.entries.length - 1) return false;
    return (index + 1) % warmup.dragInterval === 0;
  };

  if (isLoading) {
    return (
      <div style={styles.app}>
        <div style={emptyStateStyle}>Chargement du paid warm up…</div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !access.canManageAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={{ ...emptyStateStyle, marginTop: 16 }}>
          Ce rôle n’a pas accès à la gestion des paid warm ups.
        </div>
      </div>
    );
  }

  if (!warmup) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={{ ...emptyStateStyle, marginTop: 16 }}>
          Paid warm up introuvable.
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

      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Paid warm up</div>
          <h1 style={{ margin: "4px 0" }}>{warmup.name || "Paid warm up"}</h1>
          <div style={metaStyle}>
            {show?.name || "Show"} • {day?.label || "Journée"}
            {day?.date ? ` • ${day.date}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={() => saveWarmup()}
          style={primaryButtonStyle}
          disabled={isSaving}
        >
          {isSaving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {message && <div style={noticeStyle}>{message}</div>}

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Réglages</h2>
        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>Nom</label>
            <input
              type="text"
              value={warmup.name}
              onChange={(event) => updateWarmup({ name: event.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Temps par cavalier</label>
            <input
              type="number"
              min="1"
              value={warmup.durationMinutesPerRider}
              onChange={(event) =>
                updateWarmup({
                  durationMinutesPerRider: event.target.value,
                })
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Drag de surface</label>
            <select
              value={warmup.dragInterval || ""}
              onChange={(event) =>
                updateWarmup({
                  dragInterval: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              style={inputStyle}
            >
              <option value="">Aucun drag planifié</option>
              {DRAG_INTERVAL_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  Après chaque {value} cavalier{value > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Durée d’un drag</label>
            <input
              type="number"
              min="0"
              value={warmup.dragDurationMinutes}
              onChange={(event) =>
                updateWarmup({
                  dragDurationMinutes: event.target.value,
                })
              }
              style={inputStyle}
            />
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={Boolean(warmup.isPublicLive)}
              onChange={(event) =>
                updateWarmup({ isPublicLive: event.target.checked })
              }
            />
            Autoriser le live public pour ce paid warm up
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Cavaliers</h2>
            <div style={metaStyle}>
              {stats.total} total • {stats.pending} à venir • {stats.done} passés •{" "}
              {stats.noShow} no show • {stats.scratch} scratch
            </div>
          </div>

          <button type="button" onClick={addEntry} style={secondaryButtonStyle}>
            + Ajouter un cavalier
          </button>
        </div>

        <div style={importBoxStyle}>
          <label style={labelStyle}>Copier-coller Excel / Sheets</label>
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={"1\tMarie Tremblay\n2\tFélix Goudreau\n3\tAlex Martin"}
            style={textareaStyle}
          />
          <button
            type="button"
            onClick={importEntries}
            style={secondaryButtonStyle}
            disabled={isSaving}
          >
            Importer dans cet ordre
          </button>
        </div>

        {warmup.entries.length === 0 ? (
          <div style={emptyStateStyle}>
            Aucun cavalier pour l’instant. Importe une liste ou ajoute un cavalier.
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Ordre</th>
                  <th style={thStyle}>Cavalier</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {warmup.entries.map((entry, index) => (
                  <React.Fragment key={entry.id}>
                    <tr>
                      <td style={tdStyle}>{index + 1}</td>
                      <td style={tdStyle}>
                        <input
                          type="text"
                          value={entry.rider}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              rider: event.target.value,
                            })
                          }
                          style={inputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <select
                          value={entry.status}
                          onChange={(event) =>
                            updateEntry(entry.id, {
                              status: event.target.value,
                            })
                          }
                          style={inputStyle}
                        >
                          {Object.entries(PAID_WARMUP_STATUS_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          onClick={() => removeEntry(entry.id)}
                          style={dangerButtonStyle}
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>

                    {shouldShowDragAfter(index) && (
                      <tr>
                        <td colSpan="4" style={dragRowStyle}>
                          Drag de surface • {warmup.dragDurationMinutes} min
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const eyebrowStyle = {
  textTransform: "uppercase",
  letterSpacing: 0,
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
};

const metaStyle = {
  color: "#64748b",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  fontSize: 20,
  margin: 0,
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const checkboxLabelStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 700,
  color: "#334155",
};

const importBoxStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
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

const textareaStyle = {
  ...inputStyle,
  minHeight: 120,
  resize: "vertical",
  fontFamily: "inherit",
  marginBottom: 10,
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

const noticeStyle = {
  background: "#f0fdf4",
  border: "1px solid #86efac",
  color: "#166534",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: 10,
  borderBottom: "1px solid #cbd5e1",
  color: "#475569",
  fontSize: 13,
};

const tdStyle = {
  padding: 10,
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "middle",
};

const dragRowStyle = {
  padding: 12,
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 700,
  textAlign: "center",
};

export default PaidWarmupSetupPage;
