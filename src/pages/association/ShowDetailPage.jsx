import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteDayRepository,
  getDaysByShowRepository,
  saveDayRepository,
} from "../../features/days/dayRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import { getShowRepository } from "../../features/shows/showRepository";
import { appStyles as styles } from "../../styles/appStyles";
import { createId } from "../../utils/createId";

function ShowDetailPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();

  const [show, setShow] = useState(null);
  const [days, setDays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    label: "",
    date: "",
    sortOrder: 1,
  });
  const access = useAssociationAccess(associationId);

  const cloudStatus = getCloudSyncStatus(access.user);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextShow, nextDays] = await Promise.all([
        getShowRepository(showId),
        getDaysByShowRepository(showId),
      ]);

      if (!isMounted) return;
      setShow(nextShow);
      setDays(nextDays);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [showId]);

  const startCreateDay = async () => {
    const nextSortOrder =
      days.length > 0
        ? Math.max(...days.map((d) => d.sortOrder || 0)) + 1
        : 1;

    const newDay = {
      id: createId("day"),
      associationId,
      showId,
      date: "",
      label: `Jour ${nextSortOrder}`,
      sortOrder: nextSortOrder,
    };

    setIsSaving(true);
    await saveDayRepository(newDay);
    setDays((current) => [...current, newDay]);
    setIsSaving(false);

    setEditingId(newDay.id);
    setDraft({
      label: newDay.label,
      date: newDay.date,
      sortOrder: newDay.sortOrder,
    });
  };

  const startEditDay = (day) => {
    setEditingId(day.id);
    setDraft({
      label: day.label || "",
      date: day.date || "",
      sortOrder: day.sortOrder || 1,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({
      label: "",
      date: "",
      sortOrder: 1,
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const currentDay = days.find((day) => day.id === editingId);
    const nextDay = {
      ...currentDay,
      associationId,
      showId,
      label: draft.label,
      date: draft.date,
      sortOrder: Number(draft.sortOrder) || 1,
    };

    setIsSaving(true);
    await saveDayRepository(nextDay);
    setDays((current) =>
      current.map((day) => (day.id === editingId ? nextDay : day))
    );
    setIsSaving(false);

    setEditingId(null);
  };

  const handleDeleteDay = async (dayId) => {
    const confirmed = window.confirm("Supprimer cette journée ?");
    if (!confirmed) return;

    setIsSaving(true);
    await deleteDayRepository(dayId);
    setDays((current) => current.filter((day) => day.id !== dayId));
    setIsSaving(false);

    if (editingId === dayId) {
      cancelEdit();
    }
  };

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: 16,
        }}
      >
        <h1 style={{ marginTop: 0 }}>{show?.name || "Show"}</h1>
        <div style={{ fontWeight: 700 }}>{show?.venue || "Lieu"}</div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          {show?.location || ""}
          {show?.startDate ? ` • ${show.startDate}` : ""}
          {show?.endDate ? ` au ${show.endDate}` : ""}
        </div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          Statut : {show?.status || "—"}
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={syncBadgeStyle(cloudStatus.configured)}>
            Sync : {getSyncLabel(cloudStatus)}
          </span>
          <span style={accessBadgeStyle(access.canManageAssociation)}>
            Accès : {access.isLoadingAccess ? "chargement…" : access.roleLabel}
          </span>
        </div>
      </div>

      <div style={headerWrapStyle}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Journées</h2>

        <div style={actionRowStyleNoMargin}>
          {access.canAdminAssociation && (
            <Link
              to={`/associations/${associationId}/access`}
              style={linkButtonStyle}
            >
              Accès
            </Link>
          )}

          {access.canManageAssociation && (
            <Link
              to={`/associations/${associationId}/shows/${showId}/secretariat`}
              style={linkButtonStyle}
            >
              Secrétariat
            </Link>
          )}

          {access.canManageAssociation && (
            <Link
              to={`/associations/${associationId}/shows/${showId}/time`}
              style={linkButtonStyle}
            >
              Gestion du temps
            </Link>
          )}

          {access.canAnnounceAssociation && (
            <Link
              to={`/associations/${associationId}/shows/${showId}/announcer`}
              style={linkButtonStyle}
            >
              Annonceur
            </Link>
          )}

          <Link
            to={`/public/associations/${associationId}/shows/${showId}`}
            style={linkButtonStyle}
          >
            Vitrine publique
          </Link>

          {access.canManageAssociation && (
            <button
              onClick={startCreateDay}
              style={primaryButtonStyle}
              disabled={isSaving}
            >
              + Ajouter une journée
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement des journées…</div>
      ) : days.length === 0 ? (
        <div style={emptyStateStyle}>Aucune journée pour ce show.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {days.map((day) => {
            const isEditing = editingId === day.id;

            return (
              <div key={day.id} style={cardStyle}>
                {!isEditing ? (
                  <>
                    <div style={cardTitleStyle}>{day.label || "Journée"}</div>

                    <div style={cardMetaStyle}>
                      {day.date || "Date non définie"} • Ordre {day.sortOrder || 1}
                    </div>

                    <div style={actionRowStyle}>
                      {(access.canManageAssociation ||
                        access.canScoreAssociation) && (
                        <Link
                          to={`/associations/${associationId}/shows/${showId}/days/${day.id}`}
                          style={linkButtonStyle}
                        >
                          Ouvrir les classes
                        </Link>
                      )}

                      {access.canManageAssociation && (
                        <>
                          <button
                            onClick={() => startEditDay(day)}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            Modifier
                          </button>

                          <button
                            onClick={() => handleDeleteDay(day.id)}
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
                        <label style={labelStyle}>Label</label>
                        <input
                          type="text"
                          value={draft.label}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, label: e.target.value }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Date</label>
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, date: e.target.value }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Ordre</label>
                        <input
                          type="number"
                          min="1"
                          value={draft.sortOrder}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              sortOrder: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <button
                        onClick={saveEdit}
                        style={primaryButtonStyle}
                        disabled={isSaving}
                      >
                        Enregistrer
                      </button>

                      <button
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
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
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

const actionRowStyleNoMargin = {
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

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
};

const syncBadgeStyle = (isCloudReady) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${isCloudReady ? "#86efac" : "#cbd5e1"}`,
  background: isCloudReady ? "#ecfdf5" : "#f8fafc",
  color: isCloudReady ? "#166534" : "#475569",
  fontWeight: 700,
  fontSize: 13,
});

const accessBadgeStyle = (hasManagementAccess) => ({
  display: "inline-flex",
  alignItems: "center",
  marginLeft: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${hasManagementAccess ? "#86efac" : "#fdba74"}`,
  background: hasManagementAccess ? "#ecfdf5" : "#fff7ed",
  color: hasManagementAccess ? "#166534" : "#9a3412",
  fontWeight: 700,
  fontSize: 13,
});

function getSyncLabel(cloudStatus) {
  if (!cloudStatus.configured) return "Local seulement";
  if (cloudStatus.authenticated) return "Supabase connecté";
  return "Connexion requise";
}

export default ShowDetailPage;
