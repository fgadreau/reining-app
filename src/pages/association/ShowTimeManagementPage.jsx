import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  buildPatternTimingStats,
  calculateClassTimeSimulation,
} from "../../features/classes/classTimeAnalytics";
import {
  SHOW_SCHEDULE_ITEM_TYPES,
  buildShowScheduleSections,
} from "../../features/schedule/showSchedule";
import {
  getClassFullDataRepository,
  getClassesForDayRepository,
  getGlobalPatternTimingStatsRepository,
} from "../../features/classes/classRepository";
import { getUniqueScoringClasses } from "../../features/classes/classScoringGroups";
import { getPaidWarmupsForDayRepository } from "../../features/paidWarmups/paidWarmupRepository";
import {
  DEFAULT_DRAG_DURATION_MINUTES,
  DRAG_INTERVAL_OPTIONS,
  formatClockTime,
  formatDuration,
} from "../../features/classes/classTiming";
import { getDaysByShowRepository } from "../../features/days/dayRepository";
import { getShowRepository } from "../../features/shows/showRepository";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

function ShowTimeManagementPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const access = useAssociationAccess(associationId);
  const [show, setShow] = useState(null);
  const [daySections, setDaySections] = useState([]);
  const [globalPatternStats, setGlobalPatternStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [simulator, setSimulator] = useState({
    pattern: "",
    participantCount: "20",
    dragInterval: "",
    dragDurationMinutes: String(DEFAULT_DRAG_DURATION_MINUTES),
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

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
          const scoringClasses = getUniqueScoringClasses(classes);
          const classRows = await Promise.all(
            scoringClasses.map((classItem) =>
              getClassFullDataRepository(classItem.id)
            )
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

  const allClassRows = useMemo(
    () => daySections.flatMap((section) => section.classRows),
    [daySections]
  );
  const patternStats = useMemo(
    () => globalPatternStats,
    [globalPatternStats]
  );
  const showPatternStats = useMemo(
    () => buildPatternTimingStats(allClassRows),
    [allClassRows]
  );
  const patternAverageByValue = useMemo(() => {
    return new Map(
      patternStats.map((stat) => [stat.pattern, stat.averageRunSeconds])
    );
  }, [patternStats]);
  const selectedPatternStats = useMemo(
    () => patternStats.find((stat) => stat.pattern === simulator.pattern) || null,
    [patternStats, simulator.pattern]
  );
  const simulation = useMemo(
    () =>
      calculateClassTimeSimulation({
        participantCount: simulator.participantCount,
        averageRunSeconds: selectedPatternStats?.averageRunSeconds,
        dragInterval: simulator.dragInterval,
        dragDurationMinutes: simulator.dragDurationMinutes,
      }),
    [
      simulator.participantCount,
      simulator.dragInterval,
      simulator.dragDurationMinutes,
      selectedPatternStats?.averageRunSeconds,
    ]
  );
  const dayTimingSections = useMemo(() => {
    return buildShowScheduleSections({
      daySections,
      now,
      patternAverageByValue,
    });
  }, [daySections, now, patternAverageByValue]);
  const classTimingRows = useMemo(
    () => dayTimingSections.flatMap((section) => section.rows),
    [dayTimingSections]
  );
  const remainingRuns = classTimingRows.reduce(
    (total, row) => total + Math.max(row.remainingRuns || 0, 0),
    0
  );

  useEffect(() => {
    if (simulator.pattern || patternStats.length === 0) return;

    const firstMeasuredPattern =
      patternStats.find((stat) => stat.averageRunSeconds != null) ||
      patternStats[0];
    setSimulator((current) => ({
      ...current,
      pattern: firstMeasuredPattern.pattern,
    }));
  }, [patternStats, simulator.pattern]);

  if (!access.isLoadingAccess && !access.canManageAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>{t("management.time.accessDenied")}</div>
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
          <div style={eyebrowStyle}>{t("nav.dayTiming")}</div>
          <h1 style={titleStyle}>{show?.name || t("common.show")}</h1>
          <div style={subtitleStyle}>
            {t("management.time.subtitle")}
          </div>
        </div>
        <Link
          to={`/associations/${associationId}/shows/${showId}/secretariat`}
          style={linkButtonStyle}
        >
          {t("nav.secretariat")}
        </Link>
      </section>

      <section style={summaryGridStyle}>
        <SummaryTile
          label={t("management.days.title")}
          value={dayTimingSections.length}
        />
        <SummaryTile
          label={t("management.secretariat.classes")}
          value={classTimingRows.length}
        />
        <SummaryTile
          label={t("management.time.remainingRuns")}
          value={remainingRuns}
          tone="warn"
        />
        <SummaryTile
          label={t("management.time.measuredPatterns")}
          value={patternStats.length}
          tone="info"
        />
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("management.time.loading")}</div>
      ) : (
        <>
          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>{t("management.time.byPattern")}</h2>
                <div style={metaStyle}>
                  {t("management.time.globalAveragesHelp")}
                </div>
              </div>
            </div>

            {patternStats.length === 0 ? (
              <div style={softEmptyStyle}>
                {t("management.time.noPatternData")}
              </div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t("public.results.pattern")}</th>
                      <th style={thStyle}>{t("management.time.averagePerRun")}</th>
                      <th style={thStyle}>{t("management.time.median")}</th>
                      <th style={thStyle}>{t("management.time.timedRuns")}</th>
                      <th style={thStyle}>{t("management.secretariat.classes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patternStats.map((stat) => (
                      <tr key={stat.pattern}>
                        <td style={tdStyle}>
                          <strong>{stat.pattern}</strong>
                        </td>
                        <td style={tdStyle}>
                          {formatDuration(stat.averageRunSeconds)}
                        </td>
                        <td style={tdStyle}>
                          {formatDuration(stat.medianRunSeconds)}
                        </td>
                        <td style={tdStyle}>
                          {stat.timedRunCount}/{stat.runCount}
                        </td>
                        <td style={tdStyle}>{stat.classCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>{t("management.time.simulator")}</h2>
                <div style={metaStyle}>
                  {t("management.time.simulatorHelp")}
                </div>
              </div>
            </div>

            <div style={simulatorGridStyle}>
              <label style={labelStyle}>
                <span>{t("public.results.pattern")}</span>
                <select
                  value={simulator.pattern}
                  onChange={(event) =>
                    setSimulator((current) => ({
                      ...current,
                      pattern: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">{t("management.classes.choosePattern")}</option>
                  {patternStats.map((stat) => (
                    <option key={stat.pattern} value={stat.pattern}>
                      {stat.pattern}
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span>{t("management.time.participants")}</span>
                <input
                  type="number"
                  min="1"
                  value={simulator.participantCount}
                  onChange={(event) =>
                    setSimulator((current) => ({
                      ...current,
                      participantCount: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                <span>Drag</span>
                <select
                  value={simulator.dragInterval}
                  onChange={(event) =>
                    setSimulator((current) => ({
                      ...current,
                      dragInterval: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">{t("management.classes.noDragPlanned")}</option>
                  {DRAG_INTERVAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t("management.time.afterEach", { count: option })}
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span>{t("management.time.dragDuration")}</span>
                <input
                  type="number"
                  min="0"
                  value={simulator.dragDurationMinutes}
                  onChange={(event) =>
                    setSimulator((current) => ({
                      ...current,
                      dragDurationMinutes: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={simulationResultStyle}>
              <div style={simulationMetricStyle}>
                <span style={summaryLabelStyle}>
                  {t("management.time.averagePerRun")}
                </span>
                <strong>
                  {formatDuration(selectedPatternStats?.averageRunSeconds)}
                </strong>
              </div>
              <div style={simulationMetricStyle}>
                <span style={summaryLabelStyle}>{t("management.time.drags")}</span>
                <strong>{simulation?.dragBreaks ?? "—"}</strong>
              </div>
              <div style={simulationMetricStyle}>
                <span style={summaryLabelStyle}>
                  {t("management.time.totalTime")}
                </span>
                <strong>{formatDuration(simulation?.totalSeconds)}</strong>
              </div>
            </div>

            {!selectedPatternStats?.averageRunSeconds && (
              <div style={softEmptyStyle}>
                {t("management.time.insufficientPatternData")}
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>{t("management.time.showDays")}</h2>
                <div style={metaStyle}>
                  {t("management.time.showDaysHelp")}
                </div>
              </div>
            </div>

            {dayTimingSections.length === 0 ? (
              <div style={softEmptyStyle}>
                {t("management.time.noClassForShow")}
              </div>
            ) : (
              <div style={dayListStyle}>
                {dayTimingSections.map((section) => (
                  <section key={section.day.id} style={dayBlockStyle}>
                    <div style={dayHeaderStyle}>
                      <div>
                        <h3 style={dayTitleStyle}>
                          {section.day.label || t("management.days.dayFallback")}
                        </h3>
                        <div style={metaStyle}>
                          {section.day.date || t("public.results.dateTbd")}
                        </div>
                      </div>
                      <div style={daySummaryStyle}>
                        <span>
                          {t("management.time.remainingRunsCount", {
                            count: section.summary.remainingRuns,
                          })}
                        </span>
                        <strong>
                          {t("management.time.estimatedEnd", {
                            time: formatClockTime(section.summary.estimatedEndAt),
                          })}
                        </strong>
                      </div>
                    </div>

                    {section.rows.length === 0 ? (
                      <div style={softEmptyStyle}>
                        {t("management.secretariat.noClassesForDay")}
                      </div>
                    ) : (
                      <div style={tableWrapStyle}>
                        <table style={tableStyle}>
                          <thead>
                            <tr>
                              <th style={thStyle}>{t("management.time.scheduleStart")}</th>
                              <th style={thStyle}>{t("management.secretariat.class")}</th>
                              <th style={thStyle}>{t("public.results.pattern")}</th>
                              <th style={thStyle}>{t("management.time.progress")}</th>
                              <th style={thStyle}>{t("management.time.averagePerRun")}</th>
                              <th style={thStyle}>{t("management.time.remainingDrags")}</th>
                              <th style={thStyle}>{t("management.time.remainingTime")}</th>
                              <th style={thStyle}>{t("management.time.estimatedEndHeader")}</th>
                              <th style={thStyle}>{t("management.classSetup.actions")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.rows.map((row) => (
                              <tr key={row.classId}>
                                <td style={tdStyle}>
                                  <div style={classNameStyle}>
                                    {formatClockTime(row.estimatedStartAt)}
                                  </div>
                                  <div style={metaStyle}>
                                    {getScheduleStartLabel(row, t)}
                                  </div>
                                  {row.isDelayedFromFixedStart && (
                                    <div style={warningMetaStyle}>
                                      {t("management.time.delayedFromFixed", {
                                        time: formatClockTime(row.plannedStartAt),
                                      })}
                                    </div>
                                  )}
                                </td>
                                <td style={tdStyle}>
                                  <div style={classNameStyle}>{row.className}</div>
                                </td>
                                <td style={tdStyle}>{row.pattern}</td>
                                <td style={tdStyle}>
                                  {row.completedRuns}/{row.runCount}
                                </td>
                                <td style={tdStyle}>
                                  {formatDuration(row.averageRunSeconds)}
                                  {row.usedPatternAverage && (
                                    <div style={metaStyle}>
                                      {t("management.time.usedPatternAverage")}
                                    </div>
                                  )}
                                </td>
                                <td style={tdStyle}>{row.remainingDragBreaks}</td>
                                <td style={tdStyle}>
                                  {formatDuration(row.remainingSeconds)}
                                </td>
                                <td style={tdStyle}>
                                  {formatClockTime(row.estimatedEndAt)}
                                </td>
                                <td style={tdStyle}>
                                  <div style={actionRowStyle}>
                                    <Link
                                      to={
                                        row.itemType ===
                                        SHOW_SCHEDULE_ITEM_TYPES.PAID_WARMUP
                                          ? `/associations/${associationId}/shows/${showId}/days/${section.day.id}/paid-warmups/${row.classId}/setup`
                                          : `/associations/${associationId}/classes/${row.classId}/setup`
                                      }
                                      style={smallLinkButtonStyle}
                                    >
                                      {t("management.secretariat.setup")}
                                    </Link>
                                    {row.itemType !==
                                      SHOW_SCHEDULE_ITEM_TYPES.PAID_WARMUP && (
                                      <Link
                                        to={`/associations/${associationId}/scribe/classes/${row.classId}`}
                                        style={smallLinkButtonStyle}
                                      >
                                        {t("management.secretariat.scoring")}
                                      </Link>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </section>

          {showPatternStats.length > 0 && (
            <section style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>
                    {t("management.time.patternsInShow")}
                  </h2>
                  <div style={metaStyle}>
                    {t("management.time.patternsInShowHelp")}
                  </div>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t("public.results.pattern")}</th>
                      <th style={thStyle}>{t("management.time.showAverage")}</th>
                      <th style={thStyle}>{t("management.time.timedRuns")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showPatternStats.map((stat) => (
                      <tr key={stat.pattern}>
                        <td style={tdStyle}>{stat.pattern}</td>
                        <td style={tdStyle}>
                          {formatDuration(stat.averageRunSeconds)}
                        </td>
                        <td style={tdStyle}>
                          {stat.timedRunCount}/{stat.runCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone = "default" }) {
  return (
    <div style={summaryTileStyle(tone)}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  );
}

function getScheduleStartLabel(row, t) {
  if (row.scheduleStartMode === "fixed") {
    return t("management.time.fixedStart");
  }

  if (row.scheduleStartUsesFallback) {
    return t("management.time.afterPreviousFallback");
  }

  return t("management.time.afterPrevious");
}

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const eyebrowStyle = {
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 30,
};

const subtitleStyle = {
  color: "#64748b",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryTileStyle = (tone) => ({
  background: tone === "warn" ? "#fff7ed" : tone === "success" ? "#f0fdf4" : "#fff",
  border: `1px solid ${
    tone === "warn" ? "#fdba74" : tone === "success" ? "#86efac" : "#e2e8f0"
  }`,
  borderRadius: 8,
  padding: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
});

const summaryLabelStyle = {
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const summaryValueStyle = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 800,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
};

const dayListStyle = {
  display: "grid",
  gap: 18,
};

const dayBlockStyle = {
  borderTop: "1px solid #e2e8f0",
  paddingTop: 14,
};

const dayHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
};

const dayTitleStyle = {
  margin: 0,
  fontSize: 18,
};

const daySummaryStyle = {
  display: "grid",
  gap: 4,
  justifyItems: "end",
  color: "#475569",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
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
  padding: "10px 8px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px 8px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
};

const classNameStyle = {
  fontWeight: 700,
};

const metaStyle = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 4,
};

const warningMetaStyle = {
  color: "#b45309",
  fontSize: 13,
  marginTop: 4,
};

const simulatorGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 12,
};

const labelStyle = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  background: "#fff",
};

const simulationResultStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
  marginBottom: 12,
};

const simulationMetricStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#f8fafc",
  display: "grid",
  gap: 4,
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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

const smallLinkButtonStyle = {
  ...linkButtonStyle,
  padding: "7px 10px",
  fontSize: 13,
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  color: "#64748b",
  marginTop: 16,
};

const softEmptyStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 14,
  color: "#64748b",
};

export default ShowTimeManagementPage;
