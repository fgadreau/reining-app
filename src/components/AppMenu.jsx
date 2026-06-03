import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AssociationLogo from "./AssociationLogo";
import CloudAuthBar from "./CloudAuthBar";
import LanguageSwitcher from "./LanguageSwitcher";
import { getAssociationRepository } from "../features/associations/associationRepository";
import { useAssociationAccess } from "../features/auth/useAssociationAccess";
import { useAuthUser } from "../features/auth/useAuthUser";
import { useTranslation } from "../features/i18n/I18nProvider";

function parseContext(pathname) {
  const match = pathname.match(
    /^\/associations\/([^/]+)(?:\/shows\/([^/]+))?/
  );

  return {
    associationId: match?.[1] || null,
    showId: match?.[2] || null,
  };
}

function AppMenu() {
  const location = useLocation();
  const auth = useAuthUser();
  const { t } = useTranslation();
  const { associationId, showId } = parseContext(location.pathname);
  const [association, setAssociation] = useState(null);
  const access = useAssociationAccess(associationId);
  const isPublicPath = location.pathname.startsWith("/public");
  const canOpenManagement = !auth.isConfigured || auth.isAuthenticated;
  const publicShowcasePath =
    associationId && showId
      ? `/public/associations/${associationId}/shows/${showId}`
      : associationId
        ? `/public/associations/${associationId}`
        : "/public";
  const associationBasePath = `/associations/${associationId}`;
  const showBasePath = `${associationBasePath}/shows/${showId}`;
  const shouldShowAssociationMenu =
    associationId && !showId && !isPublicPath && canOpenManagement;
  const shouldShowShowMenu = associationId && showId && !isPublicPath;
  const canViewPlatformAnalytics =
    canOpenManagement &&
    !isPublicPath &&
    (access.isPlatformAdmin || auth.isLocalTestUser || !auth.isConfigured);
  const associationLabel =
    association?.shortName || association?.name || t("common.association");

  useEffect(() => {
    let isMounted = true;

    async function loadAssociation() {
      if (!associationId || isPublicPath) {
        setAssociation(null);
        return;
      }

      const nextAssociation = await getAssociationRepository(associationId);
      if (!isMounted) return;
      setAssociation(nextAssociation);
    }

    loadAssociation();

    return () => {
      isMounted = false;
    };
  }, [associationId, isPublicPath]);

  if (isPublicPath) {
    return (
      <div style={publicMenuShellStyle}>
        <nav style={publicNavStyle} aria-label={t("nav.main")}>
          <Link to="/public" style={publicBrandStyle}>
            <span style={publicBrandMarkStyle}>ShowScore</span>
            <span style={publicBrandLabelStyle}>{t("nav.publicShowcase")}</span>
          </Link>

          <span style={spacerStyle} />
          <LanguageSwitcher />
          {canOpenManagement ? (
            <Link to="/associations" style={publicManagementLinkStyle}>
              {t("nav.managementAccess")}
            </Link>
          ) : (
            <Link to="/login" style={publicManagementLinkStyle}>
              {t("nav.login")}
            </Link>
          )}
        </nav>
      </div>
    );
  }

  return (
    <div style={menuShellStyle}>
      <nav style={navStyle} aria-label={t("nav.main")}>
        <Link to="/" style={linkStyle(location.pathname === "/")}>
          {t("nav.home")}
        </Link>
        <Link
          to={publicShowcasePath}
          style={linkStyle(isPublicPath)}
        >
          {t("nav.publicShowcase")}
        </Link>

        {canOpenManagement && (
          <Link
            to="/associations"
            style={linkStyle(location.pathname.startsWith("/associations"))}
          >
            {t("nav.association")}
          </Link>
        )}

        {canViewPlatformAnalytics && (
          <Link
            to="/admin/analytics"
            style={linkStyle(location.pathname.startsWith("/admin/analytics"))}
          >
            {t("nav.analytics")}
          </Link>
        )}

        {auth.isConfigured && !auth.isAuthenticated && isPublicPath && (
          <Link to="/login" style={linkStyle(location.pathname === "/login")}>
            {t("nav.login")}
          </Link>
        )}

        <span style={spacerStyle} />
        <CloudAuthBar variant="inline" />
        <LanguageSwitcher />
      </nav>

      {shouldShowAssociationMenu && (
        <nav style={subNavStyle} aria-label={t("nav.associationMenu")}>
          <Link
            to={`${associationBasePath}/shows`}
            style={subLinkStyle(
              location.pathname.startsWith(`${associationBasePath}/shows`)
            )}
          >
            {t("nav.competitions")}
          </Link>

          {access.canAdminAssociation && (
            <Link
              to={`${associationBasePath}/access`}
              style={subLinkStyle(location.pathname.includes("/access"))}
            >
              {t("nav.users")}
            </Link>
          )}

          {access.canManageAssociation && (
            <Link
              to={`${associationBasePath}/settings`}
              style={subLinkStyle(location.pathname.includes("/settings"))}
            >
              {t("nav.settings")}
            </Link>
          )}

          {access.canManageAssociation && (
            <Link
              to={`${associationBasePath}/activity`}
              style={subLinkStyle(location.pathname.includes("/activity"))}
            >
              {t("nav.activity")}
            </Link>
          )}
        </nav>
      )}

      {shouldShowShowMenu && (
        <nav style={subNavStyle} aria-label={t("nav.competitionMenu")}>
          <div
            style={associationContextStyle}
            title={association?.name || associationLabel}
          >
            <AssociationLogo association={association} size={28} />
            <span style={associationNameStyle}>{associationLabel}</span>
          </div>

          <Link
            to={`${associationBasePath}/shows`}
            style={backLinkStyle}
          >
            {t("nav.backAssociation")}
          </Link>

          {access.canManageAssociation && (
            <Link
              to={showBasePath}
              style={subLinkStyle(location.pathname === showBasePath)}
            >
              {t("nav.management")}
            </Link>
          )}

          {access.canManageAssociation && (
            <Link
              to={`${showBasePath}/secretariat`}
              style={subLinkStyle(location.pathname.includes("/secretariat"))}
            >
              {t("nav.secretariat")}
            </Link>
          )}

          {access.canAnnounceAssociation && (
            <Link
              to={`${showBasePath}/announcer`}
              style={subLinkStyle(location.pathname.includes("/announcer"))}
            >
              {t("nav.announcer")}
            </Link>
          )}

          {access.canScoreAssociation && (
            <Link
              to={`${showBasePath}/scribe`}
              style={subLinkStyle(location.pathname.includes("/scribe"))}
            >
              {t("nav.scribe")}
            </Link>
          )}

          {access.canManageAssociation && (
            <Link
              to={`${showBasePath}/time`}
              style={subLinkStyle(location.pathname.includes("/time"))}
            >
              {t("nav.dayTiming")}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

const menuShellStyle = {
  fontFamily: "Arial, sans-serif",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const navStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "8px 16px",
};

const linkStyle = (isActive) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${isActive ? "#94a3b8" : "transparent"}`,
  background: isActive ? "#fff" : "transparent",
  color: "#0f172a",
  fontWeight: isActive ? 800 : 700,
  textDecoration: "none",
});

const subNavStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
  padding: "6px 16px",
  background: "#fff",
  borderTop: "1px solid #e2e8f0",
};

const associationContextStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 34,
  maxWidth: 280,
  paddingRight: 8,
  marginRight: 2,
  borderRight: "1px solid #e2e8f0",
};

const associationNameStyle = {
  color: "#0f172a",
  fontWeight: 900,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subLinkStyle = (isActive) => ({
  ...linkStyle(isActive),
  minHeight: 30,
  padding: "5px 9px",
  fontSize: 14,
});

const backLinkStyle = {
  ...subLinkStyle(false),
  color: "#475569",
};

const spacerStyle = {
  flex: 1,
  minWidth: 8,
};

const publicMenuShellStyle = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  background: "#f5f6f8",
  borderBottom: "1px solid #d8dee8",
};

const publicNavStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  minHeight: 56,
  boxSizing: "border-box",
};

const publicBrandStyle = {
  display: "inline-flex",
  flexDirection: "column",
  justifyContent: "center",
  minHeight: 38,
  color: "#101827",
  textDecoration: "none",
  minWidth: 0,
};

const publicBrandMarkStyle = {
  fontWeight: 950,
  lineHeight: 1,
};

const publicBrandLabelStyle = {
  color: "#66758d",
  fontSize: 12,
  fontWeight: 800,
  marginTop: 2,
};

const publicManagementLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#42526b",
  fontSize: 13,
  fontWeight: 850,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export default AppMenu;
