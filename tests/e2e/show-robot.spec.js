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

async function seedRobotShowOnLastRun(page) {
  const seed = buildRobotShowStorageSeed();
  const setup = seed.json["reining_class_setup_v1"][CLASS_ID];
  const completedAt = "2026-05-28T15:45:00.000Z";
  const updateRuns = (runs) =>
    runs.map((run) =>
      run.draw < setup.runs.length
        ? {
            ...run,
            scores: Array.from({ length: 13 }, () => "0"),
            penalties: Array.from({ length: 13 }, () => ""),
            scoreTotal: "70",
            status: "completed",
            completedAt,
          }
        : {
            ...run,
            scores: Array.from({ length: 13 }, () => ""),
            penalties: Array.from({ length: 13 }, () => ""),
            scoreTotal: "",
            status: "",
            startedAt: completedAt,
            completedAt: null,
          }
    );

  seed.json["reining_classes_v1"].push({
    id: "e2e-robot-next-class",
    associationId: ASSOCIATION_ID,
    showId: SHOW_ID,
    dayId: "e2e-robot-day",
    name: "Classe robot suivante",
    classCode: "E2E-NEXT",
    arena: "Manege Robot",
    pattern: "RR2",
    sortOrder: 2,
  });
  Object.values(
    seed.json["showscore_judge_scoring_sessions_v1"]
  ).forEach((session) => {
    session.runs = updateRuns(session.runs);
    session.activeManoeuvre = {
      draw: setup.runs.length,
      manoeuvreIndex: 0,
    };
  });
  seed.json[`reining-scoring-runs-${CLASS_ID}`] = updateRuns(
    seed.json[`reining-scoring-runs-${CLASS_ID}`]
  );
  seed.json[`reining-scoring-active-manoeuvre-${CLASS_ID}`] = {
    draw: setup.runs.length,
    manoeuvreIndex: 0,
  };

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

  test("remplace les cartes TV vides par la prochaine classe", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await seedRobotShowOnLastRun(page);

    await page.goto(
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv`
    );

    const body = page.locator("body");
    await expect(body).toContainText("Cavalier 10");
    await expect(body).toContainText("Prochaine classe");
    await expect(body).toContainText("Classe robot suivante");
    await expect(body).not.toContainText("À confirmer");
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
    await expect(
      page.getByRole("button", { name: "Démarrer prochain" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Scratch" })).toBeVisible();

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

  test("importe et fait defiler les commanditaires par niveau", async ({
    page,
  }) => {
    await seedRobotShow(page);
    await page.goto(`/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`);
    await page.getByRole("button", { name: /Réglages Live/ }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "+ Ajouter un niveau" }).click();
    await dialog
      .getByPlaceholder("Nom du niveau (ex. Argent)")
      .fill("Argent");
    await dialog.locator('input[type="file"]').nth(0).setInputFiles([
      {
        name: "argent-1.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="silver"/></svg>'
        ),
      },
      {
        name: "argent-2.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="gray"/></svg>'
        ),
      },
    ]);

    await dialog.getByRole("button", { name: "+ Ajouter un niveau" }).click();
    await dialog
      .getByPlaceholder("Nom du niveau (ex. Argent)")
      .nth(1)
      .fill("Bronze");
    await dialog.locator('input[type="file"]').nth(1).setInputFiles({
      name: "bronze.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="#cd7f32"/></svg>'
      ),
    });

    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    await expect
      .poll(() =>
        page.evaluate((associationId) => {
          const associations = JSON.parse(
            window.localStorage.getItem("reiningApp.associations") || "[]"
          );
          return (
            associations.find((association) => association.id === associationId)
              ?.sponsorGroups || []
          ).map((group) => group.name);
        }, ASSOCIATION_ID)
      )
      .toEqual(["Argent", "Bronze"]);

    await page.evaluate((classId) => {
      const publications = JSON.parse(
        window.localStorage.getItem("reining_publication_states_v1") || "{}"
      );
      publications[classId] = {
        ...publications[classId],
        status: "hidden",
      };
      window.localStorage.setItem(
        "reining_publication_states_v1",
        JSON.stringify(publications)
      );
    }, CLASS_ID);

    await navigateSpa(
      page,
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv`
    );
    const sponsorRail = page.locator('[data-sponsor-layout="expanded"]');
    const sponsorTitle = sponsorRail.locator("[data-sponsor-title]");
    const sponsorLevel = sponsorRail.locator("[data-sponsor-level]");

    await expect(sponsorRail).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Robot Derby local" })
    ).toBeVisible();
    await expect(page.locator("body")).toContainText("Argent");
    await expect(sponsorLevel).toHaveText("Argent");
    await expect
      .poll(async () => {
        const titleBox = await sponsorTitle.boundingBox();
        const levelBox = await sponsorLevel.boundingBox();
        const [titleFontSize, levelFontSize, titleColor, levelColor] =
          await Promise.all([
            sponsorTitle.evaluate((element) =>
              Number.parseFloat(window.getComputedStyle(element).fontSize)
            ),
            sponsorLevel.evaluate((element) =>
              Number.parseFloat(window.getComputedStyle(element).fontSize)
            ),
            sponsorTitle.evaluate(
              (element) => window.getComputedStyle(element).color
            ),
            sponsorLevel.evaluate(
              (element) => window.getComputedStyle(element).color
            ),
          ]);

        return {
          isBelow: levelBox.y > titleBox.y,
          isLarger: levelFontSize > titleFontSize,
          hasDifferentColor: levelColor !== titleColor,
        };
      })
      .toEqual({
        isBelow: true,
        isLarger: true,
        hasDifferentColor: true,
      });
    await expect(page.locator("body")).toContainText("Bronze", {
      timeout: 12000,
    });

    await navigateSpa(
      page,
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/overlay`
    );
    await expect(page.locator("body")).toContainText("Argent");
  });
});
