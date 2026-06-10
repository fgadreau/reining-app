import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import SeoMeta from "../../components/SeoMeta";
import ShareButton from "../../components/ShareButton";
import {
  getPublicAssociationRepository,
  getPublicShowRepository,
  getPublicShowView,
  getPublicShowViewRepository,
  subscribePublicShowViewRepository,
} from "../../features/publication/publicViewRepository";
import {
  formatClockTime,
  formatDuration,
} from "../../features/classes/classTiming";
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
import {
  buildLivestreamEmbed,
  hasPublicLivestream,
} from "../../features/livestream/livestreamEmbed";
import {
  seedClassResultsDemo,
  shouldSeedClassResultsDemo,
} from "../../features/demo/classResultsDemo";
import { buildShowPublicSeo } from "../../features/seo/publicSeo";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import {
  buildClassResultsPdfFileName,
  generateClassResultsPdf,
} from "../../utils/generateResultsPdf";
import {
  publicBadgeStyle,
  publicCardStyle,
  publicColors,
  publicEmptyStateStyle,
  publicEyebrowStyle,
  publicHeroStyle,
  publicMutedTextStyle,
  publicPageStyle,
  publicSecondaryActionStyle,
  publicSubtitleStyle,
  publicTitleStyle,
} from "../../styles/publicStyles";

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
  const [isVideoOpen, setIsVideoOpen] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const { t } = useTranslation();
  const publicClassIdsKey = (publicView.classIds || []).join("|");
  const liveClasses = Array.isArray(publicView.liveClasses)
    ? publicView.liveClasses
    : publicView.liveClass
      ? [publicView.liveClass]
      : [];
  const scheduleSections = Array.isArray(publicView.scheduleSections)
    ? publicView.scheduleSections
    : [];
  const resultSections = Array.isArray(publicView.resultSections)
    ? publicView.resultSections
    : [];
  const hasLiveClass = Boolean(liveClasses.length || publicView.livePaidWarmup);
  const hasLivestreamVideo = hasPublicLivestream(show);
  const canonicalPublicPath = `/public/associations/${associationId}/shows/${showId}`;
  const seo = useMemo(
    () => buildShowPublicSeo({ association, show, t }),
    [association, show, t]
  );

  useEffect(() => {
    if (!shouldSeedClassResultsDemo(location.search)) return;

    const { publicUrl } = seedClassResultsDemo();
    window.location.replace(publicUrl);
  }, [location.search]);

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
      <div style={publicPageStyle}>
        <SeoMeta
          title={seo.title}
          description={seo.description}
          canonicalPath={canonicalPublicPath}
          imageUrl={association?.logoDataUrl}
          robots={isPublicRoute ? "index,follow" : "noindex,follow"}
        />
        <button onClick={() => navigate(-1)} style={secondaryButtonStyle}>
          {t("public.results.back")}
        </button>
        <div style={emptyStateStyle}>{t("public.results.showNotFound")}</div>
      </div>
    );
  }

  return (
    <div style={publicPageStyle}>
      <SeoMeta
        title={seo.title}
        description={seo.description}
        canonicalPath={canonicalPublicPath}
        imageUrl={association?.logoDataUrl}
        robots={isPublicRoute ? "index,follow" : "noindex,follow"}
      />
      <div style={navBackRowStyle}>
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

      {hasLivestreamVideo && (
        <PublicLivestreamPanel
          show={show}
          isOpen={isVideoOpen}
          onToggle={() => setIsVideoOpen((current) => !current)}
        />
      )}

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

      {scheduleSections.length > 0 && (
        <PublicScheduleSections sections={scheduleSections} />
      )}

      <section style={summaryStyle}>
        <div style={summaryValueStyle}>
          {(publicView.publishedResultClassCount || 0) +
            (publicView.publishedClassCount || 0)}
        </div>
        <div style={summaryLabelStyle}>{t("public.results.publishedContent")}</div>
        {publicView.publishedResultClassCount > 0 && (
          <div style={summarySubLabelStyle}>
            {t("public.results.publishedResults", {
              count: publicView.publishedResultClassCount,
            })}
          </div>
        )}
        {publicView.liveClassCount > 0 && (
          <div style={summarySubLabelStyle}>
            {t("public.results.liveActive", {
              count: publicView.liveClassCount,
            })}
          </div>
        )}
        {(publicView.scheduleItemCount || 0) > 0 && (
          <div style={summarySubLabelStyle}>
            {t("public.results.scheduleItems", {
              count: publicView.scheduleItemCount,
            })}
          </div>
        )}
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("public.results.loading")}</div>
      ) : publicView.sections.length === 0 &&
        resultSections.length === 0 &&
        scheduleSections.length === 0 ? (
        <div style={emptyStateStyle}>{t("public.results.noSheets")}</div>
      ) : publicView.sections.length > 0 || resultSections.length > 0 ? (
        <div style={{ display: "grid", gap: 16 }}>
          {resultSections.map((section) => {
            const resultBlocks = groupResultClassesByBlock(section.classes);

            return (
              <section key={`results-${section.day.id}`} style={cardStyle}>
                <div style={sectionHeaderStyle}>
                  <div>
                    <h2 style={sectionTitleStyle}>
                      {t("public.results.resultsTitle")} ·{" "}
                      {section.day.label || t("public.results.day")}
                    </h2>
                    <div style={mutedTextStyle}>
                      {section.day.date || t("public.results.dateTbd")}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  {resultBlocks.map((resultBlock) => (
                    <PublicResultBlock
                      key={resultBlock.id}
                      association={association}
                      show={show}
                      day={section.day}
                      resultBlock={resultBlock}
                    />
                  ))}
                </div>
              </section>
            );
          })}

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
      ) : null}
    </div>
  );
}

