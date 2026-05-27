import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import ShareButton from "../../components/ShareButton";
import { getAssociationWebsiteHref } from "../../features/associations/associationProfile";
import { useTranslation } from "../../features/i18n/I18nProvider";
import {
  getPublicAssociationRepository,
  getPublicShowsByAssociationRepository,
} from "../../features/publication/publicViewRepository";
import { appStyles as styles } from "../../styles/appStyles";

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

  return (
    <div style={styles.app}>
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
            title={association?.name || t("public.associationShows.shareTitle")}
          />
        </div>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("public.associationShows.loading")}</div>
      ) : shows.length === 0 ? (
        <div style={emptyStateStyle}>{t("public.associationShows.empty")}</div>
      ) : (
        <div style={showListStyle}>
          {shows.map((show) => (
            <article key={show.id} style={cardStyle}>
              <div>
                <h2 style={cardTitleStyle}>{show.name}</h2>
                <div style={mutedTextStyle}>
                  {show.venue || show.location || t("public.associationShows.venueTbd")}
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
                  title={show.name || t("public.associationShows.shareTitle")}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ children, tone = "published" }) {
  return <span style={badgeStyle(tone)}>{children}</span>;
}

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  flexWrap: "wrap",
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
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 30,
  overflowWrap: "anywhere",
};

const subtitleStyle = {
  color: "#64748b",
};

const showListStyle = {
  display: "grid",
  gap: 12,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px solid #e2e8f0",
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
  fontSize: 20,
};

const mutedTextStyle = {
  color: "#64748b",
  marginTop: 6,
};

const badgeRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const badgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  border: `1px solid ${tone === "live" ? "#86efac" : "#bfdbfe"}`,
  background: tone === "live" ? "#ecfdf5" : "#eff6ff",
  color: tone === "live" ? "#166534" : "#1d4ed8",
  fontWeight: 800,
  fontSize: 13,
});

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  textDecoration: "none",
  maxWidth: "100%",
};

const secondaryLinkStyle = {
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

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px dashed #cbd5e1",
  color: "#64748b",
};

export default PublicAssociationShowsPage;
