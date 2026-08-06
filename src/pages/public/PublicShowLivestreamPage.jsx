import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import SeoMeta from "../../components/SeoMeta";
import ShareButton from "../../components/ShareButton";
import { formatDayLabel } from "../../features/days/dayDateUtils";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { buildLivestreamEmbed } from "../../features/livestream/livestreamEmbed";
import {
  getCurrentPublicLivestream,
  getNextPublicLivestream,
  getPreviousPublicLivestreams,
} from "../../features/livestream/livestreamSchedule";
import {
  getPublicAssociationRepository,
  getPublicShowView,
  getPublicShowViewRepository,
} from "../../features/publication/publicViewRepository";
import { usePublicShowViewUpdates } from "../../features/publication/usePublicShowViewUpdates";
import { buildShowPublicSeo } from "../../features/seo/publicSeo";
import { partitionScheduledLiveViews } from "../../features/schedule/liveSchedule";
import { getShowById } from "../../features/shows/showSelectors";
import {
  publicCardStyle,
  publicColors,
  publicEmptyStateStyle,
  publicEyebrowStyle,
  publicHeroStyle,
  publicMutedTextStyle,
  publicPageStyle,
  publicPrimaryActionStyle,
  publicSecondaryActionStyle,
  publicSubtitleStyle,
  publicTitleStyle,
} from "../../styles/publicStyles";

