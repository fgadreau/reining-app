import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import SeoMeta from "../../components/SeoMeta";
import ShareButton from "../../components/ShareButton";
import { getAssociationWebsiteHref } from "../../features/associations/associationProfile";
import { useTranslation } from "../../features/i18n/I18nProvider";
import {
  getPublicAssociationRepository,
  getPublicShowsByAssociationRepository,
} from "../../features/publication/publicViewRepository";
import {
  buildAssociationPublicSeo,
  buildShowPublicSeo,
} from "../../features/seo/publicSeo";
import {
  publicBadgeStyle,
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

function PublicAssociationShowsPage() {
  const { associationId } = useParams();
  const [association, setAssociation] = useState(null);
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    let isMounted = true;

    async function loadShows() {
      setIsLoading(true);
      const [nextAssociation, nextShows] = await Promise.all([
        getPublicAssociationRepository(associationId),
        getPublicShowsByAssociationRepository(associationId),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShows(nextShows);
      setIsLoading(false);
    }

    loadShows();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  const seo = useMemo(
    () => buildAssociationPublicSeo({ association, t }),
    [association, t]
  );

  return (
    <div style={publicPageStyle}>
      <SeoMeta
        title={seo.title}
        description={seo.description}
        canonicalPath={`/public/associations/${associationId}`}
        imageUrl={association?.logoDataUrl}
      />

      <div style={{ marginBottom: 16 }}>
        <Link to="/public" style={secondaryLinkStyle}>
          {t("public.associationShows.back")}
        </Link>
      </div>

      <section style={heroStyle}>
        <div style={associationHeaderStyle}>
          <AssociationLogo association={association} size={64} />
          <div>
            <div style={eyebrowStyle}>{t("public.label")}</div>
            <h1 style={titleStyle}>
              {association?.name || t("common.association")}
            </h1>
            <div style={subtitleStyle}>{t("public.associationShows.subtitle")}</div>
          </div>
        </div>
        <div style={heroActionsStyle}>
          {getAssociationWebsiteHref(association) && (
            <a
              href={getAssociationWebsiteHref(association)}
              target="_blank"
              rel="noreferrer"
              style={secondaryLinkStyle}
            >
              {t("common.website")}
            </a>
          )}
          <ShareButton
            url={`/public/associations/${associationId}`}
            title={seo.title}
            text={seo.description}
          />
        </div>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("public.associationShows.loading")}</div>
      ) : shows.length === 0 ? (
        <div style={emptyStateStyle}>{t("public.associationShows.empty")}</div>
      ) : (
        <div style={showListStyle}>
          {shows.map((show) => {
            const showSeo = buildShowPublicSeo({ association, show, t });

            return (
              <article key={show.id} style={cardStyle}>
                <div>
                  <h2 style={cardTitleStyle}>{show.name}</h2>
                  <div style={mutedTextStyle}>
                    {show.venue ||
                      show.location ||
                      t("public.associationShows.venueTbd")}
                    {show.startDate ? ` · ${show.startDate}` : ""}
                  </div>
                  <div style={badgeRowStyle}>
                    {show.liveClassCount > 0 && (
                      <Badge tone="live">{t("common.live")}</Badge>
                    )}
                    {show.publishedClassCount > 0 && (
                      <Badge>
                        {t("public.associationShows.publishedClasses", {
                          count: show.publishedClassCount,
                        })}
                      </Badge>
                    )}
                    {show.publishedResultClassCount > 0 && (
                      <Badge>
                        {t("public.associationShows.publishedResults", {
                          count: show.publishedResultClassCount,
                        })}
                      </Badge>
                    )}
                  </div>
                </div>
                <div style={cardActionsStyle}>
                  <Link
                    to={`/public/associations/${associationId}/shows/${show.id}`}
                    style={primaryLinkStyle}
                  >
                    {t("public.associationShows.viewShow")}
                  </Link>
                  <ShareButton
                    url={`/public/associations/${associationId}/shows/${show.id}`}
                    title={showSeo.title}
                    text={showSeo.description}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ children, tone = "published" }) {
  return <span style={publicBadgeStyle(tone === "live" ? "live" : "info")}>{children}</span>;
}

const heroStyle = {
  ...publicHeroStyle,
  marginBottom: 12,
};

const associationHeaderStyle = {
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
  ...publicEyebrowStyle,
};

const titleStyle = {
  ...publicTitleStyle,
  fontSize: 30,
};

const subtitleStyle = {
  ...publicSubtitleStyle,
};

const showListStyle = {
  display: "grid",
  gap: 12,
};

const cardStyle = {
  ...publicCardStyle,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const cardActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const cardTitleStyle = {
  margin: 0,
  fontSize: 21,
  lineHeight: 1.14,
};

const mutedTextStyle = {
  ...publicMutedTextStyle,
  marginTop: 6,
};

const badgeRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const primaryLinkStyle = {
  ...publicPrimaryActionStyle,
  maxWidth: "100%",
};

const secondaryLinkStyle = {
  ...publicSecondaryActionStyle,
  maxWidth: "100%",
};

const emptyStateStyle = {
  ...publicEmptyStateStyle,
  borderStyle: "dashed",
  color: publicColors.muted,
};

export default PublicAssociationShowsPage;
