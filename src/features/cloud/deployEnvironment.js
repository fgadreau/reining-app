const ENVIRONMENT_LABELS = {
  local: "LOCAL",
  development: "DEV",
  dev: "DEV",
  staging: "STAGING",
  preview: "PREVIEW",
  production: "PROD",
  prod: "PROD",
};

export function getDeployEnvironment() {
  return String(
    import.meta.env.VITE_DEPLOY_ENV ||
      import.meta.env.VITE_APP_ENV ||
      ""
  )
    .trim()
    .toLowerCase();
}

export function getDeployEnvironmentLabel() {
  const environment = getDeployEnvironment();

  if (!environment || isProductionDeployEnvironment()) {
    return null;
  }

  return ENVIRONMENT_LABELS[environment] || environment.toUpperCase();
}

export function isProductionDeployEnvironment() {
  return ["production", "prod"].includes(getDeployEnvironment());
}
