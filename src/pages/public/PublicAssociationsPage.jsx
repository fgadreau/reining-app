import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AssociationLogo from "../../components/AssociationLogo";
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
import {
  publicCardStyle,
  publicColors,
  publicEmptyStateStyle,
  publicEyebrowStyle,
  publicHeroStyle,
  publicMutedTextStyle,
  publicPageStyle,
  publicPrimaryActionStyle,
  publicSubtitleStyle,
  publicTitleStyle,
} from "../../styles/publicStyles";

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
    <div style={publicPageStyle}>
      <SeoMeta
        title={seo.title}
        description={seo.description}
        canonicalPath="/public"
      />

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{t("public.label")}</div>
          <h1 style={titleStyle}>{t("public.associations.title")}</h1>
          <div style={subtitleStyle}>{t("public.associations.subtitle")}</div>
        </div>
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
  ...publicHeroStyle,
  marginBottom: 12,
};

const eyebrowStyle = {
  ...publicEyebrowStyle,
};

const titleStyle = {
  ...publicTitleStyle,
  fontSize: 31,
};

const subtitleStyle = {
  ...publicSubtitleStyle,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
  gap: 12,
};

const cardStyle = {
  ...publicCardStyle,
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
  fontSize: 21,
  lineHeight: 1.12,
};

const mutedTextStyle = {
  ...publicMutedTextStyle,
  marginTop: 6,
};

const websiteLinkStyle = {
  display: "inline-flex",
  marginTop: 8,
  color: publicColors.blue,
  fontWeight: 800,
};

const searchLabelStyle = {
  display: "grid",
  gap: 8,
  color: publicColors.softText,
  fontWeight: 800,
};

const searchInputStyle = {
  width: "100%",
  padding: "12px 13px",
  borderRadius: 8,
  border: `1px solid ${publicColors.borderStrong}`,
  boxSizing: "border-box",
  fontSize: 16,
  background: "#fff",
};

const primaryLinkStyle = {
  ...publicPrimaryActionStyle,
  maxWidth: "100%",
};

const cardActionsStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const secondaryButtonStyle = {
  minHeight: 42,
};

const emptyStateStyle = {
  ...publicEmptyStateStyle,
  borderStyle: "dashed",
};

export default PublicAssociationsPage;
