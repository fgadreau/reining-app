import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAnnouncerShowView,
  getAnnouncerShowViewRepository,
} from "../../features/live/liveViewRepository";
import { useAssociationAccess } from "../../features/auth/useAssociationAccess";
import { getShowById } from "../../features/shows/showSelectors";
import { appStyles as styles } from "../../styles/appStyles";

function AnnouncerDashboardPage() {
  const { associationId, showId } = useParams();
  const navigate = useNavigate();
  const access = useAssociationAccess(associationId);
  const show = getShowById(showId);
  const [liveView, setLiveView] = useState(() => getAnnouncerShowView(showId));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadLiveView() {
      setIsLoading(true);
      const nextLiveView = await getAnnouncerShowViewRepository(showId);
      if (!isMounted) return;
      setLiveView(nextLiveView);
      setIsLoading(false);
    }

    loadLiveView();

    return () => {
      isMounted = false;
    };
  }, [showId]);

  if (!show) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={emptyStateStyle}>Show introuvable.</div>
      </div>
    );
  }

  if (!access.isLoadingAccess && !access.canAnnounceAssociation) {
    return (
      <div style={styles.app}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          ← Retour
        </button>
        <div style={emptyStateStyle}>
          Ce rôle n’a pas accès au tableau annonceur.
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
          <div style={eyebrowStyle}>Annonceur</div>
          <h1 style={titleStyle}>{show.name || "Show"}</h1>
          <div style={subtitleStyle}>
            {show.venue || show.location || "Lieu à confirmer"}
          </div>
        </div>
        {access.canManageAssociation && (
          <Link
            to={`/associations/${associationId}/shows/${showId}/secretariat`}
            style={linkButtonStyle}
          >
            Secrétariat
          </Link>
        )}
      </section>

      <section style={focusGridStyle}>
        <FocusPanel title="En piste">
          {liveView.activeClass?.activeRun ? (
            <RunFocus
              className={liveView.activeClass.className}
              run={liveView.activeClass.activeRun}
            />
          ) : (
            <div style={mutedTextStyle}>Aucun run actif.</div>
          )}
        </FocusPanel>

        <FocusPanel title="Prochain participant">
          {liveView.activeClass?.nextRun ? (
            <RunFocus
              className={liveView.activeClass.className}
              run={liveView.activeClass.nextRun}
              compact
            />
          ) : (
            <div style={mutedTextStyle}>Aucun prochain run.</div>
          )}
        </FocusPanel>

        <FocusPanel title="Deux derniers passés">
          {liveView.recentResults?.length ? (
            <RecentResults results={liveView.recentResults} />
          ) : (
            <div style={mutedTextStyle}>Aucun résultat affichable.</div>
          )}
        </FocusPanel>
      </section>

      {isLoading && (
        <div style={emptyStateStyle}>Chargement du tableau annonceur…</div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {liveView.sections.map((section) => (
          <section key={section.day.id} style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>{section.day.label || "Journée"}</h2>
                <div style={mutedTextStyle}>
                  {section.day.date || "Date non définie"} ·{" "}
                  {section.classes.length} classe(s)
                </div>
              </div>
            </div>

            {section.classes.length === 0 ? (
              <div style={softEmptyStyle}>Aucune classe pour cette journée.</div>
            ) : (
              <div style={classListStyle}>
                {section.classes.map((classView) => (
                  <ClassLiveCard key={classView.classId} classView={classView} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function FocusPanel({ title, children }) {
  return (
    <section style={focusPanelStyle}>
      <h2 style={focusTitleStyle}>{title}</h2>
      {children}
    </section>
  );
}

function RunFocus({ className, run, compact = false }) {
  return (
    <div>
      <div style={focusClassNameStyle}>{className}</div>
      {!compact && run.scoreTotal && (
        <div style={scoreStyle}>{run.scoreTotal || "—"}</div>
      )}
      <RunIdentity run={run} />
    </div>
  );
}

function RecentResults({ results }) {
  return (
    <div style={recentListStyle}>
      {results.map(({ classId, className, run }) => (
        <div key={`${classId}-${run.id || run.draw}`} style={recentResultStyle}>
          <div style={recentHeaderStyle}>
            <div>
              <div style={classNameStyle}>{className}</div>
              <RunIdentity run={run} />
            </div>
            <div style={compactScoreStyle}>{run.scoreTotal || "—"}</div>
          </div>
          <ManoeuvreDetails run={run} />
        </div>
      ))}
    </div>
  );
}

function ClassLiveCard({ classView }) {
  return (
    <div style={classCardStyle}>
      <div style={classCardHeaderStyle}>
        <div>
          <div style={classNameStyle}>
            {classView.className}
            {classView.classCode ? ` (${classView.classCode})` : ""}
          </div>
          <div style={mutedTextStyle}>
            Pattern {classView.pattern || "—"} · {classView.runCount} run(s)
          </div>
        </div>
        <Badge tone={classView.scoringStarted ? "warn" : "muted"}>
          {classView.scoringStarted ? "Live" : "À venir"}
        </Badge>
      </div>
      <div style={runGridStyle}>
        <RunBlock label="Actif" run={classView.activeRun} />
        <RunBlock label="Prochain" run={classView.nextRun} />
        <RunBlock label="Dernier score" run={classView.latestScore} showScore />
      </div>
      {classView.lastCompletedRuns?.length > 0 && (
        <div style={completedWrapStyle}>
          <div style={runLabelStyle}>Deux derniers passés</div>
          <RecentResults
            results={classView.lastCompletedRuns.map((run) => ({
              classId: classView.classId,
              className: classView.className,
              run,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function RunBlock({ label, run, showScore = false }) {
  return (
    <div style={runBlockStyle}>
      <div style={runLabelStyle}>{label}</div>
      {run ? (
        <>
          <RunIdentity run={run} />
          {showScore && <div style={compactScoreStyle}>{run.scoreTotal || "—"}</div>}
        </>
      ) : (
        <div style={mutedTextStyle}>—</div>
      )}
    </div>
  );
}

function RunIdentity({ run }) {
  return (
    <div>
      <div style={runTitleStyle}>
        #{run.draw} · Back {run.backNumber || "—"}
      </div>
      <div style={runNameStyle}>{run.rider || "Rider —"}</div>
      <div style={mutedTextStyle}>{run.horse || "Horse —"}</div>
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

function Badge({ children, tone = "muted" }) {
  return <span style={badgeStyle(tone)}>{children}</span>;
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

const focusGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const focusPanelStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  minHeight: 180,
};

const focusTitleStyle = {
  margin: "0 0 12px",
  fontSize: 18,
};

const focusClassNameStyle = {
  fontSize: 22,
  fontWeight: 800,
  color: "#0f172a",
};

const scoreStyle = {
  fontSize: 44,
  fontWeight: 900,
  color: "#111827",
  margin: "8px 0",
};

const compactScoreStyle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#111827",
  marginTop: 8,
};

const recentListStyle = {
  display: "grid",
  gap: 10,
};

const recentResultStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
};

const recentHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const classListStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const classCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
};

const classCardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  marginBottom: 12,
};

const classNameStyle = {
  fontWeight: 800,
  color: "#0f172a",
};

const runGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const runBlockStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  minHeight: 92,
};

const completedWrapStyle = {
  marginTop: 12,
  borderTop: "1px solid #e2e8f0",
  paddingTop: 12,
};

const runLabelStyle = {
  color: "#64748b",
  fontWeight: 700,
  fontSize: 12,
  textTransform: "uppercase",
  marginBottom: 8,
};

const runTitleStyle = {
  fontWeight: 800,
  color: "#0f172a",
};

const runNameStyle = {
  fontWeight: 700,
  marginTop: 4,
};

const mutedTextStyle = {
  color: "#64748b",
  fontSize: 13,
};

const detailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
  gap: 6,
  marginTop: 10,
};

const detailCellStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: 6,
  minHeight: 50,
};

const detailNameStyle = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const detailScoreStyle = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
  marginTop: 2,
};

const detailPenaltyStyle = {
  color: "#9a3412",
  fontSize: 11,
  fontWeight: 700,
  marginTop: 2,
};

const badgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: `1px solid ${tone === "warn" ? "#fdba74" : "#cbd5e1"}`,
  background: tone === "warn" ? "#fff7ed" : "#f8fafc",
  color: tone === "warn" ? "#9a3412" : "#475569",
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
});

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

export default AnnouncerDashboardPage;