function PublicShowLivestreamPage() {
  const { associationId, showId } = useParams();
  const { t, language } = useTranslation();
  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(() => getShowById(showId));
  const [publicView, setPublicView] = useState(() => getPublicShowView(showId));
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const canonicalPath = `/public/associations/${associationId}/shows/${showId}/livestream`;
  const resultsPath = `/public/associations/${associationId}/shows/${showId}`;
  const seo = useMemo(
    () => buildShowPublicSeo({ association, show, t }),
    [association, show, t]
  );
  const livestream = getCurrentPublicLivestream(show, {
    timezone: association?.timezone,
    now,
  });
  const embed = buildLivestreamEmbed(livestream.url);
  const previousLivestreams = getPreviousPublicLivestreams(show, {
    timezone: association?.timezone,
    now,
  });
  const nextLivestream = getNextPublicLivestream(show, {
    timezone: association?.timezone,
    now,
  });
  const enabledLiveClasses = Array.isArray(publicView?.liveClasses)
    ? publicView.liveClasses.filter((classView) => !classView.isScheduleOnly)
    : [];
  const { current: liveClasses } = partitionScheduledLiveViews(
    enabledLiveClasses,
    now
  );
  const publicClassIdsKey = (publicView?.classIds || []).join("|");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [nextAssociation, nextPublicView] = await Promise.all([
        getPublicAssociationRepository(associationId),
        getPublicShowViewRepository(showId),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShow(nextPublicView.show);
      setPublicView(nextPublicView);
      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [associationId, showId]);

  usePublicShowViewUpdates({
    showId,
    classIds: publicClassIdsKey ? publicClassIdsKey.split("|") : [],
    load: () => getPublicShowViewRepository(showId),
    onData: (nextPublicView) => {
      setShow(nextPublicView.show);
      setPublicView(nextPublicView);
      setNow(new Date());
    },
  });

  const pageTitle = t("public.livestream.seoTitle", {
    showName: show?.name || t("common.show"),
  });

  return (
    <main style={publicPageStyle}>
      <SeoMeta
        title={pageTitle}
        description={seo.description}
        canonicalPath={canonicalPath}
        imageUrl={association?.logoDataUrl}
        robots="index,follow"
      />

      <section style={publicHeroStyle}>
        <div style={brandStyle}>
          <AssociationLogo association={association} size={58} />
          <div>
            <div style={publicEyebrowStyle}>
              {t("public.livestream.eyebrow")}
            </div>
            <h1 style={publicTitleStyle}>
              {show?.name || t("common.show")}
            </h1>
            <div style={publicSubtitleStyle}>
              {association?.shortName || association?.name ||
                t("common.association")}
            </div>
          </div>
        </div>
        <div style={actionRowStyle}>
          <Link to={resultsPath} style={publicPrimaryActionStyle}>
            {t("public.livestream.openResults")}
          </Link>
          <ShareButton
            url={canonicalPath}
            title={pageTitle}
            text={seo.description}
          />
        </div>
      </section>

      {isLoading ? (
        <section style={publicEmptyStateStyle}>
          {t("public.livestream.loading")}
        </section>
      ) : !show ? (
        <section style={publicEmptyStateStyle}>
          {t("public.results.showNotFound")}
        </section>
      ) : livestream.url ? (
        <section style={videoCardStyle}>
          <div style={videoHeadingStyle}>
            <div>
              <div style={publicEyebrowStyle}>
                {t("public.livestream.today")}
              </div>
              <h2 style={videoTitleStyle}>
                {formatDayLabel(livestream.showDate, language)}
              </h2>
              <div style={publicMutedTextStyle}>{livestream.showDate}</div>
            </div>
            {embed.providerLabel ? (
              <span style={providerBadgeStyle}>{embed.providerLabel}</span>
            ) : null}
          </div>

          {embed.canEmbed ? (
            <div style={frameWrapStyle}>
              <iframe
                title={t("public.livestream.videoTitle")}
                src={embed.embedUrl}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                style={frameStyle}
              />
            </div>
          ) : (
            <div style={externalStyle}>
              <div style={publicMutedTextStyle}>
                {t("public.livestream.externalOnly")}
              </div>
              <a
                href={embed.externalUrl}
                target="_blank"
                rel="noreferrer"
                style={publicSecondaryActionStyle}
              >
                {t("public.livestream.openExternal")}
              </a>
            </div>
          )}
        </section>
      ) : (
        <section style={emptyVideoStyle}>
          <div style={publicEyebrowStyle}>
            {t("public.livestream.eyebrow")}
          </div>
          <h2 style={emptyTitleStyle}>
            {nextLivestream
              ? t("public.livestream.nextBroadcast", {
                  date: formatDayLabel(nextLivestream.date, language),
                })
              : livestream.showDate
                ? t("public.livestream.noVideoToday")
                : t("public.livestream.outsideShowDay")}
          </h2>
          {nextLivestream ? (
            <div style={nextBroadcastDateStyle}>{nextLivestream.date}</div>
          ) : null}
          <div style={publicMutedTextStyle}>
            {nextLivestream
              ? t("public.livestream.nextBroadcastHelp")
              : t("public.livestream.resultsRemainAvailable")}
          </div>
          <Link to={resultsPath} style={publicPrimaryActionStyle}>
            {t("public.livestream.openResults")}
          </Link>
        </section>
      )}

      {!isLoading && livestream.url ? (
        <section style={liveProgressSectionStyle}>
          <div style={liveProgressHeadingStyle}>
            <div>
              <div style={publicEyebrowStyle}>
                {t("public.livestream.blockLive")}
              </div>
              <div style={publicMutedTextStyle}>
                {t("public.livestream.liveProgress")}
              </div>
            </div>
            <span style={liveBadgeStyle}>LIVE</span>
          </div>

          {liveClasses.length > 0 ? (
            <div style={liveClassListStyle}>
              {liveClasses.map((classView) => (
                <LivestreamLiveClass
                  key={classView.classId || classView.classCode}
                  classView={classView}
                />
              ))}
            </div>
          ) : (
            <div style={liveWaitingStyle}>
              {t("public.livestream.noLiveBlock")}
            </div>
          )}
        </section>
      ) : null}

      {!isLoading && previousLivestreams.length > 0 ? (
        <section style={archiveCardStyle}>
          <div>
            <div style={publicEyebrowStyle}>
              {t("public.livestream.archive")}
            </div>
            <div style={publicMutedTextStyle}>
              {t("public.livestream.archiveHelp")}
            </div>
          </div>
          <div style={archiveListStyle}>
            {previousLivestreams.map((item) => {
              const previousEmbed = buildLivestreamEmbed(item.url);

              return (
                <a
                  key={item.date}
                  href={previousEmbed.externalUrl || item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={archiveLinkStyle}
                >
                  <span>
                    <strong style={archiveDateStyle}>
                      {formatDayLabel(item.date, language)}
                    </strong>
                    <span style={archiveIsoDateStyle}>{item.date}</span>
                  </span>
                  <span style={archiveActionStyle}>
                    {previousEmbed.providerLabel ? (
                      <span style={providerBadgeStyle}>
                        {previousEmbed.providerLabel}
                      </span>
                    ) : null}
                    {t("public.livestream.openReplay")} →
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function LivestreamLiveClass({ classView }) {
  const { t } = useTranslation();
  const activeRun = classView.activeRun || null;
  const runs = buildLivestreamRunOrder(classView);

  return (
    <article style={liveClassCardStyle}>
      <div style={liveClassHeadingStyle}>
        <div>
          <h2 style={liveClassTitleStyle}>
            {classView.className}
            {classView.classCode ? ` (${classView.classCode})` : ""}
          </h2>
          <div style={publicMutedTextStyle}>
            {classView.arena
              ? `${t("public.results.arena")} ${classView.arena} · `
              : ""}
            {classView.pattern || ""}
          </div>
        </div>
        {activeRun ? (
          <span style={onCourseBadgeStyle}>
            {t("public.livestream.current")} · #{activeRun.draw}
          </span>
        ) : null}
      </div>

      <div style={liveTableWrapStyle}>
        <table style={liveTableStyle}>
          <thead>
            <tr>
              <th style={liveThStyle}>{t("public.livestream.draw")}</th>
              <th style={liveThStyle}>{t("public.livestream.backNumber")}</th>
              <th style={liveThStyle}>{t("public.livestream.rider")}</th>
              <th style={liveThStyle}>{t("public.livestream.horse")}</th>
              <th style={liveThStyle}>{t("public.livestream.status")}</th>
              {classView.showScores !== false ? (
                <th style={liveScoreThStyle}>{t("public.livestream.score")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const isActive = isSameLivestreamRun(run, activeRun);
              const isCompleted = Boolean(run.isPassed || run.isComplete);

              return (
                <tr
                  key={getLivestreamRunKey(run)}
                  style={liveRunRowStyle({ isActive, isCompleted })}
                >
                  <td style={liveTdStyle}>
                    <strong>#{run.draw}</strong>
                  </td>
                  <td style={liveTdStyle}>{run.backNumber || "—"}</td>
                  <td style={liveTdStyle}>{run.rider || "—"}</td>
                  <td style={liveTdStyle}>{run.horse || "—"}</td>
                  <td style={liveTdStyle}>
                    <span
                      style={
                        isActive
                          ? currentStatusStyle
                          : isCompleted
                            ? completedStatusStyle
                            : upcomingStatusStyle
                      }
                    >
                      {isActive
                        ? t("public.livestream.current")
                        : isCompleted
                          ? t("public.livestream.completed")
                          : t("public.livestream.upcoming")}
                    </span>
                  </td>
                  {classView.showScores !== false ? (
                    <td style={liveScoreTdStyle}>
                      {isCompleted ? run.scoreTotal || "—" : "—"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function buildLivestreamRunOrder(classView) {
  const runMap = new Map();
  const sourceRuns = [
    ...(Array.isArray(classView?.passedRuns) ? classView.passedRuns : []),
    classView?.activeRun,
    ...(Array.isArray(classView?.orderRuns) ? classView.orderRuns : []),
  ].filter(Boolean);

  sourceRuns.forEach((run) => {
    const key = getLivestreamRunKey(run);
    const previous = runMap.get(key);
    runMap.set(key, previous ? { ...previous, ...run } : run);
  });

  return Array.from(runMap.values()).sort((first, second) => {
    const firstDraw = Number(first?.draw);
    const secondDraw = Number(second?.draw);

    if (Number.isFinite(firstDraw) && Number.isFinite(secondDraw)) {
      return firstDraw - secondDraw;
    }

    return String(first?.draw || "").localeCompare(String(second?.draw || ""));
  });
}

function getLivestreamRunKey(run) {
  return String(run?.id || `draw-${run?.draw || ""}`);
}

function isSameLivestreamRun(first, second) {
  if (!first || !second) return false;
  if (first.id && second.id) return first.id === second.id;
  return String(first.draw || "") === String(second.draw || "");
}

const brandStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const videoCardStyle = {
  ...publicCardStyle,
  display: "grid",
  gap: 14,
};

const videoHeadingStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const videoTitleStyle = {
  margin: "4px 0",
  color: publicColors.text,
  textTransform: "capitalize",
};

const providerBadgeStyle = {
  padding: "6px 10px",
  borderRadius: 999,
  background: publicColors.blueSoft,
  color: publicColors.blue,
  fontWeight: 850,
};

const frameWrapStyle = {
  position: "relative",
  width: "100%",
  aspectRatio: "16 / 9",
  overflow: "hidden",
  borderRadius: 8,
  background: "#020617",
};

const frameStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: 0,
};

const externalStyle = {
  minHeight: 180,
  display: "grid",
  placeContent: "center",
  justifyItems: "center",
  gap: 14,
  textAlign: "center",
  borderRadius: 8,
  background: publicColors.surfaceSoft,
};

const emptyVideoStyle = {
  ...publicEmptyStateStyle,
  minHeight: 280,
  display: "grid",
  placeContent: "center",
  justifyItems: "center",
  gap: 12,
  textAlign: "center",
};

const emptyTitleStyle = {
  margin: 0,
  color: publicColors.text,
  textTransform: "capitalize",
};

const nextBroadcastDateStyle = {
  padding: "6px 10px",
  borderRadius: 999,
  background: publicColors.blueSoft,
  color: publicColors.blue,
  fontWeight: 850,
};

const archiveCardStyle = {
  ...publicCardStyle,
  display: "grid",
  gap: 14,
  marginTop: 12,
};

const archiveListStyle = {
  display: "grid",
  gap: 8,
};

const archiveLinkStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  padding: "12px 14px",
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
  color: publicColors.text,
  textDecoration: "none",
  background: publicColors.surfaceSoft,
};

const archiveDateStyle = {
  display: "block",
  textTransform: "capitalize",
};

const archiveIsoDateStyle = {
  display: "block",
  marginTop: 2,
  color: publicColors.muted,
  fontSize: 13,
};

const archiveActionStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  color: publicColors.blue,
  fontWeight: 800,
  textAlign: "right",
};

const liveProgressSectionStyle = {
  display: "grid",
  gap: 14,
  marginTop: 16,
};

const liveProgressHeadingStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const liveBadgeStyle = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "#dc2626",
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.08em",
};

const liveClassListStyle = {
  display: "grid",
  gap: 12,
};

const liveWaitingStyle = {
  ...publicCardStyle,
  color: publicColors.muted,
  textAlign: "center",
};

const liveClassCardStyle = {
  ...publicCardStyle,
  display: "grid",
  gap: 12,
};

const liveClassHeadingStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const liveClassTitleStyle = {
  margin: "0 0 4px",
  color: publicColors.text,
  fontSize: 20,
};

const onCourseBadgeStyle = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 850,
};

const liveTableWrapStyle = {
  width: "100%",
  overflowX: "auto",
  border: `1px solid ${publicColors.border}`,
  borderRadius: 8,
};

const liveTableStyle = {
  width: "100%",
  minWidth: 680,
  borderCollapse: "collapse",
};

const liveThStyle = {
  padding: "10px 12px",
  borderBottom: `1px solid ${publicColors.border}`,
  background: publicColors.surfaceSoft,
  color: publicColors.muted,
  fontSize: 12,
  fontWeight: 850,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const liveScoreThStyle = {
  ...liveThStyle,
  textAlign: "right",
};

const liveTdStyle = {
  padding: "11px 12px",
  borderBottom: `1px solid ${publicColors.border}`,
  color: publicColors.text,
  verticalAlign: "middle",
};

const liveScoreTdStyle = {
  ...liveTdStyle,
  textAlign: "right",
  fontSize: 18,
  fontWeight: 900,
};

const liveRunRowStyle = ({ isActive, isCompleted }) => ({
  background: isActive ? "#fff7ed" : isCompleted ? "#f8fafc" : "#fff",
});

const statusPillBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const currentStatusStyle = {
  ...statusPillBaseStyle,
  background: "#fee2e2",
  color: "#b91c1c",
};

const completedStatusStyle = {
  ...statusPillBaseStyle,
  background: "#dcfce7",
  color: "#166534",
};

const upcomingStatusStyle = {
  ...statusPillBaseStyle,
  background: publicColors.blueSoft,
  color: publicColors.blue,
};

export default PublicShowLivestreamPage;
