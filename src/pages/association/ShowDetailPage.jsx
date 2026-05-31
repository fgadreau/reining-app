import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getClassesForDayRepository,
  saveClassItemRepository,
} from "../../features/classes/classRepository";
import {
  dayHasScheduleItemsRepository,
  deleteDayRepository,
  getDaysByShowRepository,
  saveDayRepository,
  syncDaysForShowDateRangeRepository,
} from "../../features/days/dayRepository";
import {
  formatDayLabel,
  getShowDateRange,
  getSortOrderForShowDate,
  isDateInShowRange,
  sortDaysByDate,
} from "../../features/days/dayDateUtils";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getDefaultShowRouteForRoles } from "../../features/auth/showRoleRouting";
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { getPaidWarmupsForDayRepository } from "../../features/paidWarmups/paidWarmupRepository";
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import { savePublicationStateRepository } from "../../features/publication/publicationCloudRepository";
import { getShowRepository } from "../../features/shows/showRepository";
import { appStyles as styles } from "../../styles/appStyles";
import { createId } from "../../utils/createId";

function ShowDetailPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [show, setShow] = useState(null);
  const [days, setDays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ date: "" });
  const [isAddingDay, setIsAddingDay] = useState(false);
  const [newDayDate, setNewDayDate] = useState("");
  const [copyDraft, setCopyDraft] = useState({
    sourceDayId: "",
    targetDate: "",
  });
  const access = useAssociationAccess(associationId);

  const cloudStatus = getCloudSyncStatus(access.user);
  const showDateRange = useMemo(() => getShowDateRange(show), [show]);
  const sortedDays = useMemo(() => sortDaysByDate(days), [days]);
  const rangeStartDate = showDateRange[0] || "";
  const rangeEndDate = showDateRange[showDateRange.length - 1] || "";

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const nextShow = await getShowRepository(showId);
      const nextDays = nextShow
        ? await syncDaysForShowDateRangeRepository(nextShow, { language })
        : await getDaysByShowRepository(showId);

      if (!isMounted) return;
      setShow(nextShow);
      setDays(nextDays);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [language, showId]);

  useEffect(() => {
    if (access.isLoadingAccess) return;

    const targetPath = getDefaultShowRouteForRoles({
      associationId,
      showId,
      roles: access.associationRoles,
    });
    const currentPath = `/associations/${associationId}/shows/${showId}`;

    if (targetPath !== currentPath) {
      navigate(targetPath, { replace: true });
    }
  }, [
    access.associationRoles,
    access.isLoadingAccess,
    associationId,
    navigate,
    showId,
  ]);

  const buildDayForDate = (date) => {
    return {
      id: createId("day"),
      associationId,
      showId,
      date,
      label: formatDayLabel(date, language),
      sortOrder: getSortOrderForShowDate(date, show),
    };
  };

  const getFirstAvailableDate = () => {
    const existingDates = new Set(days.map((day) => day.date).filter(Boolean));
    return (
      showDateRange.find((date) => !existingDates.has(date)) ||
      showDateRange[0] ||
      ""
    );
  };

  const startCreateDay = () => {
    if (showDateRange.length === 0) {
      alert(t("management.days.noDateRange"));
      return;
    }

    setNewDayDate(getFirstAvailableDate());
    setIsAddingDay(true);
  };

  const cancelCreateDay = () => {
    setIsAddingDay(false);
    setNewDayDate("");
  };

  const saveNewDay = async () => {
    if (!isDateInShowRange(newDayDate, show)) {
      alert(t("management.days.dateOutOfRange"));
      return;
    }

    if (days.some((day) => day.date === newDayDate)) {
      alert(t("management.days.dateAlreadyExists"));
      return;
    }

    const newDay = buildDayForDate(newDayDate);
    setIsSaving(true);
    const savedDay = await saveDayRepository(newDay);
    setDays((current) => sortDaysByDate([...current, savedDay]));
    setIsSaving(false);
    cancelCreateDay();
  };

  const startEditDay = (day) => {
    setEditingId(day.id);
    setDraft({ date: day.date || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ date: "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const currentDay = days.find((day) => day.id === editingId);
    if (!currentDay) return;

    if (!isDateInShowRange(draft.date, show)) {
      alert(t("management.days.dateOutOfRange"));
      return;
    }

    if (days.some((day) => day.id !== editingId && day.date === draft.date)) {
      alert(t("management.days.dateAlreadyExists"));
      return;
    }

    const nextDay = {
      ...currentDay,
      associationId,
      showId,
      date: draft.date,
      label: formatDayLabel(draft.date, language),
      sortOrder: getSortOrderForShowDate(draft.date, show),
    };

    setIsSaving(true);
    await saveDayRepository(nextDay);
    setDays((current) =>
      sortDaysByDate(
        current.map((day) => (day.id === editingId ? nextDay : day))
      )
    );
    setIsSaving(false);

    setEditingId(null);
  };

  const handleDeleteDay = async (dayId) => {
    const hasScheduleItems = await dayHasScheduleItemsRepository(dayId);

    if (hasScheduleItems) {
      alert(t("management.days.deleteBlocked"));
      return;
    }

    const confirmed = window.confirm(t("management.days.deleteConfirm"));
    if (!confirmed) return;

    setIsSaving(true);
    await deleteDayRepository(dayId);
    setDays((current) => current.filter((day) => day.id !== dayId));
    setIsSaving(false);

    if (editingId === dayId) {
      cancelEdit();
    }
  };

  const startCopyClasses = (day) => {
    if (showDateRange.length === 0) {
      alert(t("management.days.noDateRange"));
      return;
    }

    const targetDate =
      showDateRange.find((date) => date !== day.date) || showDateRange[0] || "";

    setCopyDraft({
      sourceDayId: day.id,
      targetDate,
    });
  };

  const cancelCopyClasses = () => {
    setCopyDraft({ sourceDayId: "", targetDate: "" });
  };

  const handleCopyClassesToDate = async (sourceDay) => {
    const targetDate = copyDraft.targetDate;

    if (!isDateInShowRange(targetDate, show)) {
      alert(t("management.days.dateOutOfRange"));
      return;
    }

    if (sourceDay.date === targetDate) {
      alert(t("management.days.copySameDay"));
      return;
    }

    setIsSaving(true);

    try {
      const sourceClasses = await getClassesForDayRepository(sourceDay.id);

      if (sourceClasses.length === 0) {
        alert(t("management.days.copyNoClasses"));
        return;
      }

      let targetDay = days.find((day) => day.date === targetDate);

      if (!targetDay) {
        targetDay = await saveDayRepository(buildDayForDate(targetDate));
        setDays((current) => sortDaysByDate([...current, targetDay]));
      }

      const [targetClasses, targetWarmups] = await Promise.all([
        getClassesForDayRepository(targetDay.id),
        getPaidWarmupsForDayRepository(targetDay.id),
      ]);
      const targetSortOrder = Math.max(
        0,
        ...targetClasses.map((item) => item.sortOrder || 0),
        ...targetWarmups.map((item) => item.sortOrder || 0)
      );
      const orderedSourceClasses = [...sourceClasses].sort((a, b) => {
        const sortOrder = (a.sortOrder || 0) - (b.sortOrder || 0);
        if (sortOrder !== 0) return sortOrder;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      for (const [index, sourceClass] of orderedSourceClasses.entries()) {
        const copiedClass = {
          id: createId("class"),
          associationId,
          showId,
          dayId: targetDay.id,
          name: sourceClass.name || "",
          classCode: sourceClass.classCode || "",
          arena: sourceClass.arena || "",
          pattern: sourceClass.pattern || "",
          customPattern: sourceClass.customPattern || null,
          judgeName: sourceClass.judgeName || "",
          showName: show?.name || "",
          date: targetDay.date || "",
          dayLabel: targetDay.label || "",
          sortOrder: targetSortOrder + index + 1,
        };

        const savedClass = await saveClassItemRepository(copiedClass);
        await savePublicationStateRepository(savedClass.id, {
          status: PUBLICATION_STATUSES.LIVE_NO_SCORE,
          publishedAt: null,
          publishedBy: null,
        });
      }

      alert(
        t("management.days.copySuccess", {
          count: orderedSourceClasses.length,
        })
      );
      cancelCopyClasses();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
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
        <h1 style={{ marginTop: 0 }}>{show?.name || t("common.show")}</h1>
        <div style={{ fontWeight: 700 }}>
          {show?.venue || t("management.days.venueFallback")}
        </div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          {show?.location || ""}
          {show?.startDate ? ` • ${show.startDate}` : ""}
          {show?.endDate
            ? ` ${t("management.shows.dateRangeJoin")} ${show.endDate}`
            : ""}
        </div>
        <div style={{ color: "#64748b", marginTop: 4 }}>
          {t("management.shows.statusPrefix")}: {formatShowStatus(show?.status, t)}
        </div>
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

      <div style={headerWrapStyle}>
        <h2 style={{ fontSize: 20, margin: 0 }}>{t("management.days.title")}</h2>

        <div style={actionRowStyleNoMargin}>
          {access.canManageAssociation && (
            <button
              onClick={startCreateDay}
              style={primaryButtonStyle}
              disabled={isSaving}
            >
              {t("management.days.addDay")}
            </button>
          )}
        </div>
      </div>

      {isAddingDay && access.canManageAssociation && (
        <div style={inlineFormStyle}>
          <div style={editGridStyle}>
            <div>
              <label style={labelStyle}>{t("management.days.dateLabel")}</label>
              <input
                type="date"
                value={newDayDate}
                min={rangeStartDate || undefined}
                max={rangeEndDate || undefined}
                onChange={(event) => setNewDayDate(event.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={actionRowStyle}>
            <button
              type="button"
              onClick={saveNewDay}
              style={primaryButtonStyle}
              disabled={isSaving}
            >
              {t("management.days.save")}
            </button>

            <button
              type="button"
              onClick={cancelCreateDay}
              style={secondaryButtonStyle}
              disabled={isSaving}
            >
              {t("management.days.cancel")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={emptyStateStyle}>{t("management.days.loading")}</div>
      ) : sortedDays.length === 0 ? (
        <div style={emptyStateStyle}>{t("management.days.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sortedDays.map((day) => {
            const isEditing = editingId === day.id;
            const isCopying = copyDraft.sourceDayId === day.id;
            const isOutOfRange =
              Boolean(day.date) && !isDateInShowRange(day.date, show);

            return (
              <div key={day.id} style={cardStyle}>
                {!isEditing ? (
                  <>
                    <div style={cardHeaderStyle}>
                      <div>
                        <div style={cardTitleStyle}>
                          {day.label || t("management.days.dayFallback")}
                        </div>

                        <div style={cardMetaStyle}>
                          {day.date || t("public.results.dateTbd")}
                        </div>
                      </div>

                      {isOutOfRange && (
                        <div style={warningBadgeStyle}>
                          {t("management.days.outOfRange")}
                        </div>
                      )}
                    </div>

                    <div style={actionRowStyle}>
                      {(access.canManageAssociation ||
                        access.canScoreAssociation) && (
                        <Link
                          to={`/associations/${associationId}/shows/${showId}/days/${day.id}`}
                          style={linkButtonStyle}
                        >
                          {t("management.days.openClasses")}
                        </Link>
                      )}

                      {access.canManageAssociation && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditDay(day)}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.edit")}
                          </button>

                          <button
                            type="button"
                            onClick={() => startCopyClasses(day)}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.copyClasses")}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDay(day.id)}
                            style={dangerButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.delete")}
                          </button>
                        </>
                      )}
                    </div>

                    {isCopying && (
                      <div style={copyFormStyle}>
                        <div style={editGridStyle}>
                          <div>
                            <label style={labelStyle}>
                              {t("management.days.copyTargetDateLabel")}
                            </label>
                            <input
                              type="date"
                              value={copyDraft.targetDate}
                              min={rangeStartDate || undefined}
                              max={rangeEndDate || undefined}
                              onChange={(event) =>
                                setCopyDraft((current) => ({
                                  ...current,
                                  targetDate: event.target.value,
                                }))
                              }
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        <div style={actionRowStyle}>
                          <button
                            type="button"
                            onClick={() => handleCopyClassesToDate(day)}
                            style={primaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.copyClassesSubmit")}
                          </button>

                          <button
                            type="button"
                            onClick={cancelCopyClasses}
                            style={secondaryButtonStyle}
                            disabled={isSaving}
                          >
                            {t("management.days.cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={editGridStyle}>
                      <div>
                        <label style={labelStyle}>{t("management.days.dateLabel")}</label>
                        <input
                          type="date"
                          value={draft.date}
                          min={rangeStartDate || undefined}
                          max={rangeEndDate || undefined}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, date: e.target.value }))
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
                        {t("management.days.save")}
                      </button>

                      <button
                        type="button"
                        onClick={cancelEdit}
                        style={secondaryButtonStyle}
                        disabled={isSaving}
                      >
                        {t("management.days.cancel")}
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

const actionRowStyleNoMargin = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const inlineFormStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const copyFormStyle = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px solid #e2e8f0",
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

const warningBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #fdba74",
  background: "#fff7ed",
  color: "#9a3412",
  fontWeight: 700,
  fontSize: 13,
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

function formatShowStatus(status, t) {
  if (status === "active") return t("management.shows.statusActive");
  if (status === "completed") return t("management.shows.statusCompleted");
  if (status === "draft") return t("management.shows.statusDraft");
  return "—";
}

function getSyncLabel(cloudStatus, t) {
  if (!cloudStatus.configured) return t("management.sync.local");
  if (cloudStatus.authenticated) return t("management.sync.connected");
  return t("management.sync.disconnected");
}

export default ShowDetailPage;
