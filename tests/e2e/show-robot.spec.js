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

  await seedStorage(page, seed);
}

async function seedPublishedRobotShow(page) {
  const seed = buildRobotShowStorageSeed();
  const setup = seed.json["reining_class_setup_v1"][CLASS_ID];
  const officialRuns = setup.runs.map((run, index) => ({
    ...run,
    scores: Array.from({ length: 13 }, (_, manoeuvreIndex) =>
      manoeuvreIndex < index % 6 ? "+0.5" : "0"
    ),
    penalties: Array.from({ length: 13 }, () => ""),
    penTotal: "",
    scoreTotal: (70 + (index % 6) * 0.5).toFixed(1),
    status: "completed",
    note:
      index === 0
        ? "Run fluide, belle cadence."
        : index === 5
          ? "Excellent controle, cadence reguliere."
          : "",
    judgeName: "Juge Alpha",
    judgeId: "judge-1",
    judgeOrder: 1,
  }));

  seed.json["reining_publication_states_v1"][CLASS_ID] = {
    classId: CLASS_ID,
    status: "published",
    publishedAt: "2026-05-28T15:30:00.000Z",
    publishedBy: "test@showscore.local",
    publicUrl: `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`,
    visibleFields: [
      "draw",
      "backNumber",
      "rider",
      "horse",
      "owner",
      "scoreTotal",
      "status",
    ],
  };
  seed.json["reining_class_records_v1"] = {
    [CLASS_ID]: {
      id: CLASS_ID,
      official: {
        judgeName: "Juge Alpha",
        judgeSignature: "robot-signature",
        finalized: true,
        finalizedAt: "2026-05-28T15:25:00.000Z",
        judgeSignedAt: "2026-05-28T15:25:00.000Z",
        secretariatValidatedAt: "2026-05-28T15:28:00.000Z",
        finalPdfFileName: "robot-officiel.pdf",
        officialRuns,
      },
    },
  };
  seed.json[`reining-scoring-runs-${CLASS_ID}`] = officialRuns;

  await seedStorage(page, seed);
}

async function seedStorage(page, seed) {
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

async function navigateSpa(page, pathname) {
  await page.evaluate((nextPathname) => {
    window.history.pushState({}, "", nextPathname);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, pathname);
  await expect(page).toHaveURL(new RegExp(`${pathname}$`));
}

async function expectNoHorizontalOverflow(page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.body.scrollWidth <= document.documentElement.clientWidth
      )
    )
    .toBe(true);
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
    await page
      .getByRole("button", { name: /Ordre de passage/ })
      .click();
    await expect(body).toContainText("Juge Alpha");
    await expect(body).toContainText("Juge Bravo");
    await expect(body).toContainText("Juge Charlie");
    await expect(body).toContainText("Juge Delta");
    await expect(body).toContainText("Juge Echo");
    await expect(body).toContainText("Total: 216");
    await expect(body).toContainText("Total: 217½");
    await expect(body).not.toContainText("Deux derniers");
    await showStep(page);
  });

  test("garde la vitrine publique mobile lisible avec details a la demande", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await seedRobotShow(page);

    await page.goto(`/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`);
    await expect(page.getByRole("heading", { name: "Robot Derby local" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page
      .getByRole("button", { name: /Classe robot 5 juges/ })
      .click();
    await expect(page.locator("body")).toContainText("Ordre de passage");
    await expect(page.locator("body")).toContainText("Cavalier 3");
    await expectNoHorizontalOverflow(page);

    await seedPublishedRobotShow(page);
    await page.goto(`/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`);
    await expect(page.locator("body")).toContainText("Feuille de pointage officielle");
    await page
      .getByRole("button", { name: /Classe robot 5 juges/ })
      .click();

    const body = page.locator("body");
    await expect(body).toContainText("Télécharger PDF");
    await expect(body).toContainText("Résumé mobile");
    await expect(body).toContainText("Cavalier 1");
    await expect(body).not.toContainText("Walk");
    await page.getByRole("button", { name: "Détails" }).first().click();
    await expect(body).toContainText("Walk");
    await expect(body).toContainText("Run fluide");
    await expectNoHorizontalOverflow(page);
  });

  test("permet le live annonceur et l affichage minimal ordre seulement", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await seedRobotShow(page);

    await page.goto(
      `/associations/${ASSOCIATION_ID}/classes/${CLASS_ID}/setup`
    );
    const liveSourceSelect = page.getByLabel("Source des données live");
    page.once("dialog", (dialog) => dialog.accept());
    await liveSourceSelect.selectOption("announcer");
    await expect(liveSourceSelect).toHaveValue("announcer");
    await expect
      .poll(() =>
        page.evaluate((classId) => {
          const setups = JSON.parse(
            window.localStorage.getItem("reining_class_setup_v1") || "{}"
          );
          return setups[classId]?.liveDataSource || "";
        }, CLASS_ID)
      )
      .toBe("announcer");

    await navigateSpa(
      page,
      `/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/announcer`
    );
    await expect(page.locator("body")).toContainText(
      "Contrôle live par l’annonceur"
    );
    await expect(
      page.getByRole("button", { name: "Entrer le résultat" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Scratch" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Propriétaire: Proprio 3");
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Entrer le résultat" }).click();
    const judgeScores = [
      ["Juge Alpha", "70"],
      ["Juge Bravo", "71"],
      ["Juge Charlie", "72"],
      ["Juge Delta", "73"],
      ["Juge Echo", "74"],
    ];
    for (const [judgeName, score] of judgeScores) {
      await page.getByLabel(judgeName).fill(score);
    }
    await expect(page.locator("body")).toContainText(
      "Total combiné selon les règles multijuges"
    );
    await expect(page.locator("body")).toContainText("216");
    await page.getByRole("button", { name: "Enregistrer le score" }).click();

    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Activer l’ordre seulement" })
      .click();
    await expect(page.locator("body")).toContainText(
      "Rétablir l’affichage complet"
    );

    await navigateSpa(
      page,
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`
    );
    await page
      .getByRole("button", { name: /Classe robot 5 juges/ })
      .click();

    const body = page.locator("body");
    await expect(body).toContainText("Ordre #3");
    await expect(body).not.toContainText("Cavalier 3");
    await expect(body).not.toContainText("Cheval 3");
    await expect(body).not.toContainText("Back 103");
    await expectNoHorizontalOverflow(page);
  });
});
