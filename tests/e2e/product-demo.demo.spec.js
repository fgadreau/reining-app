const { expect, test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const LOCAL_TEST_EMAIL = "test@showscore.local";

function makeLocalTestSession() {
  return {
    access_token: "local-test-token",
    token_type: "bearer",
    user: {
      id: "local-test-user",
      email: LOCAL_TEST_EMAIL,
      isLocalTestUser: true,
      app_metadata: {
        provider: "local-test",
      },
      user_metadata: {
        display_name: "Test local",
        name: "Test local",
      },
    },
    expires_at: null,
  };
}

async function seedCleanLocalDemo(page) {
  await page.addInitScript((session) => {
    window.localStorage.clear();
    window.localStorage.setItem("showscore.language", "fr");
    window.localStorage.setItem(
      "showscore_local_test_auth_v1",
      JSON.stringify(session)
    );
    window.localStorage.setItem("reiningApp.associations", JSON.stringify([]));
    window.localStorage.setItem("reining_shows_v1", JSON.stringify([]));
    window.localStorage.setItem("reining_days_v1", JSON.stringify([]));
    window.localStorage.setItem("reining_classes_v1", JSON.stringify([]));
    window.localStorage.setItem("reining_class_setup_v1", JSON.stringify({}));
    window.localStorage.setItem(
      "reining_publication_states_v1",
      JSON.stringify({})
    );
    window.localStorage.setItem("showscore_app_events_v1", JSON.stringify([]));
  }, makeLocalTestSession());
}

async function showStep(page, extraMs = 0) {
  if (process.env.E2E_SHOW_STEPS !== "1") return;

  const pauseMs = Number(process.env.E2E_STEP_PAUSE || 1500);
  await page.waitForTimeout(pauseMs + extraMs);
}

async function saveVideoIfNeeded(page, fileName) {
  if (process.env.E2E_RECORD_VIDEO !== "1") return;

  const video = page.video();
  if (!video) return;

  try {
    await page.close();
    const videoPath = await video.path();
    const stableVideoPath = path.join(process.cwd(), "test-results", fileName);
    fs.mkdirSync(path.dirname(stableVideoPath), { recursive: true });
    fs.copyFileSync(videoPath, stableVideoPath);
    console.log(`Video demo sauvegardee: ${stableVideoPath}`);
  } catch (error) {
    console.log(`Video demo non sauvegardee: ${error.message}`);
  }
}

function getIdFromUrl(url, pattern, label) {
  const match = url.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Impossible de lire ${label} depuis ${url}`);
  }
  return match[1];
}

async function waitForSetupRuns(page, classId, expectedRunCount) {
  await page.waitForFunction(
    ({ targetClassId, runCount }) => {
      const setups = JSON.parse(
        window.localStorage.getItem("reining_class_setup_v1") || "{}"
      );
      const setup = setups[targetClassId];

      return (
        setup?.judges?.[0]?.name === "Sophie Laroche" &&
        setup?.runs?.length === runCount &&
        setup?.pattern === "RR1"
      );
    },
    { targetClassId: classId, runCount: expectedRunCount }
  );
}

async function seedScoringForSingleJudgeLive(page, classId) {
  await page.evaluate((targetClassId) => {
    const setups = JSON.parse(
      window.localStorage.getItem("reining_class_setup_v1") || "{}"
    );
    const setup = setups[targetClassId];
    const setupRuns = Array.isArray(setup?.runs) ? setup.runs : [];
    const manoeuvreCount = 13;
    const now = "2026-06-12T14:20:00.000Z";

    function makeScores(halfPointCount, complete) {
      return Array.from({ length: manoeuvreCount }, (_, index) => {
        if (!complete && index > 2) return "";
        return index < halfPointCount ? "+0.5" : "0";
      });
    }

    const scoreProfiles = [
      { halfPoints: 4, total: "72.0", complete: true },
      { halfPoints: 3, total: "71.5", complete: true },
      { halfPoints: 2, total: "", complete: false },
      { halfPoints: 0, total: "", complete: false },
    ];

    const scoringRuns = setupRuns.map((run, index) => {
      const profile =
        scoreProfiles[index] || scoreProfiles[scoreProfiles.length - 1];

      return {
        ...run,
        scores: makeScores(profile.halfPoints, profile.complete),
        penalties: Array.from({ length: manoeuvreCount }, () => ""),
        penTotal: "",
        scoreTotal: profile.total,
        status: profile.complete ? "completed" : "",
        note:
          index === 0
            ? "Run fluide, belle transition au lope."
            : index === 1
              ? "Bon controle, leger ajustement au changement de pied."
              : "",
        isActive: index === 2,
        startedAt: `2026-06-12T14:${String(10 + index * 3).padStart(
          2,
          "0"
        )}:00.000Z`,
        completedAt: profile.complete
          ? `2026-06-12T14:${String(12 + index * 3).padStart(2, "0")}:00.000Z`
          : null,
        durationSeconds: profile.complete ? 92 + index * 4 : null,
      };
    });

    setups[targetClassId] = {
      ...setup,
      startedAt: setup?.startedAt || "2026-06-12T14:10:00.000Z",
    };
    window.localStorage.setItem("reining_class_setup_v1", JSON.stringify(setups));
    window.localStorage.setItem(
      `reining-scoring-runs-${targetClassId}`,
      JSON.stringify(scoringRuns)
    );
    window.localStorage.setItem(
      `reining-scoring-active-manoeuvre-${targetClassId}`,
      JSON.stringify({ draw: 3, manoeuvreIndex: 2 })
    );

    const publications = JSON.parse(
      window.localStorage.getItem("reining_publication_states_v1") || "{}"
    );
    publications[targetClassId] = {
      classId: targetClassId,
      status: "live",
      publishedAt: now,
      publishedBy: "demo@showscore.local",
      publicUrl: null,
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
    window.localStorage.setItem(
      "reining_publication_states_v1",
      JSON.stringify(publications)
    );
  }, classId);
}

test.describe("demo produit ShowScore", () => {
  test.afterEach(async ({ page }) => {
    await saveVideoIfNeeded(
      page,
      process.env.E2E_VIDEO_FILE || "show-score-product-demo.webm"
    );
  });

  test("cree une association, un show, une classe, le setup, le scoring et le live", async ({
    page,
  }) => {
    await seedCleanLocalDemo(page);

    await page.goto("/associations");
    await expect(page.getByRole("heading", { name: "Associations" })).toBeVisible();
    await showStep(page);

    await page
      .getByRole("button", { name: "Ajouter une association" })
      .click();
    await page.getByLabel("Nom", { exact: true }).fill("Association Demo Western");
    await page.getByLabel("Nom court").fill("ADW");
    await page
      .getByLabel("Site web")
      .fill("https://showscore.app/demo-western");
    await showStep(page);
    await page.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(page.locator("body")).toContainText("Association Demo Western");
    await showStep(page);

    await page.getByRole("link", { name: "Ouvrir les compétitions" }).click();
    const associationId = getIdFromUrl(
      page.url(),
      /\/associations\/([^/]+)\/shows$/,
      "associationId"
    );
    await expect(page.locator("body")).toContainText("Association Demo Western");

    await page.getByRole("button", { name: "+ Ajouter un show" }).click();
    const showInputs = page.locator("input");
    await showInputs.nth(0).fill("Derby ShowScore 2026");
    await showInputs.nth(1).fill("Saint-Hyacinthe, QC");
    await showInputs.nth(2).fill("Centre equestre Belle-Rive");
    await showInputs.nth(3).fill("2026-06-12");
    await showInputs.nth(4).fill("2026-06-14");
    await page.locator("select").first().selectOption("active");
    await showStep(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("body")).toContainText("Derby ShowScore 2026");
    await showStep(page);

    await page.getByRole("link", { name: "Ouvrir le show" }).click();
    const showId = getIdFromUrl(
      page.url(),
      /\/shows\/([^/]+)$/,
      "showId"
    );
    await expect(page.getByRole("heading", { name: "Derby ShowScore 2026" })).toBeVisible();

    await page.getByRole("button", { name: "+ Ajouter une journée" }).click();
    const dayInputs = page.locator("input");
    await dayInputs.nth(0).fill("Vendredi - Ranch Riding");
    await dayInputs.nth(1).fill("2026-06-12");
    await dayInputs.nth(2).fill("1");
    await showStep(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("body")).toContainText("Vendredi - Ranch Riding");
    await showStep(page);

    await page.getByRole("link", { name: "Ouvrir les classes" }).click();
    const dayId = getIdFromUrl(page.url(), /\/days\/([^/]+)$/, "dayId");
    await expect(page.locator("body")).toContainText("Vendredi - Ranch Riding");

    await page.getByRole("button", { name: "+ Ajouter une classe" }).click();
    const classInputs = page.locator("input");
    await classInputs.nth(0).fill("Ranch Riding Amateur");
    await classInputs.nth(1).fill("RR-A");
    await classInputs.nth(2).fill("Manège principal");
    const classSelects = page.locator("select");
    await classSelects.nth(0).selectOption("RR1");
    await classSelects.nth(1).selectOption("1");
    await showStep(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await showStep(page);

    await page.getByRole("link", { name: "Ouvrir setup" }).click();
    const classId = getIdFromUrl(
      page.url(),
      /\/classes\/([^/]+)\/setup$/,
      "classId"
    );
    await expect(page.getByRole("heading", { name: "Setup de classe" })).toBeVisible();

    await page.locator('input[placeholder="Juge 1"]').fill("Sophie Laroche");
    await page.locator("select").nth(2).selectOption("live");
    await page.getByRole("button", { name: "Importer un draw" }).click();
    await page.locator("textarea").fill(`1, 201, Camille Tremblay, Moonlight Whiz, Ferme Tremblay
2, 214, Marc-Antoine Roy, Smart Little Legend, Ecuries du Nord
3, 228, Lea Gagnon, Custom Chrome Star, Ranch Belle-Rive
4, 236, Olivier Martel, Shine Like Gold, Equipe Martel`);
    await showStep(page);
    await page
      .getByRole("button", { name: "Remplacer les runs avec cet import" })
      .click();
    await expect(page.locator("body")).toContainText("Camille Tremblay");
    await expect(page.locator("body")).toContainText("Olivier Martel");
    await waitForSetupRuns(page, classId, 4);
    await showStep(page);

    await seedScoringForSingleJudgeLive(page, classId);
    await page.goto(`/associations/${associationId}/scribe/classes/${classId}`);
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await expect(page.locator("body")).toContainText("Sophie Laroche");
    await expect(page.locator("body")).toContainText("72.0");
    await expect(page.locator("body")).toContainText("71.5");
    await showStep(page, 1500);

    await page.goto(`/public/associations/${associationId}/shows/${showId}`);
    await expect(page.getByRole("heading", { name: "Derby ShowScore 2026" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await showStep(page);

    await page
      .getByRole("button", { name: /Ranch Riding Amateur/ })
      .click();
    await expect(page.locator("body")).toContainText("En piste");
    await expect(page.locator("body")).toContainText(/En pr.paration/);
    await expect(page.locator("body")).toContainText("En attente");
    await expect(page.locator("body")).toContainText("Camille Tremblay");
    await expect(page.locator("body")).toContainText("Marc-Antoine Roy");
    await expect(page.locator("body")).toContainText("Lea Gagnon");
    await expect(page.locator("body")).toContainText("72.0");
    await expect(page.locator("body")).toContainText("71.5");
    await expect(page.locator("body")).toContainText("Run fluide");
    await showStep(page, 2500);

    expect(associationId).toBeTruthy();
    expect(showId).toBeTruthy();
    expect(dayId).toBeTruthy();
  });
});
