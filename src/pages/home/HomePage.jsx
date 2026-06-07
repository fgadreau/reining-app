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
import { getCloudSyncStatus } from "../../features/cloud/supabaseStatus";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { getPublicAssociationsRepository } from "../../features/publication/publicViewRepository";
import { appStyles as styles } from "../../styles/appStyles";

const BACK_OFFICE_ROLES = [
  ASSOCIATION_ROLES.ADMIN,
  ASSOCIATION_ROLES.SECRETARY,
  ASSOCIATION_ROLES.SCRIBE,
  ASSOCIATION_ROLES.ANNOUNCER,
];

const HOME_SIGNAL_KEYS = ["public", "scribe", "offline"];

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
  const [isLoading, setIsLoading] = useState(true);
  const cloudStatus = getCloudSyncStatus(auth.user);
  const isLocalMode = !auth.isConfigured || auth.isLocalTestUser;
  const canLoadManagement = isLocalMode || auth.isAuthenticated;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      const [
        nextPublicAssociations,
        nextManagementAssociations,
        nextMemberships,
        nextIsPlatformAdmin,
      ] = await Promise.all([
        getPublicAssociationsRepository(),
        canLoadManagement ? loadAssociationsRepository() : Promise.resolve([]),
        auth.isConfigured && !auth.isLocalTestUser && auth.user?.id
          ? loadUserMembershipsRepository(auth.user.id)
          : Promise.resolve([]),
        auth.isConfigured && !auth.isLocalTestUser && auth.user?.id
          ? loadIsPlatformAdminRepository()
          : Promise.resolve(false),
      ]);

      if (!isMounted) return;
      setPublicAssociations(nextPublicAssociations);
      setManagementAssociations(nextManagementAssociations);
      setMemberships(nextMemberships);
      setIsPlatformAdmin(nextIsPlatformAdmin);
      setIsLoading(false);
    }

    load();

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
            <Link to="/presentation" style={quietLinkStyle}>
              {t("home.learnMore")}
            </Link>
          </div>
          <div style={audienceRowStyle}>
            <div style={audienceNoteStyle}>
              <strong>{t("home.publicPathTitle")}</strong>
              <span>{t("home.publicPathText")}</span>
            </div>
            <div style={audienceNoteStyle}>
              <strong>{t("home.organizerPathTitle")}</strong>
              <span>{t("home.organizerPathText")}</span>
            </div>
          </div>
        </div>
      </section>

      <section style={signalGridStyle} aria-label={t("home.signalSection")}>
        {HOME_SIGNAL_KEYS.map((key) => (
          <article key={key} style={signalCardStyle}>
            <h2 style={workflowTitleStyle}>
              {t(`home.signals.${key}.title`)}
            </h2>
            <p style={workflowTextStyle}>{t(`home.signals.${key}.text`)}</p>
          </article>
        ))}
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>{t("home.publicAvailableTitle")}</h2>
            <div style={mutedTextStyle}>{t("home.publicAvailableText")}</div>
          </div>
          <Link to="/public" style={smallLinkStyle}>
            {t("home.openPublicShowcase")}
          </Link>
        </div>

        {isLoading ? (
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
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>{t("home.managementTitle")}</h2>
              <div style={mutedTextStyle}>{t("home.managementText")}</div>
            </div>
            <Link to="/associations" style={smallLinkStyle}>
              {t("home.myAssociations")}
            </Link>
          </div>

          {isLoading ? (
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

      <section style={platformStripStyle}>
        <div>
          <div style={statusLabelStyle}>{t("home.platform")}</div>
          <div style={statusValueStyle}>
            {cloudStatus.mode === "local-test"
              ? t("home.platformLocalTest")
              : cloudStatus.configured
                ? cloudStatus.authenticated
                  ? t("home.platformConnected")
                  : t("home.platformPublic")
                : t("home.platformLocal")}
          </div>
        </div>
        <div style={statusTextStyle}>{t("home.platformText")}</div>
        <div style={developmentNoticeStyle}>{t("home.developmentNotice")}</div>
      </section>

      <section style={legalPanelStyle}>
        <div>
          <h2 style={sectionTitleStyle}>{t("home.legalTitle")}</h2>
          <div style={mutedTextStyle}>{t("home.legalText")}</div>
        </div>
        <div style={legalLinkRowStyle}>
          {LEGAL_LINKS.map((link) => (
            <Link key={link.to} to={link.to} style={smallLinkStyle}>
              {t(link.labelKey)}
            </Link>
          ))}
        </div>
      </section>
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

const statusLabelStyle = {
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const statusValueStyle = {
  fontSize: 22,
  fontWeight: 800,
};

const statusTextStyle = {
  color: "#475569",
  lineHeight: 1.4,
  maxWidth: 520,
};

const developmentNoticeStyle = {
  border: "1px solid #bae6fd",
  borderRadius: 8,
  background: "#f0f9ff",
  color: "#075985",
  padding: "8px 10px",
  fontWeight: 700,
  lineHeight: 1.35,
};

const audienceRowStyle = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 8,
};

const audienceNoteStyle = {
  border: "1px solid #d8dee8",
  borderRadius: 8,
  background: "#f8fafc",
  color: "#111827",
  padding: "10px 12px",
  display: "grid",
  gap: 3,
  minWidth: 220,
  maxWidth: 310,
  boxSizing: "border-box",
};

const signalGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const signalCardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: 8,
};

const workflowTitleStyle = {
  margin: 0,
  fontSize: 18,
};

const workflowTextStyle = {
  margin: 0,
  color: "#475569",
  lineHeight: 1.4,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
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

const quietLinkStyle = {
  ...secondaryLinkStyle,
};

const emptyStateStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: 8,
  padding: 14,
  color: "#64748b",
};

const legalPanelStyle = {
  ...cardStyle,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const platformStripStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px solid #e2e8f0",
  marginBottom: 16,
  display: "flex",
  gap: 14,
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
};

const legalLinkRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

export default HomePage;