function PublicScheduleSections({ sections }) {
  const { t } = useTranslation();

  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>{t("public.results.scheduleEyebrow")}</div>
          <h2 style={sectionTitleStyle}>{t("public.results.scheduleTitle")}</h2>
          <div style={mutedTextStyle}>
            {t("public.results.scheduleHelp")}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {sections.map((section) => (
          <div key={section.day.id || section.day.date} style={scheduleDayStyle}>
            <div style={scheduleDayHeaderStyle}>
              <div>
                <h3 style={scheduleDayTitleStyle}>
                  {section.day.label || t("public.results.day")}
                </h3>
                <div style={mutedTextStyle}>
                  {section.day.date || t("public.results.dateTbd")}
                </div>
              </div>
              {section.summary?.estimatedEndAt && (
                <div style={scheduleDayEndStyle}>
                  {t("public.results.dayEnd")}{" "}
                  <strong>{formatClockTime(section.summary.estimatedEndAt)}</strong>
                </div>
              )}
            </div>

            <div style={resultTableWrapStyle}>
              <table style={scheduleTableStyle}>
                <thead>
                  <tr>
                    <th style={scheduleThStyle}>
                      {t("public.results.scheduleStart")}
                    </th>
                    <th style={scheduleThStyle}>{t("public.results.sourceBlock")}</th>
                    <th style={scheduleThStyle}>{t("management.schedulePreview.type")}</th>
                    <th style={scheduleThStyle}>{t("public.results.pattern")}</th>
                    <th style={scheduleThStyle}>{t("management.schedulePreview.draw")}</th>
                    <th style={scheduleThStyle}>
                      {t("management.schedulePreview.estimatedDuration")}
                    </th>
                    <th style={scheduleThStyle}>{t("management.time.estimatedEndHeader")}</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={`${row.itemType || "class"}-${row.classId}`}>
                      <td style={scheduleTdStyle}>
                        <strong>{formatPublicScheduleClock(row.estimatedStartAt, t)}</strong>
                        <div style={mutedTextStyle}>
                          {getPublicScheduleStartLabel(row, t)}
                        </div>
                      </td>
                      <td style={scheduleTdStyle}>{row.className}</td>
                      <td style={scheduleTdStyle}>{getPublicScheduleTypeLabel(row, t)}</td>
                      <td style={scheduleTdStyle}>{row.pattern || "—"}</td>
                      <td style={scheduleTdStyle}>{getPublicScheduleDrawLabel(row, t)}</td>
                      <td style={scheduleTdStyle}>
                        {formatDuration(row.estimatedDurationSeconds)}
                      </td>
                      <td style={scheduleTdStyle}>
                        {formatPublicScheduleClock(row.estimatedEndAt, t)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getPublicScheduleStartLabel(row, t) {
  if (row.scheduleStartMode === "fixed") {
    return row.plannedStartAt
      ? t("management.time.fixedStart")
      : t("management.classes.startFixedMissing");
  }

  return t("management.time.afterPrevious");
}

function formatPublicScheduleClock(value, t) {
  const formatted = formatClockTime(value);
  return formatted === "—" ? t("management.schedulePreview.toConfirm") : formatted;
}

function getPublicScheduleTypeLabel(row, t) {
  return row.itemType === "paid_warmup"
    ? t("public.results.paidWarmup")
    : t("common.class");
}

function getPublicScheduleDrawLabel(row, t) {
  if (row.itemType === "paid_warmup") {
    return t("management.schedulePreview.riderCount", {
      count: row.runCount || 0,
    });
  }

  return row.runCount > 0
    ? t("management.schedulePreview.drawCount", { count: row.runCount })
    : t("management.schedulePreview.drawPending");
}

function PublicLivestreamPanel({ show, isOpen, onToggle }) {
  const { t } = useTranslation();
  const embed = buildLivestreamEmbed(show?.livestreamUrl);

  return (
    <section style={livestreamPanelStyle}>
      <div style={livestreamHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>{t("public.results.videoLiveLabel")}</div>
          <h2 style={sectionTitleStyle}>
            {t("public.results.videoLiveTitle")}
          </h2>
          <div style={mutedTextStyle}>
            {t("public.results.videoLiveHelp")}
          </div>
        </div>
        <div style={badgeStackStyle}>
          {embed.providerLabel && <Badge>{embed.providerLabel}</Badge>}
          <button type="button" onClick={onToggle} style={smallButtonStyle}>
            {isOpen
              ? t("public.results.hideVideo")
              : t("public.results.showVideo")}
          </button>
        </div>
      </div>

      {isOpen && (
        embed.canEmbed ? (
          <div style={livestreamFrameWrapStyle}>
            <iframe
              title={t("public.results.videoLiveTitle")}
              src={embed.embedUrl}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              style={livestreamFrameStyle}
            />
          </div>
        ) : (
          <div style={livestreamFallbackStyle}>
            <div style={mutedTextStyle}>
              {t("public.results.videoExternalOnly")}
            </div>
            <a
              href={embed.externalUrl}
              target="_blank"
              rel="noreferrer"
              style={linkButtonStyle}
            >
              {t("public.results.openVideo")}
            </a>
          </div>
        )
      )}
    </section>
  );
}

function PublicClassResults({ association, show, classView, isOpen, onToggle }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRunIds, setExpandedRunIds] = useState(() => new Set());
  const { t } = useTranslation();
  const filteredRuns = useMemo(
    () => filterRunsBySearch(classView.runs, searchQuery),
    [classView.runs, searchQuery]
  );

  function toggleRunDetails(run, index) {
    const runKey = getPublicRunKey(run, index);

    setExpandedRunIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(runKey)) {
        nextIds.delete(runKey);
      } else {
        nextIds.add(runKey);
      }

      return nextIds;
    });
  }

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
      className: classView.className || "block",
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
              <div style={resultsSummaryLabelStyle}>
                {t("public.results.resultsSummary")}
              </div>
              {filteredRuns.map((run, index) => {
                const runKey = getPublicRunKey(run, index);

                return (
                  <PublicScoresheetRun
                    key={runKey}
                    run={run}
                    isExpanded={expandedRunIds.has(runKey)}
                    onToggleDetails={() => toggleRunDetails(run, index)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PublicResultBlock({ association, show, day, resultBlock }) {
  const { t } = useTranslation();

  const downloadBlockPdf = () => {
    const publishedAt =
      resultBlock.classes.find((classView) => classView.publishedAt)
        ?.publishedAt || null;
    const pdf = generateClassResultsPdf({
      associationName: association?.name || t("common.association"),
      associationLogoDataUrl: association?.logoDataUrl || null,
      eventName: show?.name || "",
      eventDate: day?.date || show?.startDate || "",
      blockName: resultBlock.blockName,
      pattern: resultBlock.pattern,
      publishedAt,
      resultGroups: resultBlock.classes,
    });
    const fileName = buildClassResultsPdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: show?.name || "show",
      blockName: resultBlock.blockName || "results",
      publishedAt,
    });

    pdf.save(fileName);
  };

  return (
    <section style={resultBlockStyle}>
      <div style={resultBlockHeaderStyle}>
        <div>
          <h3 style={classTitleStyle}>
            {resultBlock.blockName || t("public.results.resultsTitle")}
          </h3>
          <div style={mutedTextStyle}>
            {t("public.results.publishedResultClasses", {
              count: resultBlock.classes.length,
            })}
            {resultBlock.pattern
              ? ` · ${t("public.results.pattern")} ${resultBlock.pattern}`
              : ""}
          </div>
        </div>
        <button type="button" onClick={downloadBlockPdf} style={smallButtonStyle}>
          {t("public.results.downloadBlockResultsPdf")}
        </button>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {resultBlock.classes.map((classView) => (
          <PublicClassResultStandings key={classView.id} classView={classView} />
        ))}
      </div>
    </section>
  );
}

function PublicClassResultStandings({ classView }) {
  const { t } = useTranslation();

  return (
    <section style={classCardStyle}>
      <div style={resultClassHeaderStyle}>
        <div>
          <h3 style={classTitleStyle}>
            {classView.className}
            {classView.classCode ? ` (${classView.classCode})` : ""}
          </h3>
          <div style={mutedTextStyle}>
            {classView.parentClassName &&
            classView.parentClassName !== classView.className
              ? `${t("public.results.sourceBlock")} ${classView.parentClassName}`
              : t("public.results.officialResults")}
            {classView.pattern
              ? ` · ${t("public.results.pattern")} ${classView.pattern}`
              : ""}
          </div>
        </div>
        <Badge>{t("public.results.resultsBadge")}</Badge>
      </div>

      <div style={resultTableWrapStyle}>
        <table style={resultTableStyle}>
          <thead>
            <tr>
              <th style={resultThStyle}>{t("public.results.rank")}</th>
              <th style={resultThStyle}>{t("public.results.backNumber")}</th>
              <th style={resultThStyle}>{t("public.results.rider")}</th>
              <th style={resultThStyle}>{t("public.results.horse")}</th>
              <th style={resultThStyle}>{t("public.results.owner")}</th>
              <th style={resultThStyle}>{t("public.results.score")}</th>
            </tr>
          </thead>
          <tbody>
            {classView.entries.map((entry) => (
              <tr key={`${entry.id}-${entry.rank}`}>
                <td style={resultTdStyle}>{entry.rank}</td>
                <td style={resultTdStyle}>{entry.backNumber || "—"}</td>
                <td style={resultTdStyle}>
                  <div style={runNameStyle}>
                    {entry.rider || t("public.results.riderFallback")}
                  </div>
                </td>
                <td style={resultTdStyle}>
                  {entry.horse || t("public.results.horseFallback")}
                </td>
                <td style={resultTdStyle}>{entry.owner || "—"}</td>
                <td style={resultTdStyle}>
                  <span style={scoreValueStyle}>
                    {entry.scoreTotal || entry.status || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function groupResultClassesByBlock(classes) {
  const groupsById = new Map();

  (Array.isArray(classes) ? classes : []).forEach((classView) => {
    const blockId =
      classView.sourceClassId ||
      classView.parentClassName ||
      classView.id ||
      "results";
    const blockName =
      classView.parentClassName || classView.className || "Résultats";

    if (!groupsById.has(blockId)) {
      groupsById.set(blockId, {
        id: blockId,
        blockName,
        pattern: classView.pattern || "",
        classes: [],
      });
    }

    const group = groupsById.get(blockId);
    group.classes.push(classView);
    if (!group.pattern && classView.pattern) {
      group.pattern = classView.pattern;
    }
  });

  return Array.from(groupsById.values());
}

function getPublicRunKey(run, index) {
  return run.id
    ? `${run.id}-${run.judgeId || run.judgeName || index}`
    : `${run.draw}-${run.backNumber}-${run.judgeId || index}`;
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

function PublicScoresheetRun({ run, isExpanded, onToggleDetails }) {
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

      <div style={runDetailActionRowStyle}>
        <button
          type="button"
          onClick={onToggleDetails}
          style={smallButtonStyle}
          aria-expanded={isExpanded}
        >
          {isExpanded
            ? t("public.results.hideDetails")
            : t("public.results.viewDetails")}
        </button>
      </div>

      {isExpanded && (
        <div style={runDetailsPanelStyle}>
          <div style={runMetaGridStyle}>
            {run.owner && (
              <div style={runMetaItemStyle}>
                <span style={runLabelStyle}>{t("public.results.owner")}</span>
                <span>{run.owner}</span>
              </div>
            )}
            {run.judgeName && (
              <div style={runMetaItemStyle}>
                <span style={runLabelStyle}>{t("public.results.judge")}</span>
                <span>{run.judgeName}</span>
              </div>
            )}
          </div>
          <PublicRunNote note={run.note} />
          <ManoeuvreDetails run={run} showDescriptions />
        </div>
      )}
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
                label={t("public.results.nextParticipant")}
                run={nextRun}
                showDetails={showScoreDetails}
                statusLabel={t("public.results.statusPreparation")}
                status="preparation"
              />
              <LiveRunBlock
                label={t("public.results.secondNextParticipant")}
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
  const secondNextEntry = warmup.secondNextEntry;
  const statusLabel = isDragDue
    ? t("public.results.drag")
    : warmup.activeEntry
      ? t("public.results.inProgress")
      : t("public.results.paidWarmupStatusPending");

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
          <Badge>{statusLabel}</Badge>
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

        <PublicPaidWarmupEntryBlock
          label={t("public.results.nextParticipant")}
          entry={warmup.nextEntry}
          statusLabel={t("public.results.statusPreparation")}
          status="preparation"
        />

        <PublicPaidWarmupEntryBlock
          label={t("public.results.secondNextParticipant")}
          entry={secondNextEntry}
          statusLabel={t("public.results.statusWaiting")}
          status="waiting"
        />

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

function PublicPaidWarmupEntryBlock({ label, entry, statusLabel, status }) {
  return (
    <div style={liveBlockStyle}>
      <div style={liveBlockHeaderStyle}>
        <div style={runLabelStyle}>{label}</div>
        {entry && (
          <span style={orderStatusBadgeStyle(status)}>{statusLabel}</span>
        )}
      </div>
      {entry ? (
        <PublicPaidWarmupEntry entry={entry} />
      ) : (
        <div style={mutedTextStyle}>—</div>
      )}
    </div>
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
            <div style={orderRowMetaStyle}>
              <span style={orderStatusBadgeStyle(run.liveOrderStatus)}>
                {getPublicRunOrderStatusLabel(run.liveOrderStatus, t)}
              </span>
              {showScores && run.scoreTotal ? (
                <LiveRunScore run={run} compact />
              ) : (
                <div style={orderScoreStyle}>—</div>
              )}
            </div>
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
  return <span style={publicBadgeStyle("live")}>{children}</span>;
}

function LiveFreshnessBadge({ updatedAt, now }) {
  const { t } = useTranslation();
  const freshness = formatLiveDataFreshness(updatedAt, now, t);

  return <span style={freshnessBadgeStyle(freshness.tone)}>{freshness.label}</span>;
}

const navBackRowStyle = {
  marginBottom: 10,
};

const heroStyle = {
  ...publicHeroStyle,
  marginBottom: 12,
};

const heroBrandStyle = {
  display: "flex",
  gap: 12,
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
  ...publicEyebrowStyle,
};

const titleStyle = {
  ...publicTitleStyle,
  fontSize: 29,
};

const subtitleStyle = {
  ...publicSubtitleStyle,
};

const summaryStyle = {
  background: publicColors.greenSoft,
  border: `1px solid ${publicColors.greenBorder}`,
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
  display: "grid",
  gap: 2,
};

const summaryValueStyle = {
  fontSize: 26,
  fontWeight: 950,
  color: publicColors.green,
};

const summaryLabelStyle = {
  color: publicColors.green,
  fontWeight: 750,
};

const summarySubLabelStyle = {
  color: publicColors.green,
  fontSize: 13,
};

const liveStackStyle = {
  display: "grid",
  gap: 12,
};

const livePanelStyle = {
  ...publicCardStyle,
  padding: 14,
  marginBottom: 12,
  border: `1px solid ${publicColors.greenBorder}`,
};

const livestreamPanelStyle = {
  ...publicCardStyle,
  padding: 14,
  marginBottom: 12,
  border: "1px solid #bfdbfe",
};

const livestreamHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const livestreamFrameWrapStyle = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  background: "#020617",
  borderRadius: 8,
  overflow: "hidden",
};

const livestreamFrameStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: 0,
};

const livestreamFallbackStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 12,
  background: publicColors.surfaceSoft,
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
  gap: 7,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const noScoreNoticeStyle = {
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  padding: 11,
  background: publicColors.blueSoft,
  color: "#1e3a8a",
  fontWeight: 800,
  marginBottom: 12,
};

const scheduleOnlyPanelStyle = {
  border: "1px solid #bfdbfe",
  borderRadius: 8,
  padding: 14,
  background: publicColors.surfaceSoft,
  marginBottom: 12,
};

const scheduleOnlyDetailListStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 10,
};

const scheduleOnlyProgressStyle = {
  color: publicColors.blue,
  fontWeight: 900,
  marginTop: 6,
};

const scheduleOnlyDetailStyle = {
  display: "inline-flex",
  alignItems: "center",
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: "6px 9px",
  background: publicColors.surface,
  color: publicColors.softText,
  fontWeight: 800,
};

const liveGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: 12,
};

const timingPanelStyle = {
  border: "1px solid #dbeafe",
  background: publicColors.blueSoft,
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
  background: publicColors.surface,
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
  color: publicColors.softText,
  fontSize: 13,
  marginTop: 10,
};

const liveBlockStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 11,
  minHeight: 104,
  background: publicColors.surface,
};

const liveBlockHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const orderPanelStyle = {
  borderTop: `1px solid ${publicColors.border}`,
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
  gap: 7,
};

const orderRowStyle = {
  display: "grid",
  gridTemplateColumns: "42px minmax(0, 1fr)",
  alignItems: "center",
  gap: 8,
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 9,
  background: publicColors.surfaceSoft,
};

const orderDrawStyle = {
  width: 42,
  fontWeight: 900,
  color: publicColors.text,
};

const orderIdentityStyle = {
  minWidth: 0,
};

const orderRowMetaStyle = {
  gridColumn: "1 / -1",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const orderScoreStyle = {
  minWidth: 60,
  textAlign: "left",
  fontSize: 18,
  fontWeight: 900,
  color: publicColors.text,
};

const runLabelStyle = {
  color: publicColors.muted,
  fontWeight: 850,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
  marginBottom: 6,
};

const runTitleStyle = {
  fontWeight: 900,
  color: publicColors.text,
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
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: "5px 8px",
  background: publicColors.surfaceSoft,
};

const judgeScoreNameStyle = {
  color: publicColors.softText,
  fontSize: 12,
  fontWeight: 800,
};

const judgeScoreValueStyle = {
  color: publicColors.text,
  fontWeight: 900,
};

const judgeScoreCompactWrapStyle = {
  display: "grid",
  gap: 3,
  minWidth: 0,
  textAlign: "left",
};

const judgeScoreCompactListStyle = {
  display: "flex",
  gap: 4,
  flexWrap: "wrap",
  justifyContent: "flex-start",
};

const judgeScoreCompactItemStyle = {
  display: "inline-flex",
  gap: 3,
  alignItems: "baseline",
  color: publicColors.softText,
  fontSize: 11,
  fontWeight: 800,
};

const runNotePublicStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 10,
  background: publicColors.surfaceSoft,
  marginTop: 10,
};

const runNoteTextStyle = {
  color: publicColors.softText,
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
  background: publicColors.amberSoft,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 92px), 1fr))",
  gap: 6,
  marginTop: 10,
};

const detailCellStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 6,
  padding: 8,
  minHeight: 48,
};

const detailNameStyle = {
  color: publicColors.muted,
  fontSize: 12,
  fontWeight: 800,
};

const detailDescriptionStyle = {
  color: publicColors.softText,
  fontSize: 12,
  marginTop: 3,
  lineHeight: 1.3,
};

const detailScoreStyle = {
  fontWeight: 900,
  marginTop: 4,
};

const detailPenaltyStyle = {
  color: publicColors.red,
  fontSize: 12,
  fontWeight: 800,
  marginTop: 2,
};

const cardStyle = {
  ...publicCardStyle,
  padding: 14,
};

const sectionHeaderStyle = {
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const classCardStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 12,
  background: publicColors.surface,
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

const resultClassHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 10,
};

const resultBlockStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 12,
  background: publicColors.surfaceSoft,
};

const resultBlockHeaderStyle = {
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
  ...publicSecondaryActionStyle,
  minHeight: 34,
  padding: "7px 10px",
  fontSize: 13,
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
  color: publicColors.softText,
  fontWeight: 800,
  marginBottom: 12,
};

const searchInputStyle = {
  width: "100%",
  padding: "12px 13px",
  borderRadius: 8,
  border: `1px solid ${publicColors.borderStrong}`,
  boxSizing: "border-box",
  fontSize: 16,
};

const scoresheetListStyle = {
  display: "grid",
  gap: 9,
};

const scheduleDayStyle = {
  borderTop: `1px solid ${publicColors.border}`,
  paddingTop: 12,
};

const scheduleDayHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
};

const scheduleDayTitleStyle = {
  margin: 0,
  fontSize: 18,
};

const scheduleDayEndStyle = {
  color: publicColors.softText,
  fontWeight: 750,
};

const scheduleTableStyle = {
  width: "100%",
  minWidth: 820,
  borderCollapse: "collapse",
};

const scheduleThStyle = {
  padding: "8px 9px",
  textAlign: "left",
  borderBottom: `1px solid ${publicColors.border}`,
  color: publicColors.softText,
  fontSize: 12,
  textTransform: "uppercase",
};

const scheduleTdStyle = {
  padding: "9px",
  borderBottom: `1px solid ${publicColors.border}`,
  verticalAlign: "top",
};

const resultTableWrapStyle = {
  overflowX: "auto",
};

const resultTableStyle = {
  width: "100%",
  minWidth: 620,
  borderCollapse: "collapse",
};

const resultThStyle = {
  padding: "8px 9px",
  textAlign: "left",
  borderBottom: `1px solid ${publicColors.border}`,
  color: publicColors.softText,
  fontSize: 12,
  textTransform: "uppercase",
};

const resultTdStyle = {
  padding: "9px",
  borderBottom: `1px solid ${publicColors.border}`,
  verticalAlign: "top",
};

const resultsSummaryLabelStyle = {
  color: publicColors.softText,
  fontWeight: 850,
  fontSize: 13,
  lineHeight: 1.35,
};

const scoresheetRunStyle = {
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  padding: 10,
  background: publicColors.surface,
};

const scoresheetRunHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 10,
};

const runDetailActionRowStyle = {
  display: "flex",
  justifyContent: "flex-end",
};

const runDetailsPanelStyle = {
  borderTop: `1px solid ${publicColors.border}`,
  marginTop: 10,
  paddingTop: 10,
};

const runMetaGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
  gap: 8,
  marginBottom: 10,
};

const runMetaItemStyle = {
  display: "grid",
  gap: 2,
  color: publicColors.softText,
  fontWeight: 750,
};

const runTotalsStyle = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const scoreValueStyle = {
  minWidth: 70,
  border: "1px solid #dbeafe",
  borderRadius: 8,
  padding: "7px 9px",
  background: publicColors.blueSoft,
  color: "#1e3a8a",
  fontWeight: 900,
  fontSize: 18,
  textAlign: "center",
};

const penaltyValueStyle = {
  minWidth: 70,
  border: "1px solid #fee2e2",
  borderRadius: 8,
  padding: "7px 9px",
  background: publicColors.redSoft,
  color: publicColors.red,
  fontWeight: 900,
  fontSize: 18,
  textAlign: "center",
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
    ...publicBadgeStyle("neutral"),
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
  ...publicSecondaryActionStyle,
  maxWidth: "100%",
};

const secondaryButtonStyle = {
  ...publicSecondaryActionStyle,
};

const mutedTextStyle = {
  ...publicMutedTextStyle,
  fontSize: 13,
};

const emptyStateStyle = {
  ...publicEmptyStateStyle,
  marginTop: 16,
};

const softEmptyStyle = {
  border: `1px dashed ${publicColors.borderStrong}`,
  borderRadius: 8,
  padding: 14,
  color: publicColors.muted,
};

export default PublicResultsPage;
