import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAssociationAccess } from "../features/auth/useAssociationAccess";
import { useAuthUser } from "../features/auth/useAuthUser";

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
  const { associationId, showId } = parseContext(location.pathname);
  const access = useAssociationAccess(associationId);

  if (location.pathname.includes("/public")) {
    return null;
  }

  return (
    <nav style={navStyle} aria-label="Navigation principale">
      <Link to="/" style={linkStyle(location.pathname === "/")}>
        Accueil
      </Link>
      <Link
        to={auth.isConfigured && !auth.isAuthenticated ? "/public" : "/associations"}
        style={linkStyle(
          location.pathname.startsWith("/associations") ||
            location.pathname.startsWith("/public")
        )}
      >
        Associations
      </Link>

      {associationId && (
        <Link
          to={`/associations/${associationId}/shows`}
          style={linkStyle(location.pathname.endsWith("/shows"))}
        >
          Shows
        </Link>
      )}

      {associationId && showId && (
        <Link
          to={`/associations/${associationId}/shows/${showId}`}
          style={linkStyle(
            location.pathname === `/associations/${associationId}/shows/${showId}`
          )}
        >
          Show
        </Link>
      )}

      {associationId && showId && access.canManageAssociation && (
        <Link
          to={`/associations/${associationId}/shows/${showId}/secretariat`}
          style={linkStyle(location.pathname.includes("/secretariat"))}
        >
          Secrétariat
        </Link>
      )}

      {associationId && showId && access.canAnnounceAssociation && (
        <Link
          to={`/associations/${associationId}/shows/${showId}/announcer`}
          style={linkStyle(location.pathname.includes("/announcer"))}
        >
          Annonceur
        </Link>
      )}

      {associationId && access.canAdminAssociation && (
        <Link
          to={`/associations/${associationId}/access`}
          style={linkStyle(location.pathname.includes("/access"))}
        >
          Accès
        </Link>
      )}

      {auth.isConfigured && !auth.isAuthenticated && (
        <Link to="/login" style={linkStyle(location.pathname === "/login")}>
          Connexion
        </Link>
      )}
    </nav>
  );
}

const navStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  padding: "8px 16px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  fontFamily: "Arial, sans-serif",
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

export default AppMenu;
