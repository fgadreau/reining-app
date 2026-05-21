import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAssociationRepository } from "../../features/associations/associationRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import {
  deleteShowRepository,
  getShowsByAssociationRepository,
  saveShowRepository,
} from "../../features/shows/showRepository";
import { createId } from "../../utils/createId";
import { appStyles as styles } from "../../styles/appStyles";

function AssociationShowPage() {
  const { associationId } = useParams();

  const [association, setAssociation] = useState(null);
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    name: "",
    location: "",
    venue: "",
    startDate: "",
    endDate: "",
    status: "draft",
  });
  const access = useAssociationAccess(associationId);

  const cloudStatus = getCloudSyncStatus(access.user);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextAssociation, nextShows] = await Promise.all([
        getAssociationRepository(associationId),
        getShowsByAssociationRepository(associationId),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShows(nextShows);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  const startCreateShow = async () => {
    const newShow = {
      id: createId("show"),
      associationId,
      name: "Nouveau show",
      location: "",
      venue: "",
      startDate: "",
      endDate: "",
      status: "draft",
    };

    setIsSaving(true);
    await saveShowRepository(newShow);
    setShows((current) => [...current, newShow]);
    setIsSaving(false);

    setEditingId(newShow.id);
    setDraft({
      name: newShow.name,
      location: newShow.location,
      venue: newShow.venue,
      startDate: newShow.startDate,
      endDate: newShow.endDate,
      status: newShow.status,
    });
  };

  const startEditShow = (show) => {
    setEditingId(show.id);
    setDraft({
      name: show.name || "",
      location: show.location || "",
      venue: show.venue || "",
      startDate: show.startDate || "",
      endDate: show.endDate || "",
      status: show.status || "draft",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({
      name: "",
      location: "",
      venue: "",
      startDate: "",
      endDate: "",
      status: "draft",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const currentShow = shows.find((show) => show.id === editingId);
    const nextShow = {
      ...currentShow,
      associationId,
      name: draft.name,
      location: draft.location,
      venue: draft.venue,
      startDate: draft.startDate,
      endDate: draft.endDate,
      status: draft.status,
    };

    setIsSaving(true);
    await saveShowRepository(nextShow);
    setShows((current) =>
      current.map((show) => (show.id === editingId ? nextShow : show))
    );
    setIsSaving(false);
    setEditingId(null);
  };

  const handleDeleteShow = async (showId) => {
    const confirmed = window.confirm("Supprimer ce show ?");
    if (!confirmed) return;

    setIsSaving(true);
    await deleteShowRepository(showId);
    setShows((current) => current.filter((show) => show.id !== showId));
    setIsSaving(false);

    if (editingId === showId) {
      cancelEdit();
    }
  };

  if (isLoading) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/associations">← Retour aux associations</Link>
        </div>
        <div style={emptyStateStyle}>Chargement des shows…</div>
      </div>
    );
  }

  if (!association) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/associations">← Retour aux associations</Link>
        </div>

        <div style={emptyStateStyle}>Association introuvable.</div>
      </div>
    );
  }

  if (
    !access.isLoadingAccess &&
    !access.canManageAssociation &&
    !access.canScoreAssociation &&
    !access.canAnnounceAssociation
  ) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/associations">← Retour aux associations</Link>
        </div>

        <div style={emptyStateStyle}>
          Ce rôle n’a pas accès à cette association.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/associations">← Retour aux associations</Link>
      </div>

      <div style={headerWrapStyle}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{association.name}</h1>
          <h2 style={{ fontSize: 20, margin: 0 }}>Shows</h2>
          <div style={{ marginTop: 10 }}>
            <span style={syncBadgeStyle(cloudStatus.configured)}>
              Sync : {getSyncLabel(cloudStatus)}
            </span>
            <span style={accessBadgeStyle(access.canManageAssociation)}>
              Accès : {access.isLoadingAccess ? "chargement…" : access.roleLabel}
            </span>
          </div>
        </div>

        {access.canManageAssociation && (
          <button
            onClick={startCreateShow}
            style={primaryButtonStyle}
            disabled={isSaving}
          >
            + Ajouter un show
          </button>
        )}
      </div>

      {shows.length === 0 ? (
        <div style={emptyStateStyle}>Aucun show pour cette association.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {shows.map((show) => {
            const isEditing = editingId === show.id;

            return (
              <div key={show.id} style={cardStyle}>
                {!isEditing ? (
                  <>
                    <div style={cardTitleStyle}>{show.name || "Show sans nom"}</div>

                    <div style={cardMetaStyle}>
                      {(show.location || "Lieu non défini") +
                        (show.startDate
                          ? ` • ${show.startDate}${
                              show.endDate ? ` au ${show.endDate}` : ""
                            }`
                          : "")}
                    </div>

                    <div style={cardMetaStyle}>
                      {show.venue || "Venue —"} • Statut {formatStatus(show.status)}
                    </div>

                    <div style={actionRowStyle}>
                      <Link
                        to={`/associations/${associationId}/shows/${show.id}`}
                        style={linkButtonStyle}
                      >
                        Ouvrir le show
                      </Link>

                      {access.canManageAssociation && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditShow(show)}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteShow(show.id)}
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
                            setDraft((prev) => ({ ...prev, name: e.target.value }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Lieu</label>
                        <input
                          type="text"
                          value={draft.location}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              location: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Venue</label>
                        <input
                          type="text"
                          value={draft.venue}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, venue: e.target.value }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Date début</label>
                        <input
                          type="date"
                          value={draft.startDate}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              startDate: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Date fin</label>
                        <input
                          type="date"
                          value={draft.endDate}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              endDate: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Statut</label>
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                          style={inputStyle}
                        >
                          <option value="draft">Draft</option>
                          <option value="active">Actif</option>
                          <option value="completed">Terminé</option>
                        </select>
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

function formatStatus(status) {
  if (status === "active") return "Actif";
  if (status === "completed") return "Terminé";
  return "Draft";
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
  if (!cloudStatus.configured) return "Local";
  if (cloudStatus.authenticated) return "Supabase connecté";
  return "Supabase non connecté";
}

export default AssociationShowPage;
