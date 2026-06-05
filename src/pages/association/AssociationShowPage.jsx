import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAssociationRepository } from "../../features/associations/associationRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import { syncDaysForShowDateRangeRepository } from "../../features/days/dayRepository";
import { compareDateValues } from "../../features/days/dayDateUtils";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { hasPublicLivestream } from "../../features/livestream/livestreamEmbed";
import {
  deleteShowRepository,
  getShowsByAssociationRepository,
  saveShowRepository,
} from "../../features/shows/showRepository";
import { createId } from "../../utils/createId";
import { appStyles as styles } from "../../styles/appStyles";

function AssociationShowPage() {
  const { associationId } = useParams();
  const { t, language } = useTranslation();

  const [association, setAssociation] = useState(null);
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [copiedOverlayShowId, setCopiedOverlayShowId] = useState(null);
  const [draft, setDraft] = useState({
    name: "",
    location: "",
    venue: "",
    startDate: "",
    endDate: "",
    status: "draft",
    isLivestreamPublic: false,
    livestreamUrl: "",
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
      name: t("management.shows.newShowName"),
      location: "",
      venue: "",
      startDate: "",
      endDate: "",
      status: "draft",
      isLivestreamPublic: false,
      livestreamUrl: "",
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
      isLivestreamPublic: newShow.isLivestreamPublic,
      livestreamUrl: newShow.livestreamUrl,
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
      isLivestreamPublic: Boolean(show.isLivestreamPublic),
      livestreamUrl: show.livestreamUrl || "",
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
      isLivestreamPublic: false,
      livestreamUrl: "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (
      draft.startDate &&
      draft.endDate &&
      compareDateValues(draft.startDate, draft.endDate) > 0
    ) {
      alert(t("management.shows.invalidDateRange"));
      return;
    }

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
      isLivestreamPublic: Boolean(draft.isLivestreamPublic),
      livestreamUrl: draft.livestreamUrl,
    };

    setIsSaving(true);
    await saveShowRepository(nextShow);
    await syncDaysForShowDateRangeRepository(nextShow, { language });
    setShows((current) =>
      current.map((show) => (show.id === editingId ? nextShow : show))
    );
    setIsSaving(false);
    setEditingId(null);
  };

  const handleDeleteShow = async (showId) => {
    const confirmed = window.confirm(t("management.shows.deleteConfirm"));
    if (!confirmed) return;

    setIsSaving(true);
    await deleteShowRepository(showId);
    setShows((current) => current.filter((show) => show.id !== showId));
    setIsSaving(false);

    if (editingId === showId) {
      cancelEdit();
    }
  };

  const copyOverlayLink = async (showId) => {
    const overlayUrl = getAbsoluteOverlayUrl(associationId, showId);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(overlayUrl);
        setCopiedOverlayShowId(showId);
        window.setTimeout(() => setCopiedOverlayShowId(null), 1800);
      } else {
        window.prompt(t("management.shows.obsOverlayPrompt"), overlayUrl);
      }
    } catch (error) {
      console.error("Erreur copie lien OBS:", error);
      window.prompt(t("management.shows.obsOverlayPrompt"), overlayUrl);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/associations">{t("management.shows.backAssociations")}</Link>
        </div>
        <div style={emptyStateStyle}>{t("management.shows.loading")}</div>
      </div>
    );
  }

  if (!association) {
    return (
      <div style={styles.app}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/associations">{t("management.shows.backAssociations")}</Link>
        </div>

        <div style={emptyStateStyle}>{t("management.shows.associationNotFound")}</div>
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
          <Link to="/associations">{t("management.shows.backAssociations")}</Link>
        </div>

        <div style={emptyStateStyle}>
          {t("management.shows.accessDenied")}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/associations">{t("management.shows.backAssociations")}</Link>
      </div>

      <div style={headerWrapStyle}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{association.name}</h1>
          <h2 style={{ fontSize: 20, margin: 0 }}>{t("common.shows")}</h2>
          <div style={{ marginTop: 10 }}>
            <span style={syncBadgeStyle(cloudStatus.configured)}>
              {t("management.sync.label")}: {getSyncLabel(cloudStatus, t)}
            </span>
            <span style={accessBadgeStyle(access.canManageAssociation)}>
              {t("management.shows.accessLabel")}:{" "}
              {access.isLoadingAccess
                ? t("management.shows.accessLoading")
                : access.roleLabel}
            </span>
          </div>
        </div>

        {access.canManageAssociation && (
          <button
            onClick={startCreateShow}
            style={primaryButtonStyle}
            disabled={isSaving}
          >
            {t("management.shows.addShow")}
          </button>
        )}
      </div>

      {shows.length === 0 ? (
        <div style={emptyStateStyle}>{t("management.shows.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {shows.map((show) => {
            const isEditing = editingId === show.id;

            return (
              <div key={show.id} style={cardStyle}>
                {!isEditing ? (
                  <>
                    <div style={cardTitleStyle}>
                      {show.name || t("management.shows.unnamedShow")}
                    </div>

                    <div style={cardMetaStyle}>
                      {(show.location || t("management.shows.locationTbd")) +
                        (show.startDate
                          ? ` • ${show.startDate}${
                              show.endDate
                                ? ` ${t("management.shows.dateRangeJoin")} ${show.endDate}`
                                : ""
                            }`
                          : "")}
                    </div>

                    <div style={cardMetaStyle}>
                      {show.venue || t("management.shows.venueFallback")} •{" "}
                      {t("management.shows.statusPrefix")}{" "}
                      {formatStatus(show.status, t)}
                    </div>

                    {hasPublicLivestream(show) && (
                      <div style={liveMetaStyle}>
                        {t("management.shows.livestreamPublicEnabled")}
                      </div>
                    )}

                    <div style={actionRowStyle}>
                      <Link
                        to={`/associations/${associationId}/shows/${show.id}`}
                        style={linkButtonStyle}
                      >
                        {t("management.shows.openShow")}
                      </Link>
                      <Link
                        to={`/public/associations/${associationId}/shows/${show.id}/overlay`}
                        style={linkButtonStyle}
                      >
                        {t("management.shows.openObsOverlay")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => copyOverlayLink(show.id)}
                        style={secondaryButtonStyle}
                      >
                        {copiedOverlayShowId === show.id
                          ? t("common.linkCopied")
                          : t("management.shows.copyObsOverlayLink")}
                      </button>

                      {access.canManageAssociation && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditShow(show)}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.shows.edit")}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteShow(show.id)}
                            style={dangerButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.shows.delete")}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={editGridStyle}>
                      <div>
                        <label style={labelStyle}>
                          {t("management.shows.nameLabel")}
                        </label>
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
                        <label style={labelStyle}>
                          {t("management.shows.locationLabel")}
                        </label>
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
                        <label style={labelStyle}>
                          {t("management.shows.venueLabel")}
                        </label>
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
                        <label style={labelStyle}>
                          {t("management.shows.startDateLabel")}
                        </label>
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
                        <label style={labelStyle}>
                          {t("management.shows.endDateLabel")}
                        </label>
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
                        <label style={labelStyle}>
                          {t("management.shows.statusLabel")}
                        </label>
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
                          <option value="draft">
                            {t("management.shows.statusDraft")}
                          </option>
                          <option value="active">
                            {t("management.shows.statusActive")}
                          </option>
                          <option value="completed">
                            {t("management.shows.statusCompleted")}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div style={livestreamBoxStyle}>
                      <label style={checkboxLabelStyle}>
                        <input
                          type="checkbox"
                          checked={draft.isLivestreamPublic}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              isLivestreamPublic: e.target.checked,
                            }))
                          }
                        />
                        <span>{t("management.shows.livestreamPublicLabel")}</span>
                      </label>

                      <label style={labelStyle}>
                        {t("management.shows.livestreamUrlLabel")}
                      </label>
                      <input
                        type="text"
                        value={draft.livestreamUrl}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            livestreamUrl: e.target.value,
                          }))
                        }
                        placeholder="https://youtube.com/watch?v=..."
                        style={inputStyle}
                      />
                      <div style={helpTextStyle}>
                        {t("management.shows.livestreamHelp")}
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <button
                        type="button"
                        onClick={saveEdit}
                        style={primaryButtonStyle}
                        disabled={isSaving}
                      >
                        {t("management.shows.save")}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={secondaryButtonStyle}
                        disabled={isSaving}
                      >
                        {t("management.shows.cancel")}
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

function formatStatus(status, t) {
  if (status === "active") return t("management.shows.statusActive");
  if (status === "completed") return t("management.shows.statusCompleted");
  return t("management.shows.statusDraft");
}

function getAbsoluteOverlayUrl(associationId, showId) {
  const path = `/public/associations/${associationId}/shows/${showId}/overlay`;
  const origin =
    typeof window === "undefined" || !window.location?.origin
      ? ""
      : window.location.origin;

  return `${origin}${path}`;
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

const liveMetaStyle = {
  display: "inline-flex",
  marginTop: 8,
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid #99e4b8",
  background: "#eafbf2",
  color: "#167a4b",
  fontWeight: 800,
  fontSize: 13,
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

const livestreamBoxStyle = {
  marginTop: 14,
  display: "grid",
  gap: 8,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  borderRadius: 8,
  padding: 12,
};

const checkboxLabelStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 800,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
};

const helpTextStyle = {
  color: "#475569",
  fontSize: 13,
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

function getSyncLabel(cloudStatus, t) {
  if (!cloudStatus.configured) return t("management.sync.local");
  if (cloudStatus.authenticated) return t("management.sync.connected");
  return t("management.sync.disconnected");
}

export default AssociationShowPage;
