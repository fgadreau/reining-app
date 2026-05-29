const { expect, test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const {
  ASSOCIATION_ID,
  CLASS_ID,
  SHOW_ID,
  buildRobotShowStorageSeed,
} = require("./showRobotData");

async function seedRobotShow(page) {
  const seed = buildRobotShowStorageSeed();

  await page.addInitScript((storageSeed) => {
    window.localStorage.clear();

    Object.entries(storageSeed.raw).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });

    Object.entries(storageSeed.json).forEach(([key, value]) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    });
  }, seed);
}

async function showStep(page) {
  if (process.env.E2E_SHOW_STEPS === "1") {
    const pauseMs = Number(process.env.E2E_STEP_PAUSE || 1500);
    await page.waitForTimeout(pauseMs);
  }
}

test.describe("robot de show local", () => {
  test.afterEach(async ({ page }) => {
    if (process.env.E2E_RECORD_VIDEO !== "1") return;

    const video = page.video();
    if (!video) return;

    try {
      await page.close();
      const videoPath = await video.path();
      const stableVideoPath = path.join(
        process.cwd(),
        "test-results",
        "show-robot-demo.webm"
      );
      fs.mkdirSync(path.dirname(stableVideoPath), { recursive: true });
      fs.copyFileSync(videoPath, stableVideoPath);
      console.log(`Video demo sauvegardee: ${stableVideoPath}`);
    } catch (error) {
      console.log(`Video demo non sauvegardee: ${error.message}`);
    }
  });

  test("valide une classe live a 5 juges de la vue scribe a la vitrine", async ({
    page,
  }) => {
    await seedRobotShow(page);

    await page.goto(`/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/scribe`);
    await expect(page.getByRole("heading", { name: "Robot Derby local" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Classe robot 5 juges");
    await expect(page.locator("body")).toContainText("5");
    await showStep(page);

    await page.getByRole("link", { name: "Ouvrir scoring" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/associations/${ASSOCIATION_ID}/scribe/classes/${CLASS_ID}$`)
    );
    await expect(page.locator("body")).toContainText("Classe robot 5 juges");
    await expect(page.locator("body")).toContainText("Choisis la feuille du juge");
    await expect(page.getByRole("button", { name: "Juge Charlie" })).toBeVisible();
    await showStep(page);

    await page.getByRole("button", { name: "Juge Charlie" }).click();
    await expect(page.getByRole("heading", { name: "Juge Charlie" })).toBeVisible();
    await expect(page.locator("body")).toContainText("test@showscore.local");
    await showStep(page);

    await page.goto(`/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`);
    await expect(page.getByRole("heading", { name: "Robot Derby local" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Classe robot 5 juges");
    await showStep(page);

    await page
      .getByRole("button", { name: /Classe robot 5 juges/ })
      .click();

    const body = page.locator("body");
    await expect(body).toContainText("En piste");
    await expect(body).toContainText(/En pr.paration/);
    await expect(body).toContainText("En attente");
    await expect(body).toContainText("Juge Alpha");
    await expect(body).toContainText("Juge Bravo");
    await expect(body).toContainText("Juge Charlie");
    await expect(body).toContainText("Juge Delta");
    await expect(body).toContainText("Juge Echo");
    await expect(body).toContainText("216.0");
    await expect(body).toContainText("217.5");
    await expect(body).not.toContainText("Deux derniers");
    await showStep(page);
  });
});
