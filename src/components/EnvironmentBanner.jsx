import React from "react";
import {
  getConfiguredSupabaseProjectRef,
  getDeployEnvironmentLabel,
  getSupabaseConfigurationError,
} from "../features/cloud/deployEnvironment";

export default function EnvironmentBanner() {
  const label = getDeployEnvironmentLabel();
  const configurationError = getSupabaseConfigurationError();

  if (!label && !configurationError) return null;

  return (
    <aside
      role={configurationError ? "alert" : "status"}
      style={bannerStyle(Boolean(configurationError))}
    >
      <strong style={titleStyle}>
        {configurationError ? "CONFIGURATION BLOQUÉE" : label}
      </strong>
      <span>
        {configurationError
          ? configurationError
          : `Environnement de test${
              getConfiguredSupabaseProjectRef()
                ? ` · ${getConfiguredSupabaseProjectRef()}`
                : ""
            }`}
      </span>
    </aside>
  );
}

const bannerStyle = (hasError) => ({
  position: "sticky",
  top: 0,
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 12,
  minHeight: 34,
  padding: "6px 16px",
  borderBottom: `2px solid ${hasError ? "#dc2626" : "#f59e0b"}`,
  background: hasError ? "#fee2e2" : "#fef3c7",
  color: hasError ? "#7f1d1d" : "#78350f",
  fontFamily: "Arial, sans-serif",
  fontSize: 13,
});

const titleStyle = {
  letterSpacing: "0.04em",
};
