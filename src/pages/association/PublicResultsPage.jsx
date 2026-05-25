import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getPublicAssociationRepository,
  getPublicShowRepository,
  getPublicShowView,
  getPublicShowViewRepository,
  subscribePublicShowViewRepository,
} from "../../features/publication/publicViewRepository";
import { formatClockTime } from "../../features/classes/classTiming";
import { getShowById } from "../../features/shows/showSelectors";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import { appStyles as styles } from "../../styles/appStyles";

function PublicResultsPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith("/public");
  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(() => getShowById(showId));
  const [publicView, setPublicView] = useState(() => getPublicShowView(showId));
  const [isLoading, setIsLoading] = useState(true);
  const [openClassId, setOpenClassId] = useState(null);
  const publicClassIdsKey = (publicView.classIds || []).join("|");
  const hasLiveClass = Boolean(publicView.liveClass);

  useEffect(() => {
    let isMounted = true;

    async function loadPublicView() {
      setIsLoading(true);
      const [nextAssociation, nextShow, nextPublicView] = await Promise.all([
        getPublicAssociationRepository(associationId),
        getPublicShowRepository(showId),
        getPublicShowViewRepository(showId),
      ]);
      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShow(nextShow);
      setPublicView(nextPublicView);
      setIsLoading(false);
    }

    loadPublicView();

    return () => {
      isMounted = false;
    };
  }, [associationId, showId]);

  useEffect(() => {
    const publishedClassIds = new Set(
      publicView.sections.flatMap((section) =>
        section.classes.map((classView) => classView.classId)
      )
    );

    if (openClassId && !publishedClassIds.has(openClassId)) {
      setOpenClassId(null);
    }
  }, [publicView.sections, openClassId]);

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

  useEffect(() => {
    if (!hasLiveClass) {
      return undefined;
    }

    let isMounted = true;
    const refreshTimer = window.setInterval(async () => {
      const nextPublicView = await getPublicShowViewRepository(showId);

      if (!isMounted) return;
      setPublicView(nextPublicView);
    }, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [showId, hasLiveClass]);

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
          <div style={eyebrowStyle}>Feuilles de pointage publiques</div>
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
        <div style={summaryLabelStyle}>classe(s) avec feuilles publiées</div>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>
          Chargement des feuilles de pointage publiques…
        </div>
      ) : publicView.sections.length === 0 ? (
        <div style={emptyStateStyle}>
          Aucune feuille de pointage officielle publiée pour l’instant. Le live
          public apparaît ici seulement si une classe du show est autorisée dans
          le setup.
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
                    association={association}
                    show={show}
                    classView={classView}
                    isOpen={openClassId === classView.classId}
                    onToggle={() =>
                      setOpenClassId((currentClassId) =>
                        currentClassId === classView.classId
                          ? null
                          : classView.classId
                      )
                    }
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

function PublicClassResults({ association, show, classView, isOpen, onToggle }) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredRuns = useMemo(
    () => filterRunsBySearch(classView.runs, searchQuery),
    [classView.runs, searchQuery]
  );

  const downloadClassPdf = (event) => {
    event.stopPropagation();

    const headers = getHeadersForPublicClass(classView);
    const pdfRuns = classView.runs.map((run) => ({
      ...run,
      scores: run.manoeuvres.map((manoeuvre) => manoeuvre.score || ""),
      penalties: run.manoeuvres.map((manoeuvre) => manoeuvre.penalty || ""),
    }));
    const pdf = generateScorePdf({
      associationName: association?.name || "Association",
      associationLogoDataUrl: association?.logoDataUrl || null,
      eventName: show?.name || "",
      eventDate: show?.startDate || "",
      classItem: {
        name: classView.className,
        classCode: classView.classCode,
      },
      classSetup: {
        pattern: classView.pattern,
        judgeName: classView.judgeName,
        finalizedAt: classView.finalizedAt || classView.publishedAt,
      },
      runs: pdfRuns,
      headers,
    });
    const fileName = buildScorePdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: show?.name || "show",
      className: classView.className || "classe",
      finalizedAt: classView.finalizedAt || classView.publishedAt,
    });

    pdf.save(fileName);
  };

  return (
    <section style={classCardStyle}>
      <div
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        style={classToggleStyle}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
      >
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
        <div style={classActionsStyle}>
          <Badge>Scoresheet officielle</Badge>
          <button
            type="button"
            onClick={downloadClassPdf}
            onKeyDown={(event) => event.stopPropagation()}
            style={smallButtonStyle}
          >
            Télécharger PDF
          </button>
          <span style={toggleIconStyle}>{isOpen ? "Masquer" : "Voir"}</span>
        </div>
      </div>

      {!isOpen ? null : classView.runs.length === 0 ? (
        <div style={softEmptyStyle}>Aucun run publié pour cette classe.</div>
      ) : (
        <div>
          <label style={searchLabelStyle}>
            <span>Rechercher une run</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cavalier, cheval ou back number"
              style={searchInputStyle}
            />
          </label>

          {filteredRuns.length === 0 ? (
            <div style={softEmptyStyle}>Aucune run ne correspond à la recherche.</div>
          ) : (
            <div style={scoresheetListStyle}>
              {filteredRuns.map((run) => (
                <PublicScoresheetRun
                  key={run.id || `${run.draw}-${run.backNumber}`}
                  run={run}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function getHeadersForPublicClass(classView) {
  const firstRun = classView.runs.find((run) => run.manoeuvres?.length);

  if (!firstRun) {
    return [];
  }

  return firstRun.manoeuvres.map((manoeuvre) => manoeuvre.name);
}

function PublicScoresheetRun({ run }) {
  return (
    <article style={scoresheetRunStyle}>
      <div style={scoresheetRunHeaderStyle}>
        <div>
          <div style={runTitleStyle}>
            Ordre #{run.draw || "—"} · Back {run.backNumber || "—"}
          </div>
          <div style={runNameStyle}>{run.rider || "Rider —"}</div>
          <div style={mutedTextStyle}>{run.horse || "Horse —"}</div>
          {run.owner && <div style={mutedTextStyle}>Owner: {run.owner}</div>}
        </div>
        <div style={runTotalsStyle}>
          <div>
            <div style={runLabelStyle}>Score</div>
            <div style={scoreValueStyle}>{run.scoreTotal || "—"}</div>
          </div>
          <div>
            <div style={runLabelStyle}>Pén. totales</div>
            <div style={penaltyValueStyle}>{run.penTotal || "—"}</div>
          </div>
        </div>
      </div>

      <ManoeuvreDetails run={run} showDescriptions />
    </article>
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

      <PublicTimingSummary timing={classView.timing} />

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

function PublicTimingSummary({ timing }) {
  return (
    <div style={timingPanelStyle}>
      <div style={timingGridStyle}>
        <TimingMetric
          label="Fin estimée de la classe"
          value={formatClockTime(timing?.classEstimatedEndAt)}
        />
        <TimingMetric
          label="Fin estimée de la journée"
          value={formatClockTime(timing?.dayEstimatedEndAt)}
        />
      </div>
      <div style={timingNoteStyle}>
        Estimation ajustée selon les temps réels enregistrés et les drags prévus.
      </div>
    </div>
  );
}

function TimingMetric({ label, value }) {
  return (
    <div style={timingMetricStyle}>
      <div style={runLabelStyle}>{label}</div>
      <div style={timingValueStyle}>{value}</div>
    </div>
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

function ManoeuvreDetails({ run, showDescriptions = false }) {
  const manoeuvres = Array.isArray(run?.manoeuvres) ? run.manoeuvres : [];

  if (!manoeuvres.length) {
    return null;
  }

  return (
    <div style={detailsGridStyle}>
      {manoeuvres.map((item, index) => (
        <div key={`${item.name}-${index}`} style={detailCellStyle}>
          <div style={detailNameStyle}>{item.name}</div>
          {showDescriptions && item.description && item.description !== item.name && (
            <div style={detailDescriptionStyle}>{item.description}</div>
          )}
          <div style={detailScoreStyle}>{item.score || "—"}</div>
          {item.penalty && <div style={detailPenaltyStyle}>P {item.penalty}</div>}
        </div>
      ))}
    </div>
  );
}

function filterRunsBySearch(runs, query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return runs;
  }

  return runs.filter((run) =>
    [run.backNumber, run.rider, run.horse]
      .map(normalizeSearchText)
      .some((value) => value.includes(normalizedQuery))
  );
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

const timingPanelStyle = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};

const timingGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
};

const timingMetricStyle = {
  background: "#fff",
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  padding: 12,
};

const timingValueStyle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#1e3a8a",
};

const timingNoteStyle = {
  color: "#475569",
  fontSize: 13,
  marginTop: 10,
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

const detailDescriptionStyle = {
  color: "#475569",
  fontSize: 12,
  marginTop: 3,
  lineHeight: 1.3,
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

const classToggleStyle = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: 0,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 12,
  textAlign: "left",
  cursor: "pointer",
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

const classActionsStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const smallButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
};

const toggleIconStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 800,
  fontSize: 13,
};

const searchLabelStyle = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontWeight: 800,
  marginBottom: 12,
};

const searchInputStyle = {
  width: "100%",
  maxWidth: 520,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const scoresheetListStyle = {
  display: "grid",
  gap: 12,
};

const scoresheetRunStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
};

const scoresheetRunHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 10,
};

const runTotalsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const scoreValueStyle = {
  minWidth: 76,
  border: "1px solid #dbeafe",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#eff6ff",
  color: "#1e3a8a",
  fontWeight: 900,
  fontSize: 18,
  textAlign: "center",
};

const penaltyValueStyle = {
  minWidth: 76,
  border: "1px solid #fee2e2",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#fff5f5",
  color: "#991b1b",
  fontWeight: 900,
  fontSize: 18,
  textAlign: "center",
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
