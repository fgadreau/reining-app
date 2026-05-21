import React from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "../features/auth/authRepository";
import {
  getDeployEnvironmentLabel,
  isProductionDeployEnvironment,
} from "../features/cloud/deployEnvironment";
import { useAuthUser } from "../features/auth/useAuthUser";

function CloudAuthBar() {
  const location = useLocation();
  const auth = useAuthUser();
  const deployEnvironmentLabel = getDeployEnvironmentLabel();

  if (location.pathname.includes("/public")) {
    return null;
  }

  const isLoginPage = location.pathname === "/login";

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      alert(error.message || "Impossible de se déconnecter.");
    }
  }

  if (!auth.isConfigured) {
    return (
      <div style={barStyle}>
        {deployEnvironmentLabel && (
          <span style={environmentBadgeStyle()}>
            {deployEnvironmentLabel}
          </span>
        )}
        <span style={badgeStyle("local")}>Mode local</span>
        <span style={mutedTextStyle}>Supabase non configuré.</span>
      </div>
    );
  }

  if (auth.isLoading) {
    return (
      <div style={barStyle}>
        {deployEnvironmentLabel && (
          <span style={environmentBadgeStyle()}>
            {deployEnvironmentLabel}
          </span>
        )}
        <span style={badgeStyle("pending")}>Supabase</span>
        <span style={mutedTextStyle}>Vérification de la session…</span>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={barStyle}>
        {deployEnvironmentLabel && (
          <span style={environmentBadgeStyle()}>
            {deployEnvironmentLabel}
          </span>
        )}
        <span style={badgeStyle("warn")}>Cloud prêt</span>
        <span style={mutedTextStyle}>Connecte-toi pour écrire dans Supabase.</span>
        {!isLoginPage && (
          <Link to="/login" style={linkStyle}>
            Connexion
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={barStyle}>
      {deployEnvironmentLabel && (
        <span style={environmentBadgeStyle()}>{deployEnvironmentLabel}</span>
      )}
      <span style={badgeStyle("ready")}>Cloud connecté</span>
      <span style={userTextStyle}>{auth.user?.email || "Utilisateur Supabase"}</span>
      <button type="button" onClick={handleSignOut} style={buttonStyle}>
        Déconnexion
      </button>
    </div>
  );
}

const barStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "10px 16px",
  background: "#ffffff",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
  fontFamily: "Arial, sans-serif",
};

const badgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "3px 9px",
  borderRadius: 999,
  border: `1px solid ${
    tone === "ready" ? "#86efac" : tone === "warn" ? "#fdba74" : "#cbd5e1"
  }`,
  background:
    tone === "ready" ? "#ecfdf5" : tone === "warn" ? "#fff7ed" : "#f8fafc",
  color:
    tone === "ready" ? "#166534" : tone === "warn" ? "#9a3412" : "#475569",
  fontWeight: 700,
  fontSize: 13,
});

const environmentBadgeStyle = () => {
  const isProduction = isProductionDeployEnvironment();

  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 26,
    padding: "3px 9px",
    borderRadius: 8,
    border: `1px solid ${isProduction ? "#fca5a5" : "#93c5fd"}`,
    background: isProduction ? "#fef2f2" : "#eff6ff",
    color: isProduction ? "#991b1b" : "#1e3a8a",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 0,
  };
};

const mutedTextStyle = {
  color: "#64748b",
  fontSize: 14,
};

const userTextStyle = {
  color: "#334155",
  fontSize: 14,
  fontWeight: 700,
};

const linkStyle = {
  color: "#1d4ed8",
  fontWeight: 700,
  textDecoration: "none",
};

const buttonStyle = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

export default CloudAuthBar;
