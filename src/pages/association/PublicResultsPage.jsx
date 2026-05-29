import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import PublicAppInstallPrompt from "../../components/PublicAppInstallPrompt";
import SeoMeta from "../../components/SeoMeta";
import ShareButton from "../../components/ShareButton";
import {
  getPublicAssociationRepository,
  getPublicShowRepository,
  getPublicShowView,
  getPublicShowViewRepository,
  subscribePublicShowViewRepository,
} from "../../features/publication/publicViewRepository";
import { formatClockTime } from "../../features/classes/classTiming";
import {
  formatPaidWarmupTimer,
  getPaidWarmupDragRemainingSeconds,
  getPaidWarmupRemainingSeconds,
} from "../../features/paidWarmups/paidWarmupLive";
import { formatLiveDataFreshness } from "../../features/live/liveFreshness";
import { getAssociationWebsiteHref } from "../../features/associations/associationProfile";
import { getShowById } from "../../features/shows/showSelectors";
import { PUBLICATION_STATUSES } from "../../features/publication/publicationRepository";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { buildShowPublicSeo } from "../../features/seo/publicSeo";
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
  const [now, setNow] = useState(() => new Date());
  const { t } = useTranslation();
  const publicClassIdsKey = (publicView.classIds || []).join("|");
  const liveClasses = Array.isArray(publicView.liveClasses)
    ? publicView.liveClasses
    : publicView.liveClass
      ? [publicView.liveClass]
      : [];
  const hasLiveClass = Boolean(liveClasses.length || publicView.livePaidWarmup);
  const canonicalPublicPath = `/public/associations/${associationId}/shows/${showId}`;
  const seo = useMemo(
    () => buildShowPublicSeo({ association, show, t }),
    [association, show, t]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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
        <SeoMeta
          title={seo.title}
          description={seo.description}
          canonicalPath={canonicalPublicPath}
          imageUrl={association?.logoDataUrl}
          robots={isPublicRoute ? "index,follow" : "noindex,follow"}
        />
        {isPublicRoute && <PublicAppInstallPrompt />}

        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>{t("public.results.showNotFound")}</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <SeoMeta
        title={seo.title}
        description={seo.description}
        canonicalPath={canonicalPublicPath}
        imageUrl={association?.logoDataUrl}
        robots={isPublicRoute ? "index,follow" : "noindex,follow"}
      />
      {isPublicRoute && <PublicAppInstallPrompt />}

      <div style={{ marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
      </div>

      <section style={heroStyle}>
        <div style={heroBrandStyle}>
          <AssociationLogo association={association} size={58} />
          <div>
            <div style={eyebrowStyle}>{t("public.results.siteTitle")}</div>
            <h1 style={titleStyle}>{show?.name || t("common.show")}</h1>
            <div style={subtitleStyle}>
              {association?.shortName || association?.name || t("common.association")} ·{" "}
              {show?.venue || show?.location || t("public.results.venueTbd")}
            </div>
          </div>
        </div>
        <div style={heroActionsStyle}>
          {getAssociationWebsiteHref(association) && (
            <a
              href={getAssociationWebsiteHref(association)}
              target="_blank"
              rel="noreferrer"
              style={linkButtonStyle}
            >
              {t("common.website")}
            </a>
          )}
          <ShareButton
            url={`/public/associations/${associationId}/shows/${showId}`}
            title={seo.title}
            text={seo.description}
          />
          {isPublicRoute ? (
            <Link to={`/public/associations/${associationId}`} style={linkButtonStyle}>
              {t("common.shows")}
            </Link>
          ) : (
            <Link
              to={`/associations/${associationId}/shows/${showId}`}
              style={linkButtonStyle}
            >
              {t("common.show")}
            </Link>
          )}
        </div>
      </section>

      {publicView.livePaidWarmup && (
        <PublicPaidWarmupLivePanel warmup={publicView.livePaidWarmup} now={now} />
      )}

      {liveClasses.length > 0 && (
        <div style={liveStackStyle}>
          {liveClasses.map((classView) => (
            <PublicLivePanel
              key={classView.classId}
              classView={classView}
              now={now}
            />
          ))}
        </div>
      )}

      <section style={summaryStyle}>
        <div style={summaryValueStyle}>{publicView.publishedClassCount}</div>
        <div style={summaryLabelStyle}>{t("public.results.publishedSheets")}</div>
        {publicView.liveClassCount > 0 && (
          <div style={summarySubLabelStyle}>
            {t("public.results.liveActive", {
              count: publicView.liveClassCount,
            })}
          </div>
        )}
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("public.results.loading")}</div>
      ) : publicView.sections.length === 0 ? (
        <div style={emptyStateStyle}>{t("public.results.noSheets")}</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {publicView.sections.map((section) => (
            <section key={section.day.id} style={cardStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}>
                    {section.day.label || t("public.results.day")}
                  </h2>
                  <div style={mutedTextStyle}>
                    {section.day.date || t("public.results.dateTbd")}
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
  const { t } = useTranslation();
  const filteredRuns = useMemo(
    () => filterRunsBySearch(classView.runs, searchQuery),
    [classView.runs, searchQuery]
  );

  const downloadClassPdf = (event) => {
    event.stopPropagation();

    const headers = getHeadersForPublicClass(classView);
    const pdfRuns = classView.runs.map((run) => ({
      ...run,
      judgeId: run.judgeId,
      judgeName: run.judgeName,
      judgeOrder: run.judgeOrder,
      scores: run.manoeuvres.map((manoeuvre) => manoeuvre.score || ""),
      penalties: run.manoeuvres.map((manoeuvre) => manoeuvre.penalty || ""),
    }));
    const pdf = generateScorePdf({
      associationName: association?.name || t("common.association"),
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
      showRunJudgeName: Boolean(classView.isMultiJudge),
      titleSuffix: classView.isMultiJudge ? "Combined / Combiné" : "",
    });
    const fileName = buildScorePdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: show?.name || "show",
      className: classView.className || "class",
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
            {t("public.results.pattern")} {classView.pattern || "—"}
            {classView.arena
              ? ` · ${t("public.results.arena")} ${classView.arena}`
              : ""}
            {getPublicJudgeLabel(classView, t)}
          </div>
        </div>
        <div style={classActionsStyle}>
          <Badge>{t("public.results.officialScoresheet")}</Badge>
          <button
            type="button"
            onClick={downloadClassPdf}
            onKeyDown={(event) => event.stopPropagation()}
            style={smallButtonStyle}
          >
            {t("public.results.downloadPdf")}
          </button>
          <span style={toggleIconStyle}>
            {isOpen ? t("public.results.hide") : t("public.results.view")}
          </span>
        </div>
      </div>

      {!isOpen ? null : classView.runs.length === 0 ? (
        <div style={softEmptyStyle}>{t("public.results.noPublishedRuns")}</div>
      ) : (
        <div>
          <label style={searchLabelStyle}>
            <span>{t("public.results.searchRun")}</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("public.results.searchRunPlaceholder")}
              style={searchInputStyle}
            />
          </label>

          {filteredRuns.length === 0 ? (
            <div style={softEmptyStyle}>{t("public.results.noRunSearchResults")}</div>
          ) : (
            <div style={scoresheetListStyle}>
              {filteredRuns.map((run, index) => (
                <PublicScoresheetRun
                  key={
                    run.id
                      ? `${run.id}-${run.judgeId || run.judgeName || index}`
                      : `${run.draw}-${run.backNumber}-${run.judgeId || index}`
                  }
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

function getPublicJudgeLabel(classView, t) {
  if (classView.judgeNames?.length > 1) {
    return ` · ${t("public.results.judges")} ${classView.judgeNames.join(", ")}`;
  }

  if (classView.judgeName) {
    return ` · ${t("public.results.judge")} ${classView.judgeName}`;
  }

  return "";
}

function PublicScoresheetRun({ run }) {
  const { t } = useTranslation();

  return (
    <article style={scoresheetRunStyle}>
      <div style={scoresheetRunHeaderStyle}>
        <div>
          <div style={runTitleStyle}>
            {t("public.results.order")} #{run.draw || "—"} ·{" "}
            {t("public.results.backNumber")} {run.backNumber || "—"}
          </div>
          <div style={runNameStyle}>
            {run.rider || t("public.results.riderFallback")}
          </div>
          <div style={mutedTextStyle}>
            {run.horse || t("public.results.horseFallback")}
          </div>
          {run.owner && (
            <div style={mutedTextStyle}>
              {t("public.results.owner")}: {run.owner}
            </div>
          )}
          {run.judgeName && (
            <div style={judgeLineStyle}>
              {t("public.results.judge")}: {run.judgeName}
            </div>
          )}
        </div>
        <div style={runTotalsStyle}>
          <div>
            <div style={runLabelStyle}>{t("public.results.score")}</div>
            <div style={scoreValueStyle}>{run.scoreTotal || "—"}</div>
          </div>
          <div>
            <div style={runLabelStyle}>{t("public.results.totalPenalties")}</div>
            <div style={penaltyValueStyle}>{run.penTotal || "—"}</div>
          </div>
        </div>
      </div>

      <PublicRunNote note={run.note} />
      <ManoeuvreDetails run={run} showDescriptions />
    </article>
  );
}

function PublicLivePanel({ classView, now }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dragBreak = classView.dragBreak?.isActive ? classView.dragBreak : null;
  const isScheduleOnly = Boolean(classView.isScheduleOnly);
  const dragRemainingSeconds = getDragRemainingSeconds(dragBreak, now);
  const nextRun = dragBreak?.nextRun || classView.nextRun;
  const secondNextRun = classView.secondNextRun;
  const showScores = classView.showScores !== false;
  const showScoreDetails = showScores && classView.showScoreDetails !== false;
  const showLastPassedBlock = showScoreDetails || !showScores;
  const canShowRunScore = (run) =>
    showScores && Boolean(String(run?.scoreTotal || "").trim());
  const publicationLabel = getPublicPublicationStatusLabel(
    classView.publicationStatus || PUBLICATION_STATUSES.LIVE,
    t
  );
  const panelDetailsId = `public-live-details-${classView.classId || "class"}`;

  function togglePanel() {
    setIsOpen((current) => !current);
  }

  function handlePanelKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePanel();
  }

  return (
    <section style={livePanelStyle}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-controls={panelDetailsId}
        onClick={togglePanel}
        onKeyDown={handlePanelKeyDown}
        style={livePanelToggleStyle(isOpen)}
      >
        <div>
          <div style={eyebrowStyle}>{t("public.results.liveLabel")}</div>
          <h2 style={sectionTitleStyle}>
            {classView.className}
            {classView.classCode ? ` (${classView.classCode})` : ""}
          </h2>
          <div style={mutedTextStyle}>
            {classView.arena
              ? `${t("public.results.arena")} ${classView.arena} · `
              : ""}
            {isScheduleOnly
              ? getScheduleDetailsSummary(classView.scheduleDetails, t) ||
                t("public.results.scheduleOnly")
              : `${t("public.results.pattern")} ${classView.pattern || "—"}`}
          </div>
        </div>
        <div style={badgeStackStyle}>
          <LiveFreshnessBadge updatedAt={classView.liveUpdatedAt} now={now} />
          <Badge>{publicationLabel}</Badge>
          <Badge>
            {isScheduleOnly
              ? classView.isComplete
                ? t("management.classes.statusCompleted")
                : t("public.results.classInProgress")
              : dragBreak
                ? t("public.results.drag")
                : t("public.results.inProgress")}
          </Badge>
          <span style={toggleIconStyle}>
            {isOpen ? t("public.results.hide") : t("public.results.view")}
          </span>
        </div>
      </div>

      {!isOpen ? null : (
        <div id={panelDetailsId}>
          {!isScheduleOnly && <PublicTimingSummary timing={classView.timing} />}

          {isScheduleOnly ? (
            <ScheduleOnlyLiveDetails classView={classView} />
          ) : !showScores && (
            <div style={noScoreNoticeStyle}>
              {t("public.results.noScoresNotice")}
            </div>
          )}

          {!isScheduleOnly && showScores && !showScoreDetails && (
            <div style={noScoreNoticeStyle}>
              {t("public.results.completedScoresNotice")}
            </div>
          )}

          {!isScheduleOnly && dragBreak && (
            <div style={paidWarmupNoticeStyle}>
              {t("public.results.dragInProgress", {
                minutes: dragBreak.durationMinutes ?? "—",
              })}
            </div>
          )}

          {!isScheduleOnly && (
            <div style={liveGridStyle}>
              <div style={liveBlockStyle}>
                <div style={runLabelStyle}>{t("public.results.onCourse")}</div>
                {dragBreak ? (
                  <PublicDragCard remainingSeconds={dragRemainingSeconds} />
                ) : classView.activeRun ? (
                  <LiveRunCard
                    run={classView.activeRun}
                    showScore={canShowRunScore(classView.activeRun)}
                    showDetails={showScoreDetails}
                  />
                ) : (
                  <div style={mutedTextStyle}>—</div>
                )}
              </div>
              <LiveRunBlock
                run={nextRun}
                showDetails={showScoreDetails}
                statusLabel={t("public.results.statusPreparation")}
                status="preparation"
              />
              <LiveRunBlock
                run={secondNextRun}
                showDetails={showScoreDetails}
                statusLabel={t("public.results.statusWaiting")}
                status="waiting"
              />
              {showLastPassedBlock && (
                <div style={liveBlockStyle}>
                  <div style={runLabelStyle}>{t("public.results.lastTwoPassed")}</div>
                  {classView.lastPassedRuns?.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {classView.lastPassedRuns.map((run) => (
                        <LiveRunCard
                          key={run.id || run.draw}
                          run={run}
                          showScore={canShowRunScore(run)}
                          showDetails={showScoreDetails}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={mutedTextStyle}>—</div>
                  )}
                </div>
              )}
            </div>
          )}

          {!isScheduleOnly && (
            <PublicLiveOrderTable
              runs={classView.orderRuns || []}
              showScores={showScores}
            />
          )}
        </div>
      )}
    </section>
  );
}

function ScheduleOnlyLiveDetails({ classView }) {
  const { t } = useTranslation();
  const details = getScheduleDetailsParts(classView.scheduleDetails, t);

  return (
    <div style={scheduleOnlyPanelStyle}>
      <div style={runLabelStyle}>
        {classView.isComplete
          ? t("management.classes.statusCompleted")
          : t("public.results.classInProgress")}
      </div>
      <div style={runNameStyle}>{classView.className}</div>
      <div style={scheduleOnlyProgressStyle}>
        {getScheduleProgressLabel(classView.scheduleDetails, t)}
      </div>
      {details.length ? (
        <div style={scheduleOnlyDetailListStyle}>
          {details.map((detail) => (
            <span key={detail} style={scheduleOnlyDetailStyle}>
              {detail}
            </span>
          ))}
        </div>
      ) : (
        <div style={mutedTextStyle}>{t("public.results.scheduleOnly")}</div>
      )}
    </div>
  );
}

function PublicPaidWarmupLivePanel({ warmup, now }) {
  const { t } = useTranslation();
  const remainingSeconds = getPaidWarmupRemainingSeconds(warmup, now);
  const isDragDue = warmup.isDragDue && !warmup.activeEntry;
  const dragRemainingSeconds = isDragDue
    ? getPaidWarmupDragRemainingSeconds(warmup, now)
    : null;

  return (
    <section style={livePanelStyle}>
      <div style={classHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>{t("public.results.liveLabel")}</div>
          <h2 style={sectionTitleStyle}>
            {warmup.name || t("public.results.paidWarmup")}
          </h2>
          <div style={mutedTextStyle}>
            {t("public.results.paidWarmupMinutes", {
              minutes: warmup.durationMinutesPerRider,
            })}
          </div>
        </div>
        <div style={badgeStackStyle}>
          <LiveFreshnessBadge updatedAt={warmup.updatedAt} now={now} />
          <Badge>
            {isDragDue ? t("public.results.drag") : t("public.results.inProgress")}
          </Badge>
        </div>
      </div>

      {isDragDue && (
        <div style={paidWarmupNoticeStyle}>
          {t("public.results.dragInProgress", {
            minutes: warmup.dragDurationMinutes,
          })}
        </div>
      )}

      <div style={liveGridStyle}>
        <div style={liveBlockStyle}>
          <div style={runLabelStyle}>{t("public.results.onCourse")}</div>
          {isDragDue ? (
            <PublicDragCard remainingSeconds={dragRemainingSeconds} />
          ) : warmup.activeEntry ? (
            <PublicPaidWarmupEntry
              entry={warmup.activeEntry}
              remainingSeconds={remainingSeconds}
              warmup={warmup}
            />
          ) : (
            <div style={mutedTextStyle}>—</div>
          )}
        </div>

        <div style={liveBlockStyle}>
          <div style={runLabelStyle}>{t("public.results.nextParticipant")}</div>
          {warmup.nextEntry ? (
            <PublicPaidWarmupEntry entry={warmup.nextEntry} />
          ) : (
            <div style={mutedTextStyle}>—</div>
          )}
        </div>

        <div style={liveBlockStyle}>
          <div style={runLabelStyle}>{t("public.results.lastTwoPassed")}</div>
          {warmup.lastPassedEntries?.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {warmup.lastPassedEntries.map((entry) => (
                <PublicPaidWarmupEntry key={entry.id} entry={entry} />
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

function PublicDragCard({ remainingSeconds }) {
  const { t } = useTranslation();
  const displaySeconds =
    remainingSeconds == null ? null : Math.max(Math.round(remainingSeconds), 0);

  return (
    <div>
      <div style={runTitleStyle}>{t("public.results.dragSurface")}</div>
      <div style={mutedTextStyle}>{t("public.results.trackPrep")}</div>
      {displaySeconds != null && (
        <>
          <div style={paidWarmupTimerStyle}>
            {formatPaidWarmupTimer(displaySeconds)}
          </div>
          {remainingSeconds <= 0 ? (
            <div style={paidWarmupCueStyle("warn")}>
              {t("public.results.dragFinished")}
            </div>
          ) : (
            <div style={paidWarmupCueStyle("warn")}>
              {t("public.results.returnSoon")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PublicPaidWarmupEntry({ entry, remainingSeconds, warmup }) {
  const { t } = useTranslation();

  return (
    <div>
      <div style={runTitleStyle}>#{entry?.order || "—"}</div>
      <div style={runNameStyle}>
        {entry?.rider || t("public.results.riderFallback")}
      </div>
      {entry?.status && entry.status !== "pending" && (
        <div style={mutedTextStyle}>
          {getPaidWarmupStatusLabel(entry.status, t)}
        </div>
      )}
      {remainingSeconds != null && (
        <>
          <div style={paidWarmupTimerStyle}>
            {formatPaidWarmupTimer(remainingSeconds)}
          </div>
          {remainingSeconds <= 0 ? (
            <div style={paidWarmupCueStyle("danger")}>
              {t("public.results.timeOver")}
            </div>
          ) : remainingSeconds <= 60 ? (
            <div style={paidWarmupCueStyle("danger")}>
              {t("public.results.oneMinute")}
            </div>
          ) : remainingSeconds <= warmup.durationSeconds / 2 ? (
            <div style={paidWarmupCueStyle("warn")}>
              {t("public.results.halfTime")}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function PublicTimingSummary({ timing }) {
  const { t } = useTranslation();

  return (
    <div style={timingPanelStyle}>
      <div style={timingGridStyle}>
        <TimingMetric
          label={t("public.results.classEnd")}
          value={formatClockTime(timing?.classEstimatedEndAt)}
        />
        <TimingMetric
          label={t("public.results.dayEnd")}
          value={formatClockTime(timing?.dayEstimatedEndAt)}
        />
      </div>
      <div style={timingNoteStyle}>{t("public.results.timingNote")}</div>
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

function LiveRunBlock({
  label,
  run,
  showScore = false,
  showDetails = true,
  statusLabel = null,
  status = "waiting",
}) {
  return (
    <div style={liveBlockStyle}>
      <div style={liveBlockHeaderStyle}>
        {label && <div style={runLabelStyle}>{label}</div>}
        {run && statusLabel && (
          <span style={orderStatusBadgeStyle(status)}>{statusLabel}</span>
        )}
      </div>
      {run ? (
        <LiveRunCard
          run={run}
          showScore={showScore}
          showDetails={showDetails}
        />
      ) : (
        <div style={mutedTextStyle}>—</div>
      )}
    </div>
  );
}

function PublicLiveOrderTable({ runs, showScores }) {
  const { t } = useTranslation();

  if (!runs.length) {
    return null;
  }

  return (
    <div style={orderPanelStyle}>
      <div style={orderHeaderStyle}>
        <div style={runLabelStyle}>{t("public.results.orderOfGo")}</div>
        <div style={mutedTextStyle}>
          {t("public.results.passedWithScores")}
        </div>
      </div>
      <div style={orderListStyle}>
        {runs.map((run) => (
          <div key={run.id || run.draw} style={orderRowStyle}>
            <div style={orderDrawStyle}>#{run.draw || "—"}</div>
            <div style={orderIdentityStyle}>
              <div style={runNameStyle}>
                {run.rider || t("public.results.riderFallback")}
              </div>
              <div style={mutedTextStyle}>
                {t("public.results.backNumber")} {run.backNumber || "—"} ·{" "}
                {run.horse || t("public.results.horseFallback")}
              </div>
            </div>
            <span style={orderStatusBadgeStyle(run.liveOrderStatus)}>
              {getPublicRunOrderStatusLabel(run.liveOrderStatus, t)}
            </span>
            {showScores && run.scoreTotal ? (
              <LiveRunScore run={run} compact />
            ) : (
              <div style={orderScoreStyle}>—</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveRunCard({ run, showScore = true, showDetails = true }) {
  const { t } = useTranslation();

  return (
    <div>
      <div style={runTitleStyle}>
        #{run.draw} · {t("public.results.backNumber")} {run.backNumber || "—"}
      </div>
      <div style={runNameStyle}>{run.rider || t("public.results.riderFallback")}</div>
      <div style={mutedTextStyle}>
        {run.horse || t("public.results.horseFallback")}
      </div>
      {showScore && <LiveRunScore run={run} />}
      {showDetails && (
        <>
          <PublicRunNote note={run.note} />
          <ManoeuvreDetails run={run} />
        </>
      )}
    </div>
  );
}

function LiveRunScore({ run, compact = false }) {
  const { t } = useTranslation();
  const judgeScores = getVisibleJudgeScores(run);

  if (judgeScores.length <= 1) {
    return (
      <div style={compact ? orderScoreStyle : liveScoreStyle}>
        {run.scoreTotal || "—"}
      </div>
    );
  }

  return (
    <div style={compact ? judgeScoreCompactWrapStyle : judgeScoreWrapStyle}>
      <div style={compact ? judgeScoreCompactListStyle : judgeScoreListStyle}>
        {judgeScores.map((judgeScore, index) => (
          <span
            key={judgeScore.judgeId || `${judgeScore.judgeName}-${index}`}
            style={compact ? judgeScoreCompactItemStyle : judgeScoreItemStyle}
          >
            <span style={judgeScoreNameStyle}>
              {judgeScore.judgeName || t("public.results.judge")}
            </span>{" "}
            <span style={judgeScoreValueStyle}>{judgeScore.scoreTotal}</span>
          </span>
        ))}
      </div>
      <div style={compact ? orderScoreStyle : liveScoreStyle}>
        {t("public.results.totalScore")}: {run.scoreTotal || "—"}
      </div>
    </div>
  );
}

function getVisibleJudgeScores(run) {
  return (Array.isArray(run?.judgeScores) ? run.judgeScores : []).filter(
    (judgeScore) => String(judgeScore?.scoreTotal ?? "").trim()
  );
}

function PublicRunNote({ note }) {
  const { t } = useTranslation();
  const cleanNote = String(note || "").trim();

  if (!cleanNote) return null;

  return (
    <div style={runNotePublicStyle}>
      <div style={runLabelStyle}>{t("public.results.judgeNote")}</div>
      <div style={runNoteTextStyle}>{cleanNote}</div>
    </div>
  );
}

function ManoeuvreDetails({ run, showDescriptions = false }) {
  const { t } = useTranslation();
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
          {item.penalty && (
            <div style={detailPenaltyStyle}>
              {t("public.results.penaltyPrefix")} {item.penalty}
            </div>
          )}
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
    [run.backNumber, run.rider, run.horse, run.judgeName]
      .map(normalizeSearchText)
      .some((value) => value.includes(normalizedQuery))
  );
}

function getDragRemainingSeconds(dragBreak, now = new Date()) {
  if (!dragBreak) return null;

  const durationSeconds = Number(dragBreak.durationSeconds);
  const startedAt = Date.parse(dragBreak.startedAt);

  if (Number.isFinite(durationSeconds) && Number.isFinite(startedAt)) {
    return Math.round(durationSeconds - (now.getTime() - startedAt) / 1000);
  }

  const fallbackRemaining = Number(dragBreak.remainingSeconds);
  if (Number.isFinite(fallbackRemaining)) return fallbackRemaining;

  return Number.isFinite(durationSeconds) ? durationSeconds : null;
}

function getPublicPublicationStatusLabel(status, t) {
  switch (status) {
    case PUBLICATION_STATUSES.LIVE:
      return t("public.status.live");
    case PUBLICATION_STATUSES.LIVE_NO_SCORE:
      return t("public.status.liveNoScore");
    case PUBLICATION_STATUSES.LIVE_SCORING:
      return t("public.status.liveScoring");
    case PUBLICATION_STATUSES.LIVE_FINISHED:
      return t("public.status.liveFinished");
    case PUBLICATION_STATUSES.OFFICIAL:
      return t("public.status.official");
    case PUBLICATION_STATUSES.PUBLISHED:
      return t("public.status.published");
    case PUBLICATION_STATUSES.HIDDEN:
    default:
      return t("public.status.hidden");
  }
}

function getPaidWarmupStatusLabel(status, t) {
  switch (status) {
    case "done":
      return t("public.results.paidWarmupStatusDone");
    case "no_show":
      return t("public.results.paidWarmupStatusNoShow");
    case "scratch":
      return t("public.results.paidWarmupStatusScratch");
    case "pending":
      return t("public.results.paidWarmupStatusPending");
    default:
      return status;
  }
}

function getPublicRunOrderStatusLabel(status, t) {
  switch (status) {
    case "active":
      return t("public.results.statusOnCourse");
    case "waiting":
      return t("public.results.statusWaiting");
    case "preparation":
      return t("public.results.statusPreparation");
    case "passed":
      return t("public.results.statusPassed");
    case "upcoming":
    default:
      return t("public.results.statusUpcoming");
  }
}

function getScheduleDetailsSummary(details, t) {
  return getScheduleDetailsParts(details, t).join(" · ");
}

function getScheduleDetailsParts(details = {}, t) {
  const parts = [];
  const completedSectionCount = Number.parseInt(
    details.completedSectionCount,
    10
  );
  const sectionCount = Number.parseInt(details.sectionCount, 10) || 0;
  const isFinalInProgress =
    details.hasFinal &&
    !details.finalCompleted &&
    !details.isCompleted &&
    sectionCount > 0 &&
    completedSectionCount >= sectionCount;

  if (details.participantCount) {
    parts.push(
      t("public.results.participantCount", {
        count: details.participantCount,
      })
    );
  }

  if (details.sectionCount && details.sectionSize) {
    parts.push(
      t("public.results.sectionSummary", {
        sectionCount: details.sectionCount,
        sectionSize: details.sectionSize,
      })
    );
  } else if (details.sectionCount) {
    parts.push(
      t("public.results.sectionCount", {
        count: details.sectionCount,
      })
    );
  }

  if (Number.isFinite(completedSectionCount) && completedSectionCount > 0) {
    parts.push(
      t("public.results.sectionsCompleted", {
        count: completedSectionCount,
      })
    );
  }

  if (details.hasFinal) {
    parts.push(
      details.finalCompleted
        ? t("public.results.finalCompleted")
        : isFinalInProgress
          ? t("public.results.finalInProgress")
          : t("public.results.finalPlanned")
    );
  }

  if (details.isCompleted) {
    parts.push(t("management.classes.statusCompleted"));
  }

  if (String(details.note || "").trim()) {
    parts.push(String(details.note).trim());
  }

  return parts;
}

function getScheduleProgressLabel(details = {}, t) {
  const completedSectionCount =
    Number.parseInt(details.completedSectionCount, 10) || 0;
  const sectionCount = Number.parseInt(details.sectionCount, 10) || 0;

  if (details.isCompleted) {
    return t("management.classes.statusCompleted");
  }

  if (details.hasFinal && details.finalCompleted) {
    return t("public.results.finalCompleted");
  }

  if (details.hasFinal && sectionCount > 0 && completedSectionCount >= sectionCount) {
    return t("public.results.finalInProgress");
  }

  if (completedSectionCount > 0 && sectionCount > 0) {
    return t("public.results.sectionProgress", {
      completed: completedSectionCount,
      total: sectionCount,
    });
  }

  return t("public.results.classInProgress");
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

function LiveFreshnessBadge({ updatedAt, now }) {
  const { t } = useTranslation();
  const freshness = formatLiveDataFreshness(updatedAt, now, t);

  return <span style={freshnessBadgeStyle(freshness.tone)}>{freshness.label}</span>;
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

const heroBrandStyle = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  minWidth: 0,
};

const heroActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
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
  overflowWrap: "anywhere",
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

const summarySubLabelStyle = {
  color: "#166534",
  marginTop: 4,
  fontSize: 13,
};

const liveStackStyle = {
  display: "grid",
  gap: 12,
};

const livePanelStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
  border: "1px solid #bbf7d0",
};

const livePanelToggleStyle = (isOpen) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: isOpen ? 12 : 0,
  cursor: "pointer",
  outlineOffset: 4,
});

const badgeStackStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const noScoreNoticeStyle = {
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  padding: 10,
  background: "#eff6ff",
  color: "#1e3a8a",
  fontWeight: 800,
  marginBottom: 12,
};

const scheduleOnlyPanelStyle = {
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  padding: 14,
  background: "#f8fafc",
  marginBottom: 12,
};

const scheduleOnlyDetailListStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 10,
};

const scheduleOnlyProgressStyle = {
  color: "#1d4ed8",
  fontWeight: 900,
  marginTop: 6,
};

const scheduleOnlyDetailStyle = {
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "6px 9px",
  background: "#fff",
  color: "#334155",
  fontWeight: 800,
};

const liveGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
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

const liveBlockHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const orderPanelStyle = {
  borderTop: "1px solid #e2e8f0",
  marginTop: 14,
  paddingTop: 14,
};

const orderHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 10,
};

const orderListStyle = {
  display: "grid",
  gap: 8,
};

const orderRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
};

const orderDrawStyle = {
  width: 48,
  flex: "0 0 48px",
  fontWeight: 900,
  color: "#0f172a",
};

const orderIdentityStyle = {
  flex: "1 1 220px",
  minWidth: 0,
};

const orderScoreStyle = {
  minWidth: 72,
  textAlign: "right",
  fontSize: 20,
  fontWeight: 900,
  color: "#111827",
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

const judgeLineStyle = {
  display: "inline-flex",
  marginTop: 6,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 12,
  fontWeight: 800,
};

const liveScoreStyle = {
  fontSize: 28,
  fontWeight: 900,
  marginTop: 8,
};

const judgeScoreWrapStyle = {
  display: "grid",
  gap: 8,
  marginTop: 8,
};

const judgeScoreListStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const judgeScoreItemStyle = {
  display: "inline-flex",
  gap: 4,
  alignItems: "baseline",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "5px 8px",
  background: "#f8fafc",
};

const judgeScoreNameStyle = {
  color: "#475569",
  fontSize: 12,
  fontWeight: 800,
};

const judgeScoreValueStyle = {
  color: "#111827",
  fontWeight: 900,
};

const judgeScoreCompactWrapStyle = {
  display: "grid",
  gap: 3,
  minWidth: 150,
  textAlign: "right",
};

const judgeScoreCompactListStyle = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const judgeScoreCompactItemStyle = {
  display: "inline-flex",
  gap: 3,
  alignItems: "baseline",
  color: "#475569",
  fontSize: 11,
  fontWeight: 800,
};

const runNotePublicStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 10,
  background: "#f8fafc",
  marginTop: 10,
};

const runNoteTextStyle = {
  color: "#334155",
  whiteSpace: "pre-wrap",
  lineHeight: 1.4,
};

const paidWarmupTimerStyle = {
  fontSize: 30,
  fontWeight: 900,
  marginTop: 8,
};

const paidWarmupNoticeStyle = {
  border: "1px solid #fde68a",
  borderRadius: 8,
  padding: 10,
  background: "#fefce8",
  color: "#854d0e",
  fontWeight: 800,
  marginBottom: 12,
};

const paidWarmupCueStyle = (tone) => ({
  display: "inline-flex",
  marginTop: 8,
  padding: "6px 9px",
  borderRadius: 999,
  border: `1px solid ${tone === "danger" ? "#fecaca" : "#fdba74"}`,
  background: tone === "danger" ? "#fff5f5" : "#fff7ed",
  color: tone === "danger" ? "#991b1b" : "#9a3412",
  fontWeight: 800,
  fontSize: 13,
});

const detailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 72px), 1fr))",
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

const orderStatusBadgeStyle = (status) => {
  const colors = getOrderStatusColors(status);

  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 26,
    padding: "4px 9px",
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.color,
    fontWeight: 800,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
};

function getOrderStatusColors(status) {
  if (status === "active") {
    return {
      border: "#fdba74",
      background: "#fff7ed",
      color: "#9a3412",
    };
  }

  if (status === "waiting") {
    return {
      border: "#93c5fd",
      background: "#eff6ff",
      color: "#1d4ed8",
    };
  }

  if (status === "preparation") {
    return {
      border: "#fde68a",
      background: "#fefce8",
      color: "#854d0e",
    };
  }

  if (status === "passed") {
    return {
      border: "#86efac",
      background: "#ecfdf5",
      color: "#166534",
    };
  }

  return {
    border: "#cbd5e1",
    background: "#fff",
    color: "#475569",
  };
}

const freshnessBadgeStyle = (tone) => {
  const colors = getFreshnessColors(tone);

  return {
    ...badgeStyle,
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.color,
  };
};

function getFreshnessColors(tone) {
  if (tone === "success") {
    return {
      border: "#86efac",
      background: "#ecfdf5",
      color: "#166534",
    };
  }

  if (tone === "danger") {
    return {
      border: "#fecaca",
      background: "#fff5f5",
      color: "#991b1b",
    };
  }

  if (tone === "warn") {
    return {
      border: "#fdba74",
      background: "#fff7ed",
      color: "#9a3412",
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
  maxWidth: "100%",
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
