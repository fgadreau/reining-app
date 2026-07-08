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

function getIsMobileMenuViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 640px)").matches
  );
}

function AppMenu() {
  const location = useLocation();
  const auth = useAuthUser();
  const { t } = useTranslation();
  const isPublicOverlayPath =
    /^\/public\/associations\/[^/]+\/shows\/[^/]+\/overlay/.test(
      location.pathname
    );
  const { associationId, showId } = parseContext(location.pathname);
  const [association, setAssociation] = useState(null);
  const [isMobile, setIsMobile] = useState(getIsMobileMenuViewport);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const isAdminPath = location.pathname.startsWith("/admin");
  const canViewPlatformAnalytics =
    canOpenManagement &&
    !isPublicPath &&
    (access.isPlatformAdmin || auth.isLocalTestUser || !auth.isConfigured);
  const canViewPlatformAdmin = canViewPlatformAnalytics;
  const shouldShowAdminMenu = canViewPlatformAdmin && isAdminPath;
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

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const handleChange = (event) => {
      setIsMobile(event.matches);
      if (!event.matches) {
        setIsMenuOpen(false);
      }
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const mainLinks = [
    {
      to: "/",
      label: t("nav.home"),
      isActive: location.pathname === "/",
    },
    {
      to: "/presentation",
      label: t("nav.presentation"),
      isActive: location.pathname === "/presentation",
    },
    {
      to: publicShowcasePath,
      label: t("nav.publicShowcase"),
      isActive: isPublicPath,
    },
  ];

  if (canOpenManagement) {
    mainLinks.push({
      to: "/associations",
      label: t("nav.association"),
      isActive: location.pathname.startsWith("/associations"),
    });
  }

  if (canViewPlatformAdmin) {
    mainLinks.push({
      to: "/admin/access",
      label: t("nav.admin"),
      isActive: isAdminPath,
    });
  }

  const adminLinks = canViewPlatformAdmin
    ? [
        {
          to: "/admin/access",
          label: t("nav.accessManagement"),
          isActive: location.pathname.startsWith("/admin/access"),
        },
        {
          to: "/admin/analytics",
          label: t("nav.analytics"),
          isActive: location.pathname.startsWith("/admin/analytics"),
        },
      ]
    : [];

  if (auth.isConfigured && !auth.isAuthenticated && isPublicPath) {
    mainLinks.push({
      to: "/login",
      label: t("nav.login"),
      isActive: location.pathname === "/login",
    });
  }

  const associationLinks = [];

  if (shouldShowAssociationMenu) {
    associationLinks.push({
      to: `${associationBasePath}/shows`,
      label: t("nav.competitions"),
      isActive: location.pathname.startsWith(`${associationBasePath}/shows`),
    });

    if (access.canAdminAssociation) {
      associationLinks.push({
        to: `${associationBasePath}/access`,
        label: t("nav.users"),
        isActive: location.pathname.includes("/access"),
      });
    }

    if (access.canManageAssociation) {
      associationLinks.push(
        {
          to: `${associationBasePath}/settings`,
          label: t("nav.settings"),
          isActive: location.pathname.includes("/settings"),
        },
        {
          to: `${associationBasePath}/activity`,
          label: t("nav.activity"),
          isActive: location.pathname.includes("/activity"),
        }
      );
    }
  }

  const showLinks = [];

  if (shouldShowShowMenu) {
    showLinks.push({
      to: `${associationBasePath}/shows`,
      label: t("nav.backAssociation"),
      isActive: false,
      isBack: true,
    });

    if (access.canManageAssociation) {
      showLinks.push(
        {
          to: showBasePath,
          label: t("nav.management"),
          isActive: location.pathname === showBasePath,
        },
        {
          to: `${showBasePath}/secretariat`,
          label: t("nav.secretariat"),
          isActive: location.pathname.includes("/secretariat"),
        }
      );
    }

    if (access.canAnnounceAssociation) {
      showLinks.push({
        to: `${showBasePath}/announcer`,
        label: t("nav.announcer"),
        isActive: location.pathname.includes("/announcer"),
      });
    }

    if (access.canScoreAssociation) {
      showLinks.push({
        to: `${showBasePath}/scribe`,
        label: t("nav.scribe"),
        isActive: location.pathname.includes("/scribe"),
      });
    }

    if (access.canManageAssociation) {
      showLinks.push({
        to: `${showBasePath}/time`,
        label: t("nav.dayTiming"),
        isActive: location.pathname.includes("/time"),
      });
    }
  }

  const mobileContextLabel = associationId ? associationLabel : "ShowScore";
  const closeMobileMenu = () => setIsMenuOpen(false);
  const renderMobileLinks = (links) =>
    links.map((link) => (
      <Link
        key={link.to}
        to={link.to}
        style={mobileDrawerLinkStyle(link.isActive, link.isBack)}
        onClick={closeMobileMenu}
      >
        {link.label}
      </Link>
    ));

  if (isPublicOverlayPath) {
    return null;
  }

  if (isPublicPath) {
    return (
      <div style={publicMenuShellStyle}>
        <nav style={publicNavStyle} aria-label={t("nav.main")}>
          <Link to="/public" style={publicBrandStyle}>
            <span style={publicBrandMarkStyle}>ShowScore</span>
            <span style={publicBrandLabelStyle}>{t("nav.publicShowcase")}</span>
          </Link>

          <Link to="/" style={publicNavigationLinkStyle}>
            {t("nav.home")}
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

  if (isMobile) {
    return (
      <div style={menuShellStyle}>
        <div style={mobileTopBarStyle}>
          <span style={mobileContextLabelStyle}>{mobileContextLabel}</span>
          <button
            type="button"
            style={mobileMenuButtonStyle}
            onClick={() => setIsMenuOpen((value) => !value)}
            aria-controls="showscore-mobile-menu"
            aria-expanded={isMenuOpen}
            aria-hidden={isMenuOpen ? true : undefined}
            aria-label={isMenuOpen ? undefined : "Ouvrir la navigation"}
            tabIndex={isMenuOpen ? -1 : 0}
          >
            {isMenuOpen ? "×" : "☰"}
          </button>
        </div>

        {isMenuOpen && (
          <div
            id="showscore-mobile-menu"
            style={mobileDrawerStyle}
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.main")}
          >
            <div style={mobileDrawerHeaderStyle}>
              <span style={mobileContextLabelStyle}>{mobileContextLabel}</span>
              <button
                type="button"
                style={mobileMenuButtonStyle}
                onClick={closeMobileMenu}
                aria-label="Fermer la navigation"
              >
                ×
              </button>
            </div>

            <nav style={mobileDrawerNavStyle} aria-label={t("nav.main")}>
              <div style={mobileDrawerSectionStyle}>
                {renderMobileLinks(mainLinks)}
              </div>

              {associationLinks.length > 0 && (
                <>
                  <hr style={mobileDrawerDividerStyle} />
                  <div style={mobileDrawerSectionStyle}>
                    {renderMobileLinks(associationLinks)}
                  </div>
                </>
              )}

              {adminLinks.length > 0 && (
                <>
                  <hr style={mobileDrawerDividerStyle} />
                  <div style={mobileDrawerSectionStyle}>
                    {renderMobileLinks(adminLinks)}
                  </div>
                </>
              )}

              {showLinks.length > 0 && (
                <>
                  <hr style={mobileDrawerDividerStyle} />
                  <div style={mobileDrawerSectionStyle}>
                    {renderMobileLinks(showLinks)}
                  </div>
                </>
              )}
            </nav>

            <div style={mobileDrawerFooterStyle}>
              <CloudAuthBar variant="inline" />
              <LanguageSwitcher />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={menuShellStyle}>
      <nav style={navStyle} aria-label={t("nav.main")}>
        {mainLinks.map((link) => (
          <Link key={link.to} to={link.to} style={linkStyle(link.isActive)}>
            {link.label}
          </Link>
        ))}

        <span style={spacerStyle} />
        <CloudAuthBar variant="inline" />
        <LanguageSwitcher />
      </nav>

      {shouldShowAssociationMenu && (
        <nav style={subNavStyle} aria-label={t("nav.associationMenu")}>
          {associationLinks.map((link) => (
            <Link key={link.to} to={link.to} style={subLinkStyle(link.isActive)}>
              {link.label}
            </Link>
          ))}
        </nav>
      )}

      {shouldShowAdminMenu && (
        <nav style={subNavStyle} aria-label={t("nav.adminMenu")}>
          {adminLinks.map((link) => (
            <Link key={link.to} to={link.to} style={subLinkStyle(link.isActive)}>
              {link.label}
            </Link>
          ))}
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

          {showLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={link.isBack ? backLinkStyle : subLinkStyle(link.isActive)}
            >
              {link.label}
            </Link>
          ))}
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

const mobileTopBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: 52,
  padding: "0 16px",
  boxSizing: "border-box",
};

const mobileContextLabelStyle = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mobileMenuButtonStyle = {
  alignItems: "center",
  background: "transparent",
  border: 0,
  color: "#0f172a",
  cursor: "pointer",
  display: "inline-flex",
  flex: "0 0 auto",
  fontSize: 22,
  fontWeight: 900,
  justifyContent: "center",
  minHeight: 44,
  minWidth: 44,
  padding: 0,
};

const mobileDrawerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 101,
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: "0 16px 16px",
  boxSizing: "border-box",
  overflowY: "auto",
};

const mobileDrawerHeaderStyle = {
  ...mobileTopBarStyle,
  flex: "0 0 auto",
  padding: 0,
};

const mobileDrawerNavStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const mobileDrawerSectionStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const mobileDrawerDividerStyle = {
  width: "100%",
  border: 0,
  borderTop: "1px solid #e2e8f0",
  margin: "2px 0",
};

const mobileDrawerLinkStyle = (isActive, isMuted = false) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${isActive ? "#94a3b8" : "transparent"}`,
  background: isActive ? "#f8fafc" : "transparent",
  boxSizing: "border-box",
  color: isMuted ? "#475569" : "#0f172a",
  fontWeight: isActive ? 900 : 800,
  textDecoration: "none",
});

const mobileDrawerFooterStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginTop: "auto",
  paddingTop: 16,
  borderTop: "1px solid #e2e8f0",
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
  flexWrap: "wrap",
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

const publicNavigationLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid transparent",
  color: "#101827",
  fontSize: 13,
  fontWeight: 850,
  textDecoration: "none",
  whiteSpace: "nowrap",
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
