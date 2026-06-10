import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  getClassFullDataRepository,
  getClassesForDayRepository,
  getGlobalPatternTimingStatsRepository,
} from "../../features/classes/classRepository";
import {
  formatClockTime,
  formatDuration,
} from "../../features/classes/classTiming";
import { getDaysByShowRepository } from "../../features/days/dayRepository";
import { getPaidWarmupsForDayRepository } from "../../features/paidWarmups/paidWarmupRepository";
import {
  SHOW_SCHEDULE_ITEM_TYPES,
  buildShowSchedulePreviewSections,
  countScheduleItems,
} from "../../features/schedule/showSchedule";
import { getShowRepository } from "../../features/shows/showRepository";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

function ShowSchedulePreviewPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const access = useAssociationAccess(associationId);
  const [show, setShow] = useState(null);
  const [daySections, setDaySections] = useState([]);
  const [globalPatternStats, setGlobalPatternStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [nextShow, days, nextGlobalPatternStats] = await Promise.all([
        getShowRepository(showId),
        getDaysByShowRepository(showId),
        getGlobalPatternTimingStatsRepository(),
      ]);
      const nextSections = await Promise.all(
        days.map(async (day) => {
          const [classes, paidWarmups] = await Promise.all([
            getClassesForDayRepository(day.id),
            getPaidWarmupsForDayRepository(day.id),
          ]);
          const classRows = await Promise.all(
            classes.map((classItem) => getClassFullDataRepository(classItem.id))
          );

          return {
            day,
            classRows,
            paidWarmups,
          };
        })
      );

      if (!isMounted) return;
      setShow(nextShow);
      setDaySections(nextSections);
      setGlobalPatternStats(nextGlobalPatternStats);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [showId]);

  const patternAverageByValue = useMemo(() => {
    return new Map(
      globalPatternStats.map((stat) => [stat.pattern, stat.averageRunSeconds])
    );
  }, [globalPatternStats]);
  const scheduleSections = useMemo(
    () =>
      buildShowSchedulePreviewSections({
        daySections,
        patternAverageByValue,
      }),
    [daySections, patternAverageByValue]
  );
  const itemCount = countScheduleItems(scheduleSections);

  if (!access.isLoadingAccess && !access.canManageAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>
          {t("management.schedulePreview.accessDenied")}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{t("management.schedulePreview.eyebrow")}</div>
          <h1 style={titleStyle}>{show?.name || t("common.show")}</h1>
          <div style={subtitleStyle}>
            {t("management.schedulePreview.subtitle")}
          </div>
          <div style={statusRowStyle}>
            <span style={statusBadgeStyle(show?.isSchedulePublic)}>
              {show?.isSchedulePublic
                ? t("management.schedulePreview.publicEnabled")
                : t("management.schedulePreview.draftOnly")}
            </span>
            <span style={countBadgeStyle}>
              {t("management.schedulePreview.itemCount", { count: itemCount })}
            </span>
          </div>
        </div>
        <div style={heroActionsStyle}>
          <Link
            to={`/associations/${associationId}/shows/${showId}/time`}
            style={linkButtonStyle}
          >
            {t("management.secretariat.timeManagement")}
          </Link>
          <Link
            to={`/associations/${associationId}/shows/${showId}/public`}
            style={linkButtonStyle}
          >
            {t("common.public")}
          </Link>
        </div>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("management.schedulePreview.loading")}</div>
      ) : itemCount === 0 ? (
        <div style={emptyStateStyle}>{t("management.schedulePreview.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {scheduleSections.map((section) => (
            <section key={section.day.id || section.day.date} style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>
                    {section.day.label || t("public.results.day")}
                  </h2>
                  <div style={mutedTextStyle}>
                    {section.day.date || t("public.results.dateTbd")}
                  </div>
                </div>
                <div style={daySummaryStyle}>
                  {t("management.schedulePreview.dayEnd")}{" "}
                  <strong>{formatPreviewClock(section.summary?.estimatedEndAt, t)}</strong>
                </div>
              </div>

              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t("management.schedulePreview.order")}</th>
                      <th style={thStyle}>
                        {t("management.schedulePreview.plannedStart")}
                      </th>
                      <th style={thStyle}>
                        {t("management.schedulePreview.estimatedStart")}
                      </th>
                      <th style={thStyle}>{t("management.schedulePreview.type")}</th>
                      <th style={thStyle}>{t("management.schedulePreview.item")}</th>
                      <th style={thStyle}>{t("public.results.pattern")}</th>
                      <th style={thStyle}>{t("management.schedulePreview.draw")}</th>
                      <th style={thStyle}>
                        {t("management.schedulePreview.estimatedDuration")}
                      </th>
                      <th style={thStyle}>
                        {t("management.time.estimatedEndHeader")}
                      </th>
                      <th style={thStyle}>
                        {t("management.schedulePreview.estimateSource")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, index) => (
                      <tr key={`${row.itemType || "class"}-${row.itemId || row.classId}`}>
                        <td style={tdStyle}>{index + 1}</td>
                        <td style={tdStyle}>{getPlannedStartLabel(row, t)}</td>
                        <td style={tdStyle}>
                          <strong>{formatPreviewClock(row.estimatedStartAt, t)}</strong>
                        </td>
                        <td style={tdStyle}>{getItemTypeLabel(row, t)}</td>
                        <td style={tdStyle}>{row.className}</td>
                        <td style={tdStyle}>{row.pattern || "—"}</td>
                        <td style={tdStyle}>{getDrawLabel(row, t)}</td>
                        <td style={tdStyle}>
                          {formatDuration(row.estimatedDurationSeconds)}
                        </td>
                        <td style={tdStyle}>
                          {formatPreviewClock(row.estimatedEndAt, t)}
                        </td>
                        <td style={tdStyle}>
                          <span style={sourceBadgeStyle}>
                            {getEstimateSourceLabel(row, t)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPreviewClock(value, t) {
  const formatted = formatClockTime(value);
  return formatted === "—" ? t("management.schedulePreview.toConfirm") : formatted;
}

function getPlannedStartLabel(row, t) {
  if (row.scheduleStartMode === "fixed") {
    return row.plannedStartAt
      ? formatClockTime(row.plannedStartAt)
      : t("management.classes.startFixedMissing");
  }

  return t("management.time.afterPrevious");
}

function getItemTypeLabel(row, t) {
  return row.itemType === SHOW_SCHEDULE_ITEM_TYPES.PAID_WARMUP
    ? t("public.results.paidWarmup")
    : t("common.class");
}

function getDrawLabel(row, t) {
  if (row.itemType === SHOW_SCHEDULE_ITEM_TYPES.PAID_WARMUP) {
    return t("management.schedulePreview.riderCount", {
      count: row.runCount || 0,
    });
  }

  return row.runCount > 0
    ? t("management.schedulePreview.drawCount", { count: row.runCount })
    : t("management.schedulePreview.drawPending");
}

function getEstimateSourceLabel(row, t) {
  if (row.isEstimateBlockedByMissingAnchor) {
    return t("management.schedulePreview.needsFixedStart");
  }

  if (row.isEstimateBlockedByMissingDuration) {
    return t("management.schedulePreview.needsDuration");
  }

  if (row.itemType === SHOW_SCHEDULE_ITEM_TYPES.PAID_WARMUP) {
    return t("management.schedulePreview.warmupDuration");
  }

  if (row.usedPatternAverage) {
    return t("management.schedulePreview.patternAverage");
  }

  if (row.averageRunSeconds != null) {
    return t("management.schedulePreview.measuredAverage");
  }

  return t("management.schedulePreview.needsDuration");
}

const heroStyle = {
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const eyebrowStyle = {
  color: "#2563eb",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 32,
};

const subtitleStyle = {
  color: "#475569",
  maxWidth: 720,
};

const statusRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const statusBadgeStyle = (isPublic) => ({
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "6px 10px",
  border: isPublic ? "1px solid #86efac" : "1px solid #fde68a",
  background: isPublic ? "#f0fdf4" : "#fffbeb",
  color: isPublic ? "#166534" : "#92400e",
  fontWeight: 800,
  fontSize: 13,
});

const countBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "6px 10px",
  border: "1px solid #cbd5e1",
  color: "#334155",
  fontWeight: 800,
  fontSize: 13,
};

const heroActionsStyle = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 16,
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const mutedTextStyle = {
  color: "#64748b",
};

const daySummaryStyle = {
  color: "#475569",
  fontWeight: 800,
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
  padding: "10px 8px",
  fontSize: 12,
  textTransform: "uppercase",
};

const tdStyle = {
  borderBottom: "1px solid #f1f5f9",
  padding: "10px 8px",
  verticalAlign: "top",
};

const sourceBadgeStyle = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "4px 8px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontWeight: 750,
  fontSize: 12,
};

const linkButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 8,
  border: "1px solid #bfdbfe",
  textDecoration: "none",
  fontWeight: 800,
};

const secondaryButtonStyle = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyStateStyle = {
  background: "#fff",
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 18,
  color: "#64748b",
  textAlign: "center",
};

export default ShowSchedulePreviewPage;
