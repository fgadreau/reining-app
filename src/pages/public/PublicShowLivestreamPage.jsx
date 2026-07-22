import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import SeoMeta from "../../components/SeoMeta";
import ShareButton from "../../components/ShareButton";
import { formatDayLabel } from "../../features/days/dayDateUtils";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { buildLivestreamEmbed } from "../../features/livestream/livestreamEmbed";
import { getCurrentPublicLivestream } from "../../features/livestream/livestreamSchedule";
import {
  getPublicAssociationRepository,
  getPublicShowRepository,
} from "../../features/publication/publicViewRepository";
import { buildShowPublicSeo } from "../../features/seo/publicSeo";
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

const LIVESTREAM_REFRESH_MS = 30000;

function PublicShowLivestreamPage() {
  const { associationId, showId } = useParams();
  const { t, language } = useTranslation();
  const [association, setAssociation] = useState(null);
  const [show, setShow] = useState(() => getShowById(showId));
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

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [nextAssociation, nextShow] = await Promise.all([
        getPublicAssociationRepository(associationId),
        getPublicShowRepository(showId),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShow(nextShow);
      setIsLoading(false);
    }

    load();

    const timer = window.setInterval(async () => {
      const nextShow = await getPublicShowRepository(showId);
      if (!isMounted) return;
      setShow(nextShow);
      setNow(new Date());
    }, LIVESTREAM_REFRESH_MS);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [associationId, showId]);

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
            {livestream.showDate
              ? t("public.livestream.noVideoToday")
              : t("public.livestream.outsideShowDay")}
          </h2>
          <div style={publicMutedTextStyle}>
            {t("public.livestream.resultsRemainAvailable")}
          </div>
          <Link to={resultsPath} style={publicPrimaryActionStyle}>
            {t("public.livestream.openResults")}
          </Link>
        </section>
      )}
    </main>
  );
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
};

export default PublicShowLivestreamPage;
