import React from "react";
import { Link, useLocation } from "react-router-dom";
import LanguageSwitcher from "./LanguageSwitcher";
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
    associationId && !isPublicPath && canOpenManagement;
  const shouldShowShowMenu = associationId && showId && !isPublicPath;

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

        {auth.isConfigured && !auth.isAuthenticated && (
          <Link to="/login" style={linkStyle(location.pathname === "/login")}>
            {t("nav.login")}
          </Link>
        )}

        <span style={spacerStyle} />
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
        </nav>
      )}

      {shouldShowShowMenu && (
        <nav style={subNavStyle} aria-label={t("nav.competitionMenu")}>
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

const subLinkStyle = (isActive) => ({
  ...linkStyle(isActive),
  minHeight: 30,
  padding: "5px 9px",
  fontSize: 14,
});

const spacerStyle = {
  flex: 1,
  minWidth: 8,
};

export default AppMenu;
