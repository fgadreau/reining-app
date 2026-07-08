import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadAssociationsRepository } from "../../features/associations/associationRepository";
import {
  loadIsPlatformAdminRepository,
  loadUserMembershipsRepository,
} from "../../features/auth/accessRepository";
import {
  ASSOCIATION_ROLES,
  getRoleLabel,
  getRolesForAssociation,
  hasAssociationRole,
} from "../../features/auth/accessRoles";
import { useAuthUser } from "../../features/auth/useAuthUser";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { getPublicAssociationsRepository } from "../../features/publication/publicViewRepository";
import { appStyles as styles } from "../../styles/appStyles";

const BACK_OFFICE_ROLES = [
  ASSOCIATION_ROLES.ADMIN,
  ASSOCIATION_ROLES.SECRETARY,
  ASSOCIATION_ROLES.SCRIBE,
  ASSOCIATION_ROLES.ANNOUNCER,
];

const LEGAL_LINKS = [
  { to: "/terms", labelKey: "home.terms" },
  { to: "/privacy", labelKey: "home.privacy" },
  { to: "/results-notice", labelKey: "home.resultsNotice" },
];

function HomePage() {
  const auth = useAuthUser();
  const { t } = useTranslation();
  const [publicAssociations, setPublicAssociations] = useState([]);
  const [managementAssociations, setManagementAssociations] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isPublicLoading, setIsPublicLoading] = useState(true);
  const [isManagementLoading, setIsManagementLoading] = useState(false);
  const isLocalMode = !auth.isConfigured || auth.isLocalTestUser;
  const canLoadManagement = isLocalMode || auth.isAuthenticated;

  useEffect(() => {
    let isMounted = true;

    async function loadPublicAssociations() {
      setIsPublicLoading(true);
      const nextPublicAssociations = await getPublicAssociationsRepository();

      if (!isMounted) return;
      setPublicAssociations(nextPublicAssociations);
      setIsPublicLoading(false);
    }

    loadPublicAssociations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadManagementAssociations() {
      if (!canLoadManagement) {
        setManagementAssociations([]);
        setMemberships([]);
        setIsPlatformAdmin(false);
        setIsManagementLoading(false);
        return;
      }

      setIsManagementLoading(true);
      const [
        nextManagementAssociations,
        nextMemberships,
        nextIsPlatformAdmin,
      ] = await Promise.all([
        loadAssociationsRepository(),
        auth.isConfigured && !auth.isLocalTestUser && auth.user?.id
          ? loadUserMembershipsRepository(auth.user.id)
          : Promise.resolve([]),
        auth.isConfigured && !auth.isLocalTestUser && auth.user?.id
          ? loadIsPlatformAdminRepository()
          : Promise.resolve(false),
      ]);

      if (!isMounted) return;
      setManagementAssociations(nextManagementAssociations);
      setMemberships(nextMemberships);
      setIsPlatformAdmin(nextIsPlatformAdmin);
      setIsManagementLoading(false);
    }

    loadManagementAssociations();

    return () => {
      isMounted = false;
    };
  }, [
    auth.isConfigured,
    auth.isLocalTestUser,
    auth.user?.id,
    canLoadManagement,
  ]);

  const visibleManagementAssociations = useMemo(() => {
    const source =
      isLocalMode || isPlatformAdmin
        ? managementAssociations
        : managementAssociations.filter((association) =>
            hasAssociationRole(memberships, association.id, BACK_OFFICE_ROLES)
          );

    return [...source].sort((a, b) => a.name.localeCompare(b.name));
  }, [isLocalMode, isPlatformAdmin, managementAssociations, memberships]);

  return (
    <div style={styles.app}>
      <section style={heroStyle} aria-labelledby="showscore-home-title">
        <div style={heroContentStyle}>
          <div style={eyebrowStyle}>{t("home.eyebrow")}</div>
          <h1 id="showscore-home-title" style={titleStyle}>
            {t("home.title")}
          </h1>
          <div style={subtitleStyle}>{t("home.subtitle")}</div>
          <div style={actionRowStyle}>
            <Link to="/public" style={primaryLinkStyle}>
              {t("home.viewPublicShowcase")}
            </Link>
            {canLoadManagement ? (
              <Link to="/associations" style={secondaryLinkStyle}>
                {t("home.continueManagement")}
              </Link>
            ) : (
              <Link to="/login" style={secondaryLinkStyle}>
                {t("home.managerLogin")}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section style={contentSectionStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>{t("home.publicAvailableTitle")}</h2>
          <Link to="/public" style={smallLinkStyle}>
            {t("home.openPublicShowcase")}
          </Link>
        </div>

        {isPublicLoading ? (
          <div style={emptyStateStyle}>{t("common.loading")}</div>
        ) : publicAssociations.length === 0 ? (
          <div style={emptyStateStyle}>{t("home.publicEmpty")}</div>
        ) : (
          <div style={associationGridStyle}>
            {publicAssociations.map((association) => (
              <AssociationCard
                key={association.id}
                association={association}
                label={t("home.publicLabel")}
                to={`/public/associations/${association.id}`}
                action={t("home.viewShows")}
              />
            ))}
          </div>
        )}
      </section>

      {canLoadManagement && (
        <section style={contentSectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>{t("home.managementTitle")}</h2>
            <Link to="/associations" style={smallLinkStyle}>
              {t("home.myAssociations")}
            </Link>
          </div>

          {isManagementLoading ? (
            <div style={emptyStateStyle}>{t("common.loading")}</div>
          ) : visibleManagementAssociations.length === 0 ? (
            <div style={emptyStateStyle}>{t("home.managementEmpty")}</div>
          ) : (
            <div style={associationGridStyle}>
              {visibleManagementAssociations.map((association) => {
                const roles = isLocalMode
                  ? [t("home.localRole")]
                  : isPlatformAdmin
                    ? [t("home.platformAdmin")]
                    : getRolesForAssociation(memberships, association.id).map(
                        getRoleLabel
                      );

                return (
                  <AssociationCard
                    key={association.id}
                    association={association}
                    label={roles.join(", ") || t("home.noRole")}
                    to={`/associations/${association.id}/shows`}
                    action={t("home.open")}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      <footer style={legalFooterStyle}>
        <div style={legalLinkRowStyle}>
          {LEGAL_LINKS.map((link) => (
            <Link key={link.to} to={link.to} style={footerLinkStyle}>
              {t(link.labelKey)}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

function AssociationCard({ association, label, to, action }) {
  const { t } = useTranslation();

  return (
    <article style={associationCardStyle}>
      <div>
        <h3 style={associationNameStyle}>{association.name}</h3>
        <div style={mutedTextStyle}>
          {association.shortName || t("common.association")} · {label}
        </div>
      </div>
      <Link to={to} style={secondaryLinkStyle}>
        {action}
      </Link>
    </article>
  );
}

const heroStyle = {
  background: "#ffffff",
  borderRadius: 8,
  padding: 22,
  boxShadow: "0 8px 24px rgba(16, 24, 39, 0.08)",
  marginBottom: 16,
  border: "1px solid #d8dee8",
  boxSizing: "border-box",
  color: "#111827",
};

const heroContentStyle = {
  display: "grid",
  gap: 12,
  alignContent: "start",
  maxWidth: 720,
};

const eyebrowStyle = {
  color: "#166534",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1.12,
  maxWidth: 760,
};

const subtitleStyle = {
  color: "#475569",
  fontSize: 17,
  lineHeight: 1.45,
  maxWidth: 720,
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const contentSectionStyle = {
  marginBottom: 16,
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const associationGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const associationCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 14,
  display: "grid",
  gap: 12,
  alignContent: "space-between",
};

const associationNameStyle = {
  margin: 0,
  fontSize: 18,
};

const mutedTextStyle = {
  color: "#64748b",
  marginTop: 6,
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
  fontWeight: 850,
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
  fontWeight: 800,
};

const smallLinkStyle = {
  ...secondaryLinkStyle,
  padding: "8px 12px",
};

const emptyStateStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 14,
  color: "#64748b",
};

const legalLinkRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const legalFooterStyle = {
  padding: "4px 0 12px",
};

const footerLinkStyle = {
  color: "#64748b",
  fontWeight: 750,
  fontSize: 13,
  textDecoration: "none",
};

export default HomePage;
