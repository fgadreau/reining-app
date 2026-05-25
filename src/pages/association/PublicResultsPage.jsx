import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getPublicShowRepository,
  getPublicShowView,
  getPublicShowViewRepository,
  subscribePublicShowViewRepository,
} from "../../features/publication/publicViewRepository";
import { getShowById } from "../../features/shows/showSelectors";
import { appStyles as styles } from "../../styles/appStyles";

function PublicResultsPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith("/public");
  const [show, setShow] = useState(() => getShowById(showId));
  const [publicView, setPublicView] = useState(() => getPublicShowView(showId));
  const [isLoading, setIsLoading] = useState(true);
  const publicClassIdsKey = (publicView.classIds || []).join("|");

  useEffect(() => {
    let isMounted = true;

    async function loadPublicView() {
      setIsLoading(true);
      const [nextShow, nextPublicView] = await Promise.all([
        getPublicShowRepository(showId),
        getPublicShowViewRepository(showId),
      ]);
      if (!isMounted) return;
      setShow(nextShow);
      setPublicView(nextPublicView);
      setIsLoading(false);
    }

    loadPublicView();

    return () => {
      isMounted = false;
    };
  }, [showId]);

  useEffect(() => {
    let isMounted = true;
    let refreshTimeout = null;

    const refreshPublicView = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(async () => {
        const [nextShow, nextPublicView] = await Promise.all([
          getPublicShowRepository(showId),
          getPublicShowViewRepository(showId),
        ]);

        if (!isMounted) return;
        setShow(nextShow);
        setPublicView(nextPublicView);
        setIsLoading(false);
      }, 200);
    };

    const unsubscribe = subscribePublicShowViewRepository(
      showId,
      publicClassIdsKey ? publicClassIdsKey.split("|") : [],
      refreshPublicView
    );

    return () => {
      isMounted = false;
      window.clearTimeout(refreshTimeout);
      unsubscribe();
    };
  }, [showId, publicClassIdsKey]);

  if (!show && !isLoading) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={emptyStateStyle}>Show introuvable.</div>
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
          <div style={eyebrowStyle}>Résultats publics</div>
          <h1 style={titleStyle}>{show.name || "Show"}</h1>
          <div style={subtitleStyle}>
            {show.venue || show.location || "Lieu à confirmer"}
          </div>
        </div>
        {isPublicRoute ? (
          <Link to={`/public/associations/${associationId}`} style={linkButtonStyle}>
            Shows
          </Link>
        ) : (
          <Link
            to={`/associations/${associationId}/shows/${showId}`}
            style={linkButtonStyle}
          >
            Show
          </Link>
        )}
      </section>

      {publicView.liveClass && <PublicLivePanel classView={publicView.liveClass} />}

      <section style={summaryStyle}>
        <div style={summaryValueStyle}>{publicView.publishedClassCount}</div>
        <div style={summaryLabelStyle}>classe(s) publiée(s)</div>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement des résultats publics…</div>
      ) : publicView.sections.length === 0 ? (
        <div style={emptyStateStyle}>
          Aucun résultat officiel publié pour l’instant. Le live public apparaît
          ici seulement si une classe du show est autorisée dans le setup.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {publicView.sections.map((section) => (
            <section key={section.day.id} style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>{section.day.label || "Journée"}</h2>
                  <div style={mutedTextStyle}>
                    {section.day.date || "Date non définie"}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {section.classes.map((classView) => (
                  <PublicClassResults
                    key={classView.classId}
                    classView={classView}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicClassResults({ classView }) {
  return (
    <section style={classCardStyle}>
      <div style={classHeaderStyle}>
        <div>
          <h3 style={classTitleStyle}>
            {classView.className}
            {classView.classCode ? ` (${classView.classCode})` : ""}
          </h3>
          <div style={mutedTextStyle}>
            Pattern {classView.pattern || "—"}
            {classView.judgeName ? ` · Juge ${classView.judgeName}` : ""}
          </div>
        </div>
        <Badge>Officiel</Badge>
      </div>

      {classView.runs.length === 0 ? (
        <div style={softEmptyStyle}>Aucun run publié pour cette classe.</div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Rang</th>
                <th style={thStyle}>Draw</th>
                <th style={thStyle}>Back #</th>
                <th style={thStyle}>Rider</th>
                <th style={thStyle}>Horse</th>
                <th style={thStyle}>Owner</th>
                <th style={thStyle}>Score</th>
              </tr>
            </thead>
            <tbody>
              {classView.runs.map((run) => (
                <tr key={run.id || `${run.draw}-${run.backNumber}`}>
                  <td style={tdStyle}>{run.rank}</td>
                  <td style={tdStyle}>{run.draw}</td>
                  <td style={tdStyle}>{run.backNumber || "—"}</td>
                  <td style={tdStyle}>{run.rider || "—"}</td>
                  <td style={tdStyle}>{run.horse || "—"}</td>
                  <td style={tdStyle}>{run.owner || "—"}</td>
                  <td style={scoreCellStyle}>{run.scoreTotal || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PublicLivePanel({ classView }) {
  return (
    <section style={livePanelStyle}>
      <div style={classHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>Live</div>
          <h2 style={sectionTitleStyle}>
            {classView.className}
            {classView.classCode ? ` (${classView.classCode})` : ""}
          </h2>
          <div style={mutedTextStyle}>Pattern {classView.pattern || "—"}</div>
        </div>
        <Badge>En cours</Badge>
      </div>

      <div style={liveGridStyle}>
        <LiveRunBlock label="En piste" run={classView.activeRun} showScore />
        <LiveRunBlock label="Prochain participant" run={classView.nextRun} />
        <div style={liveBlockStyle}>
          <div style={runLabelStyle}>Deux derniers passés</div>
          {classView.lastPassedRuns?.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {classView.lastPassedRuns.map((run) => (
                <LiveRunCard key={run.id || run.draw} run={run} />
              ))}
            </div>
          ) : (
            <div style={mutedTextStyle}>—</div>
          )}
        </div>
      </div>
    </section>
  );
}

function LiveRunBlock({ label, run, showScore = false }) {
  return (
    <div style={liveBlockStyle}>
      <div style={runLabelStyle}>{label}</div>
      {run ? (
        <LiveRunCard run={run} showScore={showScore} />
      ) : (
        <div style={mutedTextStyle}>—</div>
      )}
    </div>
  );
}

function LiveRunCard({ run, showScore = true }) {
  return (
    <div>
      <div style={runTitleStyle}>
        #{run.draw} · Back {run.backNumber || "—"}
      </div>
      <div style={runNameStyle}>{run.rider || "Rider —"}</div>
      <div style={mutedTextStyle}>{run.horse || "Horse —"}</div>
      {showScore && <div style={liveScoreStyle}>{run.scoreTotal || "—"}</div>}
      <ManoeuvreDetails run={run} />
    </div>
  );
}

function ManoeuvreDetails({ run }) {
  const manoeuvres = Array.isArray(run?.manoeuvres) ? run.manoeuvres : [];

  if (!manoeuvres.length) {
    return null;
  }

  return (
    <div style={detailsGridStyle}>
      {manoeuvres.map((item) => (
        <div key={item.name} style={detailCellStyle}>
          <div style={detailNameStyle}>{item.name}</div>
          <div style={detailScoreStyle}>{item.score || "—"}</div>
          {item.penalty && <div style={detailPenaltyStyle}>P {item.penalty}</div>}
        </div>
      ))}
    </div>
  );
}

function Badge({ children }) {
  return <span style={badgeStyle}>{children}</span>;
}

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
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
  fontSize: 28,
};

const subtitleStyle = {
  color: "#64748b",
};

const summaryStyle = {
  background: "#ecfdf5",
  border: "1px solid #86efac",
  borderRadius: 8,
  padding: 14,
  marginBottom: 16,
};

const summaryValueStyle = {
  fontSize: 28,
  fontWeight: 800,
  color: "#166534",
};

const summaryLabelStyle = {
  color: "#166534",
  marginTop: 4,
};

const livePanelStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
  border: "1px solid #bbf7d0",
};

const liveGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const liveBlockStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  minHeight: 112,
};

const runLabelStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
  marginBottom: 8,
};

const runTitleStyle = {
  fontWeight: 900,
  color: "#111827",
};

const runNameStyle = {
  fontWeight: 800,
  marginTop: 4,
};

const liveScoreStyle = {
  fontSize: 28,
  fontWeight: 900,
  marginTop: 8,
};

const detailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
  gap: 6,
  marginTop: 10,
};

const detailCellStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: 8,
  minHeight: 48,
};

const detailNameStyle = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const detailScoreStyle = {
  fontWeight: 900,
  marginTop: 4,
};

const detailPenaltyStyle = {
  color: "#b91c1c",
  fontSize: 12,
  fontWeight: 800,
  marginTop: 2,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const sectionHeaderStyle = {
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const classCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
};

const classHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 12,
};

const classTitleStyle = {
  margin: 0,
  fontSize: 18,
};

const tableWrapStyle = {
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  minWidth: 760,
  borderCollapse: "collapse",
};

const thStyle = {
  textAlign: "left",
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#334155",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #e2e8f0",
  verticalAlign: "top",
};

const scoreCellStyle = {
  ...tdStyle,
  fontWeight: 900,
  color: "#111827",
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid #86efac",
  background: "#ecfdf5",
  color: "#166534",
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
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

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const mutedTextStyle = {
  color: "#64748b",
  fontSize: 13,
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

export default PublicResultsPage;
