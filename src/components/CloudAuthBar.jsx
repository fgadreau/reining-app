import React from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "../features/auth/authRepository";
import {
  getDeployEnvironmentLabel,
  isProductionDeployEnvironment,
} from "../features/cloud/deployEnvironment";
import { useAuthUser } from "../features/auth/useAuthUser";
import { useTranslation } from "../features/i18n/I18nProvider";

function CloudAuthBar({ variant = "bar" }) {
  const location = useLocation();
  const auth = useAuthUser();
  const { t } = useTranslation();
  const deployEnvironmentLabel = getDeployEnvironmentLabel();
  const isInline = variant === "inline";
  const containerStyle = isInline ? inlineBarStyle : barStyle;

  if (location.pathname.includes("/public")) {
    return null;
  }

  const isLoginPage = location.pathname === "/login";

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      alert(error.message || t("auth.logoutFailed"));
    }
  }

  if (!auth.isConfigured) {
    return (
      <div style={containerStyle}>
        {deployEnvironmentLabel && (
          <span style={environmentBadgeStyle()}>
            {deployEnvironmentLabel}
          </span>
        )}
        <span style={badgeStyle("local")}>{t("auth.localMode")}</span>
        {!isInline && (
          <span style={mutedTextStyle}>{t("auth.supabaseNotConfigured")}</span>
        )}
      </div>
    );
  }

  if (auth.isLoading) {
    return (
      <div style={containerStyle}>
        {deployEnvironmentLabel && (
          <span style={environmentBadgeStyle()}>
            {deployEnvironmentLabel}
          </span>
        )}
        <span style={badgeStyle("pending")}>{t("auth.supabase")}</span>
        {!isInline && (
          <span style={mutedTextStyle}>{t("auth.sessionCheck")}</span>
        )}
      </div>
    );
  }

  if (auth.isLocalTestUser) {
    return (
      <div style={containerStyle}>
        {deployEnvironmentLabel && (
          <span style={environmentBadgeStyle()}>{deployEnvironmentLabel}</span>
        )}
        <span style={badgeStyle("local")}>{t("auth.localTestMode")}</span>
        <span style={userTextStyle}>{auth.user?.email}</span>
        <button type="button" onClick={handleSignOut} style={buttonStyle}>
          {t("auth.logout")}
        </button>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={containerStyle}>
        {deployEnvironmentLabel && (
          <span style={environmentBadgeStyle()}>
            {deployEnvironmentLabel}
          </span>
        )}
        <span style={badgeStyle("warn")}>{t("auth.cloudReady")}</span>
        {!isInline && (
          <span style={mutedTextStyle}>{t("auth.supabaseWriteHint")}</span>
        )}
        {!isLoginPage && (
          <Link to="/login" style={linkStyle}>
            {t("auth.login")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {deployEnvironmentLabel && (
        <span style={environmentBadgeStyle()}>{deployEnvironmentLabel}</span>
      )}
      <span style={badgeStyle("ready")}>{t("auth.cloudConnected")}</span>
      <span style={userTextStyle}>{auth.user?.email || t("auth.supabaseUser")}</span>
      <button type="button" onClick={handleSignOut} style={buttonStyle}>
        {t("auth.logout")}
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

const inlineBarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
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
