import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import {
  buildClassTimingRow,
  buildPatternTimingStats,
  calculateClassTimeSimulation,
} from "../../features/classes/classTimeAnalytics";
import {
  getAccessibleClassTimingDataRepository,
  getClassFullDataRepository,
  getClassesForDayRepository,
} from "../../features/classes/classRepository";
import {
  DEFAULT_DRAG_DURATION_MINUTES,
  DRAG_INTERVAL_OPTIONS,
  formatClockTime,
  formatDuration,
} from "../../features/classes/classTiming";
import { getDaysByShowRepository } from "../../features/days/dayRepository";
import { getShowRepository } from "../../features/shows/showRepository";
import { appStyles as styles } from "../../styles/appStyles";

function ShowTimeManagementPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const access = useAssociationAccess(associationId);
  const [show, setShow] = useState(null);
  const [daySections, setDaySections] = useState([]);
  const [globalClassRows, setGlobalClassRows] = useState([]);
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
      const [nextShow, days, nextGlobalClassRows] = await Promise.all([
        getShowRepository(showId),
        getDaysByShowRepository(showId),
        getAccessibleClassTimingDataRepository(),
      ]);
      const nextSections = await Promise.all(
        days.map(async (day) => {
          const classes = await getClassesForDayRepository(day.id);
          const classRows = await Promise.all(
            classes.map((classItem) => getClassFullDataRepository(classItem.id))
          );

          return {
            day,
            classRows,
          };
        })
      );

      if (!isMounted) return;
      setShow(nextShow);
      setDaySections(nextSections);
      setGlobalClassRows(nextGlobalClassRows);
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
    () => buildPatternTimingStats(globalClassRows),
    [globalClassRows]
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
  const classTimingRows = useMemo(() => {
    return daySections.flatMap(({ day, classRows }) =>
      classRows.map((classData) =>
        buildClassTimingRow({
          classData,
          day,
          now,
          patternAverageRunSeconds:
            patternAverageByValue.get(
              String(
                classData?.setup?.pattern || classData?.classItem?.pattern || "—"
              ).trim() || "—"
            ) || null,
        })
      )
    );
  }, [daySections, now, patternAverageByValue]);
  const totalSummary = useMemo(
    () => buildShowTimeSummary(classTimingRows, now),
    [classTimingRows, now]
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
          ← Retour
        </button>
        <div style={emptyStateStyle}>
          Ce rôle n’a pas accès à la gestion du temps.
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

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Gestion du temps</div>
          <h1 style={titleStyle}>{show?.name || "Show"}</h1>
          <div style={subtitleStyle}>
            Moyennes par pattern, drags et projections de fin de classes.
          </div>
        </div>
        <Link
          to={`/associations/${associationId}/shows/${showId}/secretariat`}
          style={linkButtonStyle}
        >
          Secrétariat
        </Link>
      </section>

      <section style={summaryGridStyle}>
        <SummaryTile label="Classes" value={classTimingRows.length} />
        <SummaryTile
          label="Runs restants"
          value={totalSummary.remainingRuns}
          tone="warn"
        />
        <SummaryTile
          label="Temps restant"
          value={formatDuration(totalSummary.remainingSeconds)}
          tone="info"
        />
        <SummaryTile
          label="Fin estimée show"
          value={formatClockTime(totalSummary.estimatedEndAt)}
          tone="success"
        />
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement de la gestion du temps…</div>
      ) : (
        <>
          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Par pattern</h2>
                <div style={metaStyle}>
                  Moyennes globales basées sur toutes les classes accessibles à
                  ton compte.
                </div>
              </div>
            </div>

            {patternStats.length === 0 ? (
              <div style={softEmptyStyle}>Aucune donnée de pattern disponible.</div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Pattern</th>
                      <th style={thStyle}>Moyenne/run</th>
                      <th style={thStyle}>Médiane</th>
                      <th style={thStyle}>Runs mesurés</th>
                      <th style={thStyle}>Classes</th>
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
                <h2 style={sectionTitleStyle}>Simulateur</h2>
                <div style={metaStyle}>
                  Estime une classe avec la moyenne globale du pattern choisi.
                </div>
              </div>
            </div>

            <div style={simulatorGridStyle}>
              <label style={labelStyle}>
                <span>Pattern</span>
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
                  <option value="">Choisir un pattern</option>
                  {patternStats.map((stat) => (
                    <option key={stat.pattern} value={stat.pattern}>
                      {stat.pattern}
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span>Participants</span>
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
                  <option value="">Aucun drag</option>
                  {DRAG_INTERVAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      Après chaque {option}
                    </option>
                  ))}
                </select>
              </label>

              <label style={labelStyle}>
                <span>Durée drag</span>
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
                <span style={summaryLabelStyle}>Moyenne/run</span>
                <strong>
                  {formatDuration(selectedPatternStats?.averageRunSeconds)}
                </strong>
              </div>
              <div style={simulationMetricStyle}>
                <span style={summaryLabelStyle}>Drags</span>
                <strong>{simulation?.dragBreaks ?? "—"}</strong>
              </div>
              <div style={simulationMetricStyle}>
                <span style={summaryLabelStyle}>Temps total</span>
                <strong>{formatDuration(simulation?.totalSeconds)}</strong>
              </div>
            </div>

            {!selectedPatternStats?.averageRunSeconds && (
              <div style={softEmptyStyle}>
                Ce pattern n’a pas encore assez de runs mesurés pour simuler une
                durée fiable.
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Classes du show</h2>
                <div style={metaStyle}>
                  Les classes sans moyenne propre utilisent la moyenne du pattern
                  globale lorsque disponible.
                </div>
              </div>
            </div>

            {classTimingRows.length === 0 ? (
              <div style={softEmptyStyle}>Aucune classe pour ce show.</div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Classe</th>
                      <th style={thStyle}>Pattern</th>
                      <th style={thStyle}>Progression</th>
                      <th style={thStyle}>Moyenne/run</th>
                      <th style={thStyle}>Drags restants</th>
                      <th style={thStyle}>Temps restant</th>
                      <th style={thStyle}>Fin estimée</th>
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classTimingRows.map((row) => (
                      <tr key={row.classId}>
                        <td style={tdStyle}>
                          <div style={classNameStyle}>{row.className}</div>
                          <div style={metaStyle}>
                            {row.dayLabel}
                            {row.dayDate ? ` · ${row.dayDate}` : ""}
                          </div>
                        </td>
                        <td style={tdStyle}>{row.pattern}</td>
                        <td style={tdStyle}>
                          {row.completedRuns}/{row.runCount}
                        </td>
                        <td style={tdStyle}>
                          {formatDuration(row.averageRunSeconds)}
                          {row.usedPatternAverage && (
                            <div style={metaStyle}>moyenne pattern</div>
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
                              to={`/associations/${associationId}/classes/${row.classId}/setup`}
                              style={smallLinkButtonStyle}
                            >
                              Setup
                            </Link>
                            <Link
                              to={`/associations/${associationId}/scribe/classes/${row.classId}`}
                              style={smallLinkButtonStyle}
                            >
                              Scoring
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {showPatternStats.length > 0 && (
            <section style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>Patterns dans ce show</h2>
                  <div style={metaStyle}>
                    Lecture locale du show ouvert, utile pour comparer avec les
                    moyennes globales.
                  </div>
                </div>
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Pattern</th>
                      <th style={thStyle}>Moyenne/show</th>
                      <th style={thStyle}>Runs mesurés</th>
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

function buildShowTimeSummary(rows, now) {
  const remainingRuns = rows.reduce(
    (total, row) => total + Math.max(row.remainingRuns || 0, 0),
    0
  );
  const remainingSecondsValues = rows
    .map((row) => row.remainingSeconds)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const remainingSeconds = remainingSecondsValues.length
    ? remainingSecondsValues.reduce((total, value) => total + value, 0)
    : null;
  const estimatedEndAt =
    remainingSeconds == null
      ? null
      : new Date(now.getTime() + remainingSeconds * 1000).toISOString();

  return {
    remainingRuns,
    remainingSeconds,
    estimatedEndAt,
  };
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
