const { defineConfig, devices } = require("@playwright/test");

const PORT = process.env.E2E_PORT || "3020";
const HOST = process.env.E2E_HOST || "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const slowMo = Number(process.env.E2E_SLOW_MO || 0);
const viewport = {
  width: Number(process.env.E2E_VIEWPORT_WIDTH || 1440),
  height: Number(process.env.E2E_VIEWPORT_HEIGHT || 900),
};
const shouldRecordVideo = process.env.E2E_RECORD_VIDEO === "1";
const videoSize = {
  width: Number(process.env.E2E_VIDEO_WIDTH || viewport.width),
  height: Number(process.env.E2E_VIDEO_HEIGHT || viewport.height),
};

module.exports = defineConfig({
  testDir: "./tests/e2e",
  testIgnore:
    process.env.E2E_INCLUDE_DEMOS === "1" ? [] : ["**/*.demo.spec.js"],
  timeout: Number(process.env.E2E_TIMEOUT || 60 * 1000),
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: process.env.E2E_CAPTURE_SCREENSHOTS === "1" ? "on" : "only-on-failure",
    video: shouldRecordVideo
      ? {
          mode: "on",
          size: videoSize,
        }
      : "retain-on-failure",
    launchOptions: {
      slowMo,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport },
    },
  ],
  webServer: {
    command: `npm start -- --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Never reuse a developer/cloud-connected preview for the local fixtures.
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_DEPLOY_ENV: "",
      VERCEL_ENV: "",
    },
    timeout: 120 * 1000,
  },
});
