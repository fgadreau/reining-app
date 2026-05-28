import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
import PublicAppInstallPrompt from "../../components/PublicAppInstallPrompt";
import SeoMeta from "../../components/SeoMeta";
import ShareButton from "../../components/ShareButton";
import { getAssociationWebsiteHref } from "../../features/associations/associationProfile";
import { filterAssociationsBySearch } from "../../features/associations/associationSearch";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { getPublicAssociationsRepository } from "../../features/publication/publicViewRepository";
import {
  buildAssociationPublicSeo,
  buildPublicDirectorySeo,
} from "../../features/seo/publicSeo";
import { appStyles as styles } from "../../styles/appStyles";

function PublicAssociationsPage() {
  const [associations, setAssociations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useTranslation();

  useEffect(() => {
    let isMounted = true;

    async function loadAssociations() {
      setIsLoading(true);
      const nextAssociations = await getPublicAssociationsRepository();
      if (!isMounted) return;
      setAssociations(nextAssociations);
      setIsLoading(false);
    }

    loadAssociations();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAssociations = useMemo(
    () => filterAssociationsBySearch(associations, searchQuery),
    [associations, searchQuery]
  );
  const seo = useMemo(() => buildPublicDirectorySeo(t), [t]);

  return (
    <div style={styles.app}>
      <SeoMeta
        title={seo.title}
        description={seo.description}
        canonicalPath="/public"
      />
      <PublicAppInstallPrompt />

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{t("public.label")}</div>
          <h1 style={titleStyle}>{t("public.associations.title")}</h1>
          <div style={subtitleStyle}>{t("public.associations.subtitle")}</div>
        </div>
        <Link to="/login" style={secondaryLinkStyle}>
          {t("public.associations.login")}
        </Link>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>{t("public.associations.loading")}</div>
      ) : associations.length === 0 ? (
        <div style={emptyStateStyle}>{t("public.associations.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <label style={searchLabelStyle}>
            <span>{t("public.associations.searchLabel")}</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("public.associations.searchPlaceholder")}
              style={searchInputStyle}
            />
          </label>

          {filteredAssociations.length === 0 ? (
            <div style={emptyStateStyle}>
              {t("public.associations.noSearchResults")}
            </div>
          ) : (
            <div style={gridStyle}>
              {filteredAssociations.map((association) => {
                const associationSeo = buildAssociationPublicSeo({
                  association,
                  t,
                });

                return (
                  <article key={association.id} style={cardStyle}>
                    <div style={associationHeaderStyle}>
                      <AssociationLogo association={association} size={56} />
                      <div>
                        <h2 style={cardTitleStyle}>{association.name}</h2>
                        <div style={mutedTextStyle}>
                          {association.shortName || t("common.association")}
                          {association.timezone ? ` · ${association.timezone}` : ""}
                        </div>
                        {getAssociationWebsiteHref(association) && (
                          <a
                            href={getAssociationWebsiteHref(association)}
                            target="_blank"
                            rel="noreferrer"
                            style={websiteLinkStyle}
                          >
                            {t("common.website")}
                          </a>
                        )}
                      </div>
                    </div>
                    <div style={cardActionsStyle}>
                      <Link
                        to={`/public/associations/${association.id}`}
                        style={primaryLinkStyle}
                      >
                        {t("public.associations.viewShows")}
                      </Link>
                      <ShareButton
                        url={`/public/associations/${association.id}`}
                        title={associationSeo.title}
                        text={associationSeo.description}
                        style={secondaryButtonStyle}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 18,
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
  fontSize: 30,
};

const subtitleStyle = {
  color: "#64748b",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 12,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: 14,
  alignContent: "space-between",
};

const associationHeaderStyle = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  minWidth: 0,
};

const cardTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const mutedTextStyle = {
  color: "#64748b",
  marginTop: 6,
};

const websiteLinkStyle = {
  display: "inline-flex",
  marginTop: 8,
  color: "#1d4ed8",
  fontWeight: 800,
};

const searchLabelStyle = {
  display: "grid",
  gap: 6,
  color: "#334155",
  fontWeight: 800,
};

const searchInputStyle = {
  width: "100%",
  maxWidth: 520,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

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
  minHeight: 40,
  maxWidth: "100%",
};

const cardActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const secondaryButtonStyle = {
  minHeight: 40,
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
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px dashed #cbd5e1",
  color: "#64748b",
};

export default PublicAssociationsPage;
