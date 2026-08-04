import { defineConfig, loadEnv, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";

function projectRefFromSupabaseUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1] || "";
  } catch {
    return "";
  }
}

function validateOnlineEnvironment(env) {
  const deployEnvironment = env.VITE_DEPLOY_ENV?.trim().toLowerCase();
  const vercelEnvironment = env.VERCEL_ENV?.trim().toLowerCase();

  if (["preview", "production"].includes(vercelEnvironment) && !deployEnvironment) {
    throw new Error("VITE_DEPLOY_ENV is required for Vercel preview and production deployments.");
  }
  if (!deployEnvironment) return;

  const onlineEnvironments = ["development", "dev", "staging", "preview", "production", "prod"];
  if (!onlineEnvironments.includes(deployEnvironment)) return;

  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabaseKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim();
  const currentProjectRef = env.VITE_SUPABASE_PROJECT_REF?.trim();
  const productionProjectRef = env.VITE_PRODUCTION_SUPABASE_PROJECT_REF?.trim();

  if (!supabaseUrl || !supabaseKey || !currentProjectRef || !productionProjectRef) {
    throw new Error("Online deployments require Supabase URL, public key, current project ref and production project ref.");
  }
  if (projectRefFromSupabaseUrl(supabaseUrl) !== currentProjectRef) {
    throw new Error("VITE_SUPABASE_URL does not match VITE_SUPABASE_PROJECT_REF.");
  }

  const isProduction = ["production", "prod"].includes(deployEnvironment);
  if (isProduction && currentProjectRef !== productionProjectRef) {
    throw new Error("Production deployment is not connected to the production Supabase project.");
  }
  if (!isProduction && currentProjectRef === productionProjectRef) {
    throw new Error("Non-production deployment cannot use the production Supabase project.");
  }
}

export default defineConfig(({ mode }) => {
  validateOnlineEnvironment(loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [
      {
        name: "treat-js-files-as-jsx",
        async transform(code, id) {
          if (!id.match(/src\/.*\.js$/) || id.includes("node_modules")) {
            return null;
          }
          return transformWithEsbuild(code, id, { loader: "jsx", jsx: "automatic" });
        },
      },
      react(),
    ],
    server: {
      port: 3010,
    },
    build: {
      outDir: "build",
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
  };
});
