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

function cleanEnvironmentValue(value) {
  return String(value || "").trim();
}

export function getConfiguredSupabaseProjectRef() {
  return cleanEnvironmentValue(import.meta.env.VITE_SUPABASE_PROJECT_REF);
}

function getProjectRefFromSupabaseUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/);
    return match?.[1] || (hostname === "127.0.0.1" || hostname === "localhost" ? "local" : "");
  } catch {
    return "";
  }
}

export function getSupabaseConfigurationError() {
  const deployEnvironment = getDeployEnvironment();
  const supabaseUrl = cleanEnvironmentValue(import.meta.env.VITE_SUPABASE_URL);
  const supabaseKey = cleanEnvironmentValue(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY
  );
  const currentProjectRef = getConfiguredSupabaseProjectRef();
  const productionProjectRef = cleanEnvironmentValue(
    import.meta.env.VITE_PRODUCTION_SUPABASE_PROJECT_REF
  );
  const isOnlineEnvironment = [
    "development",
    "dev",
    "staging",
    "preview",
    "production",
    "prod",
  ].includes(deployEnvironment);

  if (!isOnlineEnvironment) return "";
  if (!supabaseUrl || !supabaseKey) {
    return "Supabase URL and public key are required for this environment.";
  }
  if (!currentProjectRef || !productionProjectRef) {
    return "Current and production Supabase project refs are required.";
  }
  if (getProjectRefFromSupabaseUrl(supabaseUrl) !== currentProjectRef) {
    return "VITE_SUPABASE_URL does not match VITE_SUPABASE_PROJECT_REF.";
  }
  if (isProductionDeployEnvironment()) {
    return currentProjectRef === productionProjectRef
      ? ""
      : "Production must use the production Supabase project.";
  }
  return currentProjectRef === productionProjectRef
    ? "A non-production deployment cannot use the production Supabase project."
    : "";
}
