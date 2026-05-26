import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getAnnouncerShowView,
  getAnnouncerShowViewRepository,
  subscribeAnnouncerShowViewRepository,
} from "../../features/live/liveViewRepository";
import { PROVISIONAL_RANKING_NOTE } from "../../features/scoring/provisionalRanking";
import { savePaidWarmupRepository } from "../../features/paidWarmups/paidWarmupRepository";
import {
  formatPaidWarmupTimer,
  getPaidWarmupRemainingSeconds,
  resetPaidWarmupTimer,
  setPaidWarmupEntryStatus,
  startPaidWarmupEntry,
  stopPaidWarmupTimer,
} from "../../features/paidWarmups/paidWarmupLive";
import { PAID_WARMUP_STATUS_LABELS } from "../../features/paidWarmups/paidWarmupStorage";
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
  const [now, setNow] = useState(() => new Date());
  const [rankingClass, setRankingClass] = useState(null);
  const autoCompletedPaidWarmupKeyRef = useRef(null);
  const liveClassIdsKey = useMemo(
    () => getLiveViewClassIds(liveView).join("|"),
    [liveView]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const refreshLiveViewNow = useCallback(async () => {
    const nextLiveView = await getAnnouncerShowViewRepository(showId);
    setLiveView(nextLiveView);
    setIsLoading(false);
  }, [showId]);

  const savePaidWarmupUpdate = useCallback(async (nextWarmup) => {
    await savePaidWarmupRepository(nextWarmup);
    await refreshLiveViewNow();
  }, [refreshLiveViewNow]);

  const handleStartPaidWarmupEntry = (warmup, entryId) => {
    return savePaidWarmupUpdate(startPaidWarmupEntry(warmup, entryId, new Date()));
  };

  const handleResetPaidWarmupTimer = (warmup) => {
    return savePaidWarmupUpdate(resetPaidWarmupTimer(warmup, new Date()));
  };

  const handleStopPaidWarmupTimer = (warmup) => {
    return savePaidWarmupUpdate(stopPaidWarmupTimer(warmup));
  };

  const handleSetPaidWarmupEntryStatus = (warmup, entryId, status) => {
    return savePaidWarmupUpdate(setPaidWarmupEntryStatus(warmup, entryId, status));
  };

  useEffect(() => {
    const warmup = liveView.activePaidWarmup;

    if (!warmup?.activeEntry) {
      return;
    }

    const remainingSeconds = getPaidWarmupRemainingSeconds(warmup, now);

    if (remainingSeconds == null || remainingSeconds > 0) {
      return;
    }

    const completionKey = [
      warmup.id,
      warmup.activeEntry.id,
      warmup.activeStartedAt,
    ].join(":");

    if (autoCompletedPaidWarmupKeyRef.current === completionKey) {
      return;
    }

    autoCompletedPaidWarmupKeyRef.current = completionKey;
    savePaidWarmupUpdate(stopPaidWarmupTimer(warmup));
  }, [liveView.activePaidWarmup, now, savePaidWarmupUpdate]);

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

  useEffect(() => {
    let isMounted = true;
    let refreshTimeout = null;

    const refreshLiveView = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(async () => {
        const nextLiveView = await getAnnouncerShowViewRepository(showId);
        if (!isMounted) return;
        setLiveView(nextLiveView);
        setIsLoading(false);
      }, 200);
    };

    const unsubscribe = subscribeAnnouncerShowViewRepository(
      showId,
      liveClassIdsKey ? liveClassIdsKey.split("|") : [],
      refreshLiveView
    );

    return () => {
      isMounted = false;
      window.clearTimeout(refreshTimeout);
      unsubscribe();
    };
  }, [showId, liveClassIdsKey]);

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
          {liveView.activePaidWarmup?.activeEntry ? (
            <PaidWarmupFocus warmup={liveView.activePaidWarmup} now={now} />
          ) : liveView.activeClasses?.length ? (
            <ActiveClassFocusList classes={liveView.activeClasses} />
          ) : (
            <div style={mutedTextStyle}>Aucun run actif.</div>
          )}
        </FocusPanel>

        <FocusPanel title="Prochain participant">
          {liveView.activePaidWarmup?.nextEntry ? (
            <PaidWarmupEntryFocus
              warmupName={liveView.activePaidWarmup.name}
              entry={liveView.activePaidWarmup.nextEntry}
            />
          ) : liveView.activeClasses?.some((classView) => classView.nextRun) ? (
            <NextRunFocusList classes={liveView.activeClasses} />
          ) : (
            <div style={mutedTextStyle}>Aucun prochain run.</div>
          )}
        </FocusPanel>

        <FocusPanel title="Deux derniers passés">
          {liveView.activePaidWarmup?.lastPassedEntries?.length ? (
            <PaidWarmupRecentEntries warmup={liveView.activePaidWarmup} />
          ) : liveView.recentResults?.length ? (
            <RecentResults results={liveView.recentResults} />
          ) : (
            <div style={mutedTextStyle}>Aucun passage affichable.</div>
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
                  {section.classes.length} classe(s) ·{" "}
                  {(section.paidWarmups || []).length} paid warm up(s)
                </div>
              </div>
            </div>

            {section.classes.length === 0 &&
            (section.paidWarmups || []).length === 0 ? (
              <div style={softEmptyStyle}>
                Aucune classe ou paid warm up pour cette journée.
              </div>
            ) : (
              <div style={classListStyle}>
                {section.classes.map((classView) => (
                  <ClassLiveCard
                    key={classView.classId}
                    classView={classView}
                    onOpenProvisionalRanking={setRankingClass}
                  />
                ))}
                {(section.paidWarmups || []).map((warmup) => (
                  <PaidWarmupLiveCard
                    key={warmup.id}
                    warmup={warmup}
                    now={now}
                    onStartEntry={handleStartPaidWarmupEntry}
                    onResetTimer={handleResetPaidWarmupTimer}
                    onStopTimer={handleStopPaidWarmupTimer}
                    onSetEntryStatus={handleSetPaidWarmupEntryStatus}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {rankingClass && (
        <ProvisionalRankingModal
          classView={rankingClass}
          onClose={() => setRankingClass(null)}
        />
      )}
    </div>
  );
}

function getLiveViewClassIds(liveView) {
  return (liveView?.sections || [])
    .flatMap((section) => section.classes || [])
    .map((classView) => classView.classId)
    .filter(Boolean);
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

function ActiveClassFocusList({ classes }) {
  return (
    <div style={focusListStyle}>
      {classes.map((classView) => (
        <div key={classView.classId} style={focusListItemStyle}>
          <RunFocus
            className={formatClassLocation(classView)}
            run={classView.activeRun || classView.nextRun}
          />
          <div style={mutedTextStyle}>{classView.publicationStatusLabel}</div>
        </div>
      ))}
    </div>
  );
}

function NextRunFocusList({ classes }) {
  return (
    <div style={focusListStyle}>
      {classes
        .filter((classView) => classView.nextRun)
        .map((classView) => (
          <div key={classView.classId} style={focusListItemStyle}>
            <RunFocus
              className={formatClassLocation(classView)}
              run={classView.nextRun}
              compact
            />
          </div>
        ))}
    </div>
  );
}

function formatClassLocation(classView) {
  return classView.arena
    ? `${classView.className} · ${classView.arena}`
    : classView.className;
}

function PaidWarmupFocus({ warmup, now }) {
  const remainingSeconds = getPaidWarmupRemainingSeconds(warmup, now);

  return (
    <div>
      <div style={focusClassNameStyle}>{warmup.name}</div>
      <div style={timerFocusStyle}>
        {formatPaidWarmupTimer(remainingSeconds)}
      </div>
      <PaidWarmupEntryIdentity entry={warmup.activeEntry} />
      <PaidWarmupTimerCue warmup={warmup} remainingSeconds={remainingSeconds} />
    </div>
  );
}

function PaidWarmupEntryFocus({ warmupName, entry }) {
  return (
    <div>
      <div style={focusClassNameStyle}>{warmupName}</div>
      <PaidWarmupEntryIdentity entry={entry} />
    </div>
  );
}

function PaidWarmupRecentEntries({ warmup }) {
  return (
    <div style={recentListStyle}>
      {warmup.lastPassedEntries.map((entry) => (
        <div key={entry.id} style={recentResultStyle}>
          <PaidWarmupEntryIdentity entry={entry} />
          <div style={mutedTextStyle}>
            {PAID_WARMUP_STATUS_LABELS[entry.status] || "Passé"}
          </div>
        </div>
      ))}
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
          <RunNote note={run.note} />
          <ManoeuvreDetails run={run} />
        </div>
      ))}
    </div>
  );
}

function PaidWarmupLiveCard({
  warmup,
  now,
  onStartEntry,
  onResetTimer,
  onStopTimer,
  onSetEntryStatus,
}) {
  const remainingSeconds = getPaidWarmupRemainingSeconds(warmup, now);
  const activeEntry = warmup.activeEntry;
  const nextEntry = warmup.nextEntry;

  return (
    <div style={classCardStyle}>
      <div style={classCardHeaderStyle}>
        <div>
          <div style={classNameStyle}>{warmup.name}</div>
          <div style={mutedTextStyle}>
            {warmup.durationMinutesPerRider} min/cavalier ·{" "}
            {warmup.dragInterval
              ? `Drag après ${warmup.dragInterval}`
              : "Aucun drag planifié"}
          </div>
        </div>
        <Badge tone={activeEntry ? "warn" : "muted"}>
          {activeEntry ? "Timer actif" : "Paid warm up"}
        </Badge>
      </div>

      {warmup.isDragDue && (
        <div style={dragNoticeStyle}>
          Drag de surface prévu · {warmup.dragDurationMinutes} min
        </div>
      )}

      <div style={runGridStyle}>
        <div style={runBlockStyle}>
          <div style={runLabelStyle}>En piste</div>
          {activeEntry ? (
            <>
              <PaidWarmupEntryIdentity entry={activeEntry} />
              <div style={timerInlineStyle}>
                {formatPaidWarmupTimer(remainingSeconds)}
              </div>
              <PaidWarmupTimerCue
                warmup={warmup}
                remainingSeconds={remainingSeconds}
              />
            </>
          ) : (
            <div style={mutedTextStyle}>—</div>
          )}
        </div>

        <div style={runBlockStyle}>
          <div style={runLabelStyle}>Prochain</div>
          {nextEntry ? (
            <PaidWarmupEntryIdentity entry={nextEntry} />
          ) : (
            <div style={mutedTextStyle}>Aucun cavalier en attente.</div>
          )}
        </div>

        <div style={runBlockStyle}>
          <div style={runLabelStyle}>Stats</div>
          <div style={mutedTextStyle}>
            {warmup.stats.total} total · {warmup.stats.done} passés ·{" "}
            {warmup.stats.noShow} no show · {warmup.stats.scratch} scratch
          </div>
        </div>
      </div>

      <div style={actionRowStyle}>
        {!activeEntry && nextEntry && (
          <button
            type="button"
            onClick={() => onStartEntry(warmup, nextEntry.id)}
            style={primaryButtonStyle}
          >
            Démarrer prochain
          </button>
        )}

        {activeEntry && (
          <>
            <button
              type="button"
              onClick={() =>
                onSetEntryStatus(warmup, activeEntry.id, "done")
              }
              style={primaryButtonStyle}
            >
              Marquer passé
            </button>
            <button
              type="button"
              onClick={() => onResetTimer(warmup)}
              style={secondaryButtonStyle}
            >
              Repartir timer
            </button>
            <button
              type="button"
              onClick={() => onStopTimer(warmup)}
              style={secondaryButtonStyle}
            >
              Arrêter et marquer passé
            </button>
          </>
        )}

        {nextEntry && (
          <>
            <button
              type="button"
              onClick={() => onSetEntryStatus(warmup, nextEntry.id, "no_show")}
              style={secondaryButtonStyle}
            >
              No show prochain
            </button>
            <button
              type="button"
              onClick={() => onSetEntryStatus(warmup, nextEntry.id, "scratch")}
              style={secondaryButtonStyle}
            >
              Scratch prochain
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PaidWarmupEntryIdentity({ entry }) {
  return (
    <div>
      <div style={runTitleStyle}>#{entry?.order || "—"}</div>
      <div style={runNameStyle}>{entry?.rider || "Cavalier —"}</div>
    </div>
  );
}

function PaidWarmupTimerCue({ warmup, remainingSeconds }) {
  if (remainingSeconds == null) return null;

  if (remainingSeconds <= 0) {
    return <div style={timerCueStyle("danger")}>Temps terminé</div>;
  }

  if (remainingSeconds <= 60) {
    return <div style={timerCueStyle("danger")}>Annonce: il reste 1 minute</div>;
  }

  if (remainingSeconds <= warmup.durationSeconds / 2) {
    return <div style={timerCueStyle("warn")}>Annonce: moitié du temps</div>;
  }

  return null;
}

function ClassLiveCard({ classView, onOpenProvisionalRanking }) {
  const liveState = getClassLiveState(classView);
  const hasProvisionalRanking = classView.provisionalRanking?.length > 0;

  return (
    <div style={classCardStyle}>
      <div style={classCardHeaderStyle}>
        <div>
          <div style={classNameStyle}>
            {classView.className}
            {classView.classCode ? ` (${classView.classCode})` : ""}
          </div>
          <div style={mutedTextStyle}>
            {classView.arena ? `Manège ${classView.arena} · ` : ""}
            Pattern {classView.pattern || "—"} · {classView.runCount} run(s)
          </div>
        </div>
        <div style={badgeStackStyle}>
          <Badge tone="muted">{classView.publicationStatusLabel}</Badge>
          <Badge tone={liveState.tone}>{liveState.label}</Badge>
        </div>
      </div>
      <div style={runGridStyle}>
        <RunBlock label="Actif" run={classView.activeRun} />
        <RunBlock label="Prochain" run={classView.nextRun} />
        <RunBlock label="Dernier score" run={classView.latestScore} showScore />
      </div>
      {classView.lastPassedRuns?.length > 0 && (
        <div style={completedWrapStyle}>
          <div style={runLabelStyle}>Deux derniers passés</div>
          <RecentResults
            results={classView.lastPassedRuns.map((run) => ({
              classId: classView.classId,
              className: classView.className,
              run,
            }))}
          />
        </div>
      )}
      {hasProvisionalRanking && (
        <div style={actionRowStyle}>
          <button
            type="button"
            onClick={() => onOpenProvisionalRanking(classView)}
            style={secondaryButtonStyle}
          >
            Classement provisoire
          </button>
        </div>
      )}
    </div>
  );
}

function getClassLiveState(classView) {
  if (classView.activeRun) {
    return { label: "Live", tone: "warn" };
  }

  if (classView.isComplete || classView.status === "completed") {
    return { label: "Terminée", tone: "success" };
  }

  if (classView.scoringStarted && classView.nextRun) {
    return { label: "En cours", tone: "warn" };
  }

  return { label: "À venir", tone: "muted" };
}

function RunBlock({ label, run, showScore = false }) {
  return (
    <div style={runBlockStyle}>
      <div style={runLabelStyle}>{label}</div>
      {run ? (
        <>
          <RunIdentity run={run} />
          {showScore && <div style={compactScoreStyle}>{run.scoreTotal || "—"}</div>}
          <RunNote note={run.note} />
        </>
      ) : (
        <div style={mutedTextStyle}>—</div>
      )}
    </div>
  );
}

function RunNote({ note }) {
  const cleanNote = String(note || "").trim();

  if (!cleanNote) return null;

  return (
    <div style={runNoteStyle}>
      <div style={runLabelStyle}>Note du juge</div>
      <div style={runNoteTextStyle}>{cleanNote}</div>
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

function ProvisionalRankingModal({ classView, onClose }) {
  const ranking = classView.provisionalRanking || [];

  return (
    <div style={modalBackdropStyle} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Classement provisoire</h2>
            <div style={classNameStyle}>{classView.className}</div>
            <div style={mutedTextStyle}>{PROVISIONAL_RANKING_NOTE}</div>
          </div>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Fermer
          </button>
        </div>

        <div style={rankingListStyle}>
          {ranking.map((run) => (
            <div key={run.id || run.draw} style={rankingRowStyle}>
              <div style={rankingRankStyle}>#{run.rank}</div>
              <div>
                <div style={runTitleStyle}>
                  Draw {run.draw || "—"} · Back {run.backNumber || "—"}
                </div>
                <div style={runNameStyle}>{run.rider || "Rider —"}</div>
                <div style={mutedTextStyle}>{run.horse || "Horse —"}</div>
              </div>
              <div style={rankingScoreStyle}>{run.scoreTotal || "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "muted" }) {
  return <span style={badgeStyle(tone)}>{children}</span>;
}

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000,
};

const modalStyle = {
  width: "min(720px, 100%)",
  maxHeight: "85vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 10,
  padding: 18,
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const rankingListStyle = {
  display: "grid",
  gap: 8,
};

const rankingRowStyle = {
  display: "grid",
  gridTemplateColumns: "64px 1fr auto",
  gap: 12,
  alignItems: "center",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
};

const rankingRankStyle = {
  fontWeight: 900,
  fontSize: 18,
  color: "#0f172a",
};

const rankingScoreStyle = {
  fontWeight: 900,
  fontSize: 20,
  color: "#111827",
};

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

const focusListStyle = {
  display: "grid",
  gap: 10,
};

const focusListItemStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
};

const scoreStyle = {
  fontSize: 44,
  fontWeight: 900,
  color: "#111827",
  margin: "8px 0",
};

const timerFocusStyle = {
  fontSize: 48,
  fontWeight: 900,
  color: "#111827",
  margin: "8px 0",
};

const timerInlineStyle = {
  fontSize: 28,
  fontWeight: 900,
  color: "#111827",
  marginTop: 8,
};

const compactScoreStyle = {
  fontSize: 24,
  fontWeight: 900,
  color: "#111827",
  marginTop: 8,
};

const runNoteStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 8,
  background: "#fff",
  marginTop: 8,
};

const runNoteTextStyle = {
  color: "#334155",
  whiteSpace: "pre-wrap",
  lineHeight: 1.4,
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

const badgeStackStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
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

const actionRowStyle = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const runBlockStyle = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  minHeight: 92,
};

const dragNoticeStyle = {
  border: "1px solid #fde68a",
  borderRadius: 8,
  padding: 10,
  background: "#fefce8",
  color: "#854d0e",
  fontWeight: 800,
  marginBottom: 12,
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

const timerCueStyle = (tone) => ({
  marginTop: 8,
  display: "inline-flex",
  padding: "6px 9px",
  borderRadius: 999,
  border: `1px solid ${tone === "danger" ? "#fecaca" : "#fdba74"}`,
  background: tone === "danger" ? "#fff5f5" : "#fff7ed",
  color: tone === "danger" ? "#991b1b" : "#9a3412",
  fontWeight: 800,
  fontSize: 13,
});

const badgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: `1px solid ${getBadgeColors(tone).border}`,
  background: getBadgeColors(tone).background,
  color: getBadgeColors(tone).color,
  fontWeight: 700,
  fontSize: 13,
  whiteSpace: "nowrap",
});

function getBadgeColors(tone) {
  if (tone === "warn") {
    return {
      border: "#fdba74",
      background: "#fff7ed",
      color: "#9a3412",
    };
  }

  if (tone === "success") {
    return {
      border: "#86efac",
      background: "#ecfdf5",
      color: "#166534",
    };
  }

  return {
    border: "#cbd5e1",
    background: "#f8fafc",
    color: "#475569",
  };
}

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
