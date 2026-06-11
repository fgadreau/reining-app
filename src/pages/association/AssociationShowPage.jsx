import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAssociationRepository } from "../../features/associations/associationRepository";
import { ASSOCIATION_ROLES } from "../../features/auth/accessRoles";
import { getDefaultShowRouteForRoles } from "../../features/auth/showRoleRouting";
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
  const [draft, setDraft] = useState({
    name: "",
    location: "",
    venue: "",
    startDate: "",
    endDate: "",
    status: "draft",
    isLivestreamPublic: false,
    livestreamUrl: "",
    isSchedulePublic: false,
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
      isSchedulePublic: false,
    };

    setIsSaving(true);
    try {
      await saveShowRepository(newShow);
      setShows((current) => [...current, newShow]);
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
        isSchedulePublic: newShow.isSchedulePublic,
      });
    } catch (error) {
      console.error("Erreur création show:", error);
      alert(t("common.saveFailed", { message: error?.message || "" }));
    } finally {
      setIsSaving(false);
    }
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
      isSchedulePublic: Boolean(show.isSchedulePublic),
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
      isSchedulePublic: false,
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
      isSchedulePublic: Boolean(draft.isSchedulePublic),
    };

    setIsSaving(true);
    try {
      const savedShow = await saveShowRepository(nextShow);
      await syncDaysForShowDateRangeRepository(nextShow, { language });
      setShows((current) =>
        current.map((show) => (show.id === editingId ? savedShow : show))
      );
      setEditingId(null);
    } catch (error) {
      console.error("Erreur sauvegarde show:", error);
      alert(t("common.saveFailed", { message: error?.message || "" }));
    } finally {
      setIsSaving(false);
    }
  };

  const activateShow = async (show) => {
    if (!show || show.status === "active") return;

    const confirmed = window.confirm(t("management.shows.activateShowConfirm"));
    if (!confirmed) return;

    const nextShow = {
      ...show,
      status: "active",
    };

    setIsSaving(true);
    try {
      const savedShow = await saveShowRepository(nextShow);
      await syncDaysForShowDateRangeRepository(nextShow, { language });
      setShows((current) =>
        current.map((item) => (item.id === show.id ? savedShow : item))
      );

      if (editingId === show.id) {
        setDraft((current) => ({
          ...current,
          status: "active",
        }));
      }
    } catch (error) {
      console.error("Erreur activation show:", error);
      alert(t("common.saveFailed", { message: error?.message || "" }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShow = async (showId) => {
    const confirmed = window.confirm(t("management.shows.deleteConfirm"));
    if (!confirmed) return;

    setIsSaving(true);
    try {
      await deleteShowRepository(showId);
      setShows((current) => current.filter((show) => show.id !== showId));

      if (editingId === showId) {
        cancelEdit();
      }
    } catch (error) {
      console.error("Erreur suppression show:", error);
      alert(t("common.deleteFailed", { message: error?.message || "" }));
    } finally {
      setIsSaving(false);
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
            const showEntryPath = getDefaultShowRouteForRoles({
              associationId,
              showId: show.id,
              roles: access.associationRoles,
            });
            const showEntryLabel = getShowEntryLabel(access.associationRoles, t);

            return (
              <div key={show.id} style={cardStyle}>
                {!isEditing ? (
                  <>
                    <div style={showCardHeaderStyle}>
                      <div style={cardTitleStyle}>
                        {show.name || t("management.shows.unnamedShow")}
                      </div>
                      <span style={statusBadgeStyle(show.status)}>
                        {formatStatus(show.status, t)}
                      </span>
                    </div>

                    <div style={showMetaGridStyle}>
                      <span>
                        {show.location || t("management.shows.locationTbd")}
                      </span>
                      <span>
                        {show.startDate
                          ? `${show.startDate}${
                              show.endDate
                                ? ` ${t("management.shows.dateRangeJoin")} ${show.endDate}`
                                : ""
                            }`
                          : t("management.shows.dateTbd")}
                      </span>
                      <span>
                        {show.venue || t("management.shows.venueFallback")}
                      </span>
                    </div>

                    {(hasPublicLivestream(show) || show.isSchedulePublic) && (
                      <div style={publicFlagRowStyle}>
                        {hasPublicLivestream(show) && (
                          <span style={liveMetaStyle}>
                            {t("management.shows.livestreamPublicEnabled")}
                          </span>
                        )}

                        {show.isSchedulePublic && (
                          <span style={liveMetaStyle}>
                            {t("management.shows.schedulePublicEnabled")}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={cardDividerStyle} />

                    <div style={actionRowStyle}>
                      <Link
                        to={showEntryPath}
                        style={linkButtonStyle}
                      >
                        {showEntryLabel}
                      </Link>

                      {access.canManageAssociation && (
                        <>
                          {show.status === "draft" && (
                            <button
                              type="button"
                              onClick={() => activateShow(show)}
                              style={activateButtonStyle}
                              disabled={isSaving}
                            >
                              {t("management.shows.activateShow")}
                            </button>
                          )}

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

function getShowEntryLabel(roles, t) {
  const uniqueRoles = Array.from(new Set(Array.isArray(roles) ? roles : []));

  if (uniqueRoles.length !== 1) {
    return t("management.shows.openShow");
  }

  switch (uniqueRoles[0]) {
    case ASSOCIATION_ROLES.SCRIBE:
      return t("management.shows.openScribeView");
    case ASSOCIATION_ROLES.ANNOUNCER:
      return t("management.shows.openAnnouncerView");
    case ASSOCIATION_ROLES.SECRETARY:
      return t("management.shows.openSecretariatView");
    default:
      return t("management.shows.openShow");
  }
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
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 24px rgba(15,23,42,0.07)",
};

const showCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const cardTitleStyle = {
  fontWeight: 700,
  fontSize: 18,
  color: "#0f172a",
  lineHeight: 1.25,
};

const showMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 8,
  marginTop: 12,
  color: "#475569",
  fontWeight: 650,
  fontSize: 14,
};

const liveMetaStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  border: "1px solid #99e4b8",
  background: "#eafbf2",
  color: "#167a4b",
  fontWeight: 800,
  fontSize: 13,
};

const publicFlagRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const cardDividerStyle = {
  height: 1,
  background: "#e2e8f0",
  marginTop: 16,
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
  fontWeight: 800,
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 700,
};

const activateButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #16a34a",
  background: "#ecfdf5",
  color: "#166534",
  cursor: "pointer",
  fontWeight: 800,
};

const dangerButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #ef4444",
  background: "#fff5f5",
  color: "#991b1b",
  cursor: "pointer",
  fontWeight: 700,
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
  border: "1px solid #e2e8f0",
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
  color: "#64748b",
};

const statusBadgeStyle = (status) => {
  if (status === "active") {
    return {
      ...baseStatusBadgeStyle,
      borderColor: "#86efac",
      background: "#ecfdf5",
      color: "#166534",
    };
  }

  if (status === "completed") {
    return {
      ...baseStatusBadgeStyle,
      borderColor: "#cbd5e1",
      background: "#f8fafc",
      color: "#334155",
    };
  }

  return {
    ...baseStatusBadgeStyle,
    borderColor: "#fed7aa",
    background: "#fff7ed",
    color: "#9a3412",
  };
};

const baseStatusBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  fontSize: 13,
  fontWeight: 800,
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
