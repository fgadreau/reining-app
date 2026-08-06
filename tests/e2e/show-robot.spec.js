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

async function seedCompetitionVideoShow(page) {
  const seed = buildRobotShowStorageSeed();
  const show = seed.json["reining_shows_v1"].find(
    (item) => item.id === SHOW_ID
  );
  const activeRiderName =
    "Cavalier 3 avec un nom volontairement très long pour le grand écran";
  Object.assign(show, {
    isTvDisplayPaused: true,
    tvDisplayVideoPath: "https://example.test/arena-display.mp4",
    tvDisplayVideoName: "arena-display.mp4",
    tvDisplayVideoSize: 1024 * 1024 * 1024,
    tvDisplayVideoArena: "Manege Robot",
  });
  seed.json["reining_classes_v1"].find(
    (item) => item.id === CLASS_ID
  ).name =
    "Classe robot 5 juges avec un titre volontairement très long";
  seed.json["reining_class_setup_v1"][CLASS_ID].runs[2].rider =
    activeRiderName;
  seed.json["reining_class_setup_v1"][CLASS_ID].runs[2].owner =
    "Propriétaire avec une raison sociale volontairement très longue";
  Object.values(seed.json["showscore_judge_scoring_sessions_v1"]).forEach(
    (session) => {
      session.runs[2].rider = activeRiderName;
      session.runs[2].owner =
        "Propriétaire avec une raison sociale volontairement très longue";
    }
  );
  seed.json[`reining-scoring-runs-${CLASS_ID}`][2].rider = activeRiderName;
  seed.json[`reining-scoring-runs-${CLASS_ID}`][2].owner =
    "Propriétaire avec une raison sociale volontairement très longue";
  seed.json["reining_classes_v1"].push({
    id: "e2e-robot-annexe-class",
    associationId: ASSOCIATION_ID,
    showId: SHOW_ID,
    dayId: "e2e-robot-day",
    name: "Classe manège annexe",
    classCode: "ANNEXE",
    arena: "Manege Annexe",
    pattern: "RR3",
    sortOrder: 2,
  });

  await seedStorage(page, seed);
}

async function seedCompletedSimpleAnnouncerShow(page) {
  const seed = buildRobotShowStorageSeed();
  const setup = seed.json["reining_class_setup_v1"][CLASS_ID];
  const completedAt = "2026-05-28T16:00:00.000Z";
  const runs = setup.runs.map((run, index) => ({
    ...run,
    status: "scored",
    scoreTotal: String(80 - index),
    isComplete: true,
    startedAt: `2026-05-28T15:${String(index).padStart(2, "0")}:00.000Z`,
    completedAt: `2026-05-28T15:${String(index + 1).padStart(2, "0")}:00.000Z`,
  }));

  setup.liveDataSource = "announcer";
  setup.qualifiedRiderCount = 3;
  seed.json["showscore_announcer_live_sessions_v1"] = {
    [CLASS_ID]: {
      classId: CLASS_ID,
      runs,
      activeManoeuvre: null,
      startedAt: "2026-05-28T15:00:00.000Z",
      completedAt,
      completedBy: "Test local",
      revision: 12,
      updatedAt: completedAt,
    },
  };

  await seedStorage(page, seed);
}

async function seedActiveSingleJudgeAnnouncerShow(page) {
  const seed = buildRobotShowStorageSeed();
  const setup = seed.json["reining_class_setup_v1"][CLASS_ID];
  const firstJudge = setup.judges[0];
  const today = new Date().toISOString().slice(0, 10);
  const startedAt = "2026-05-28T15:00:00.000Z";
  const activeStartedAt = "2026-05-28T15:05:00.000Z";

  setup.pattern = "R16";
  setup.liveDataSource = "announcer";
  setup.judges = [firstJudge];
  setup.judgeName = firstJudge.name;
  seed.json["reining_shows_v1"][0].startDate = today;
  seed.json["reining_shows_v1"][0].endDate = today;
  seed.json["reining_days_v1"][0].date = today;
  seed.json["reining_classes_v1"].find(
    (classItem) => classItem.id === CLASS_ID
  ).pattern = "R16";

  const runs = setup.runs.map((run, index) => ({
    ...run,
    status: index < 2 ? "scored" : index === 2 ? "on_course" : "pending",
    scoreTotal: index === 0 ? "69½" : index === 1 ? "70" : "",
    judgeScores:
      index < 2
        ? [
            {
              judgeId: firstJudge.id,
              judgeName: firstJudge.name,
              scoreTotal: index === 0 ? "69½" : "70",
            },
          ]
        : [],
    isActive: index === 2,
    isComplete: index < 2,
    startedAt:
      index < 2
        ? `2026-05-28T15:0${index}:00.000Z`
        : index === 2
          ? activeStartedAt
          : null,
    completedAt:
      index < 2 ? `2026-05-28T15:0${index + 1}:00.000Z` : null,
  }));

  seed.json["showscore_announcer_live_sessions_v1"] = {
    [CLASS_ID]: {
      classId: CLASS_ID,
      runs,
      activeManoeuvre: {
        type: "run",
        runId: runs[2].id,
        draw: runs[2].draw,
        startedAt: activeStartedAt,
      },
      startedAt,
      completedAt: null,
      completedBy: null,
      revision: 5,
      updatedAt: activeStartedAt,
    },
  };

  await seedStorage(page, seed);
  return seed;
}

async function seedDailyLivestreamShow(page) {
  const seed = buildRobotShowStorageSeed();
  const show = seed.json["reining_shows_v1"].find(
    (item) => item.id === SHOW_ID
  );
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const calendarToday = `${values.year}-${values.month}-${values.day}`;
  const hourParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const currentHour = Number(
    hourParts.find((part) => part.type === "hour")?.value
  );
  const livestreamDate = new Date(`${calendarToday}T12:00:00.000Z`);
  if (Number.isFinite(currentHour) && currentHour < 4) {
    livestreamDate.setUTCDate(livestreamDate.getUTCDate() - 1);
  }
  const today = livestreamDate.toISOString().slice(0, 10);
  const tomorrowDate = new Date(`${today}T12:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  Object.assign(show, {
    startDate: today,
    endDate: tomorrow,
    isLivestreamPublic: true,
    livestreamUrl: "https://example.test/live-today",
    livestreamUrlsByDate: {
      [today]: '<iframe src="https://example.test/live-today"></iframe>',
      [tomorrow]: '<iframe src="https://example.test/live-tomorrow"></iframe>',
    },
  });

  await seedStorage(page, seed);
}

async function seedOverlayDragShow(page, { neutral = false } = {}) {
  const seed = buildRobotShowStorageSeed();
  const association = seed.json["reiningApp.associations"].find(
    (item) => item.id === ASSOCIATION_ID
  );
  const show = seed.json["reining_shows_v1"].find(
    (item) => item.id === SHOW_ID
  );

  if (neutral) {
    show.obsOverlayMode = "neutral";
  }
  const makeLogo = (label, color) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="white"/><text x="320" y="205" text-anchor="middle" font-family="Arial" font-size="88" font-weight="700" fill="${color}">${label}</text></svg>`
    )}`;

  association.sponsorGroups = [
    {
      id: "overlay-gold",
      name: "Or",
      logos: [
        { id: "gold-1", name: "Sponsor 1", logoDataUrl: makeLogo("S1", "#9a6b10") },
        { id: "gold-2", name: "Sponsor 2", logoDataUrl: makeLogo("S2", "#166534") },
        { id: "gold-3", name: "Sponsor 3", logoDataUrl: makeLogo("S3", "#1d4ed8") },
        { id: "gold-4", name: "Sponsor 4", logoDataUrl: makeLogo("S4", "#9f1239") },
      ],
    },
  ];

  const activeDrag = {
    type: "drag",
    afterIndex: 1,
    afterDraw: 2,
    durationMinutes: 8,
    startedAt: "2026-05-28T14:30:00.000Z",
  };
  Object.values(
    seed.json["showscore_judge_scoring_sessions_v1"]
  ).forEach((session) => {
    session.activeManoeuvre = activeDrag;
  });
  seed.json[`reining-scoring-active-manoeuvre-${CLASS_ID}`] = activeDrag;

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

  test("separe le livestream quotidien du pointage public", async ({ page }) => {
    await page.route("https://example.test/live-today", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Livestream du jour</body></html>",
      })
    );
    await page.route("https://example.test/live-tomorrow", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Livestream futur</body></html>",
      })
    );
    await seedDailyLivestreamShow(page);

    await page.goto(`/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`);
    await expect(
      page.getByRole("link", { name: "Voir le livestream" })
    ).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);

    await page.getByRole("link", { name: "Voir le livestream" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/livestream$`
      )
    );
    await expect(page.locator("iframe")).toHaveAttribute(
      "src",
      "https://example.test/live-today"
    );
    await expect(
      page.getByRole("link", { name: "Voir le pointage et l’avancement" })
    ).toBeVisible();
  });

  test("agrandit les commanditaires pendant le drag puis restaure le live", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await seedOverlayDragShow(page);
    await page.goto(
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/overlay`
    );

    const overlay = page.locator("main");
    const sponsors = page.locator('[data-overlay-sponsor-mode="takeover"]');
    await expect(overlay).toHaveAttribute(
      "data-overlay-layout",
      "sponsor-takeover"
    );
    await expect(sponsors).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "Drag en cours · Merci à nos commanditaires"
    );
    await expect(page.locator("[data-overlay-bottom-bar]")).toHaveCount(0);
    await expect
      .poll(async () => {
        const box = await sponsors.boundingBox();
        return box
          ? {
              x: Math.round(box.x),
              y: Math.round(box.y),
              width: Math.round(box.width),
              height: Math.round(box.height),
            }
          : null;
      })
      .toEqual({ x: 0, y: 0, width: 1920, height: 1080 });

    if (process.env.E2E_CAPTURE_OVERLAY_DRAG === "1") {
      await page.screenshot({
        path: "/tmp/overlay-drag-sponsors.png",
        fullPage: true,
      });
    }

    await page.evaluate((classId) => {
      const activeRun = {
        type: "run",
        draw: 3,
        startedAt: "2026-05-28T14:38:00.000Z",
      };
      const sessions = JSON.parse(
        window.localStorage.getItem("showscore_judge_scoring_sessions_v1") ||
          "{}"
      );
      Object.values(sessions).forEach((session) => {
        session.activeManoeuvre = activeRun;
      });
      window.localStorage.setItem(
        "showscore_judge_scoring_sessions_v1",
        JSON.stringify(sessions)
      );
      window.localStorage.setItem(
        `reining-scoring-active-manoeuvre-${classId}`,
        JSON.stringify(activeRun)
      );
    }, CLASS_ID);

    await expect(overlay).toHaveAttribute("data-overlay-layout", "live", {
      timeout: 8000,
    });
    await expect(
      page.locator('[data-overlay-sponsor-mode="rail"]')
    ).toBeVisible();
    await expect(page.locator("[data-overlay-bottom-bar]")).toBeVisible();
  });

  test("garde l'overlay neutre inchangé pendant un drag", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await seedOverlayDragShow(page, { neutral: true });
    await page.goto(
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/overlay`
    );

    const overlay = page.locator("main");
    await expect(overlay).toHaveAttribute("data-overlay-layout", "neutral");
    await expect(
      page.locator('[data-overlay-sponsor-mode="rail"]')
    ).toBeVisible();
    await expect(page.locator("[data-overlay-bottom-bar]")).toBeVisible();
    await expect(page.locator("body")).toContainText("Vous regardez");
    await expect(page.locator("body")).toContainText("Robot Derby local");
    await expect(
      page.locator('[data-overlay-sponsor-mode="takeover"]')
    ).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      "Drag en cours · Merci à nos commanditaires"
    );
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

  test("garde toutes les zones TV separees sur un viewport Fire Stick", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.route("**/rest/v1/**", (route) => route.abort());
    await seedRobotShowOnLastRun(page);

    await page.goto(
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv`
    );

    const header = page.locator(".tv-header");
    const live = page.locator(".tv-live-grid");
    const sponsors = page.locator(".tv-sponsor-rail");
    const qr = page.locator("[data-tv-public-qr]");

    await expect(header).toBeVisible();
    await expect(live).toBeVisible();
    await expect(sponsors).toBeVisible();
    await expect(qr).toBeVisible();

    await expect
      .poll(async () => {
        const [headerBox, liveBox, sponsorBox, qrBox, documentSize] =
          await Promise.all([
            header.boundingBox(),
            live.boundingBox(),
            sponsors.boundingBox(),
            qr.boundingBox(),
            page.evaluate(() => ({
              width: document.documentElement.scrollWidth,
              height: document.documentElement.scrollHeight,
            })),
          ]);

        return {
          headerBeforeLive:
            headerBox.y + headerBox.height <= liveBox.y + 1,
          liveBeforeSponsors:
            liveBox.y + liveBox.height <= sponsorBox.y + 1,
          sponsorsInsideViewport:
            sponsorBox.y + sponsorBox.height <= 540,
          qrInsideViewport: qrBox.x + qrBox.width <= 960,
          noHorizontalOverflow: documentSize.width <= 960,
          noVerticalOverflow: documentSize.height <= 540,
        };
      })
      .toEqual({
        headerBeforeLive: true,
        liveBeforeSponsors: true,
        sponsorsInsideViewport: true,
        qrInsideViewport: true,
        noHorizontalOverflow: true,
        noVerticalOverflow: true,
      });

    if (process.env.E2E_CAPTURE_TV_FIRESTICK === "1") {
      await page.screenshot({
        path: "/tmp/tv-firestick-live-960x540.png",
      });
    }
  });

  test("garde la video du manege principal avec les donnees live dessous", async ({
    page,
  }) => {
    await page.route("https://example.test/arena-display.mp4", (route) =>
      route.fulfill({
        status: 200,
        contentType: "video/mp4",
        body: Buffer.from([]),
      })
    );
    await seedCompetitionVideoShow(page);

    await page.goto(
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv?mode=competition&arena=Manege%20Robot`
    );

    await expect(page.locator('[data-tv-layout="competition-video"]')).toBeVisible();
    await expect(page.locator("[data-tv-public-qr]")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Live en pause");
    await expect(page.locator("[data-tv-competition-video]")).toHaveAttribute(
      "loop",
      ""
    );
    await expect(page.locator("[data-tv-live-strip]")).toContainText(
      "Classe robot 5 juges"
    );
    await expect(page.locator("[data-tv-live-strip]")).toContainText(
      "Cavalier 3"
    );
    await expect(
      page.locator('[data-tv-overflow-text="class-name"]')
    ).toHaveAttribute("data-tv-scrolling", "true");
    await expect(
      page
        .locator('[data-tv-overflow-text="participant-name"]')
        .filter({ hasText: "Cavalier 3" })
    ).toHaveAttribute("data-tv-scrolling", "true");
    await expect(page.locator("[data-sponsor-layout]")).toHaveCount(0);

    await page.goto(
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv?mode=competition&arena=Autre`
    );
    await expect(
      page.locator('[data-tv-layout="competition-loading"]')
    ).toBeVisible();
    await expect(page.locator("[data-tv-public-qr]")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Live en pause");
    await expect(page.locator("[data-sponsor-layout]")).toHaveCount(0);

    await page.goto(
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv?arena=Autre`
    );
    await expect(page.locator('[data-tv-layout="competition-video"]')).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Live en pause");
    await expect(page.locator("[data-sponsor-layout]")).toBeVisible();
    await expect(page.locator("[data-tv-public-qr]")).toBeVisible();
  });

  test("separe clairement les reglages TV generaux et competition", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 1000 });
    await seedCompetitionVideoShow(page);
    await page.goto(`/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`);
    await page.getByRole("button", { name: /Réglages Live/ }).click();

    const general = page.locator('[data-tv-settings="general"]');
    const competition = page.locator('[data-tv-settings="competition"]');
    const dialog = page.getByRole("dialog");

    await expect(dialog).toContainText("Livestream public par journée");
    await expect(dialog).toContainText("Liens vidéo par journée");
    await expect(
      dialog.getByLabel("Lien du livestream pour le 2026-05-28")
    ).toBeVisible();

    await expect(general).toContainText(
      "Affichage TV général — autres écrans"
    );
    await expect(general).toContainText(
      "Mettre seulement les écrans généraux en pause"
    );
    await expect(competition).toContainText(
      "Écran du manège de compétition"
    );
    await expect(competition).toContainText("Manège de compétition seulement");
    await expect(competition).toContainText("Manege Robot");
    await expect(
      competition.getByRole("link", {
        name: "Ouvrir l’écran de compétition",
      })
    ).toHaveAttribute("href", /^\/tv\/[A-Z0-9]{6}$/);
    await expect(general.locator("select option")).toHaveText([
      "Manege Annexe",
    ]);

    const [generalBackground, competitionBackground] = await Promise.all([
      general.evaluate((element) => getComputedStyle(element).backgroundImage),
      competition.evaluate(
        (element) => getComputedStyle(element).backgroundImage
      ),
    ]);
    expect(generalBackground).not.toBe(competitionBackground);

    if (process.env.E2E_CAPTURE_TV_SETTINGS === "1") {
      await page.getByRole("dialog").screenshot({
        path: "/tmp/tv-settings-redesign.png",
      });
      await competition.screenshot({
        path: "/tmp/tv-competition-card.png",
      });
    }
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
    await expect(page.locator("body")).toContainText(
      "appuie sur Entrée pour l’enregistrer"
    );
    await page.getByLabel("Juge Echo").press("Enter");
    await expect(
      page.getByRole("button", { name: "Entrer le résultat" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Démarrer prochain" })
    ).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Propriétaire: Proprio 4");
    await expect(page.getByRole("button", { name: "Scratch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "No score" })).toBeVisible();

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

  test("enregistre au clavier un résultat annonceur à un juge sur laptop", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await seedActiveSingleJudgeAnnouncerShow(page);

    await page.goto(
      `/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/announcer`
    );
    await page.getByRole("button", { name: "Entrer le résultat" }).click();

    const scoreInput = page.getByLabel("Juge Alpha");
    await expect(scoreInput).toBeFocused();
    await scoreInput.fill("score");
    await expect(page.getByRole("alert")).toContainText(
      "pointage numérique valide"
    );
    await expect(
      page.getByRole("button", { name: "Enregistrer le score" })
    ).toBeDisabled();
    await scoreInput.fill("70,5");
    await scoreInput.press("Enter");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Proprio 4");
    await expect(page.locator("body")).toContainText("#3 · 70½");
    await expect
      .poll(() =>
        page.evaluate((classId) => {
          const sessions = JSON.parse(
            window.localStorage.getItem(
              "showscore_announcer_live_sessions_v1"
            ) || "{}"
          );
          const run = sessions[classId]?.runs?.find(
            (item) => Number(item.draw) === 3
          );
          return {
            status: run?.status || "",
            scoreTotal: run?.scoreTotal || "",
            nextActiveDraw:
              sessions[classId]?.activeManoeuvre?.draw || null,
          };
        }, CLASS_ID)
      )
      .toEqual({
        status: "scored",
        scoreTotal: "70½",
        nextActiveDraw: 4,
      });
  });

  test("garde la TV synchronisée quand le score annonceur démarre le suivant", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    const seed = await seedActiveSingleJudgeAnnouncerShow(page);

    const tvPage = await page.context().newPage();
    await tvPage.route("**/rest/v1/**", (route) => route.abort());
    await seedStorage(tvPage, seed);
    await tvPage.goto(
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv`
    );
    await expect(
      tvPage.locator(".tv-live-hero .tv-participant-card__name")
    ).toContainText("Cavalier 3");

    await page.goto(
      `/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/announcer`
    );
    await page.getByRole("button", { name: "Entrer le résultat" }).click();
    await page.getByLabel("Juge Alpha").fill("70,5");
    await page.getByLabel("Juge Alpha").press("Enter");

    await expect
      .poll(
        () =>
          tvPage
            .locator(".tv-live-hero .tv-participant-card__name")
            .textContent(),
        { timeout: 8_000 }
      )
      .toContain("Cavalier 4");

    await tvPage.close();
  });

  test("affiche la liste de rappel apres un bloc annonceur simple termine", async ({
    page,
  }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await seedCompletedSimpleAnnouncerShow(page);

    await page.goto(
      `/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/announcer`
    );

    const classCard = page.locator(
      `[data-announcer-class-id="${CLASS_ID}"]`
    );
    await expect(classCard).toHaveAttribute(
      "data-announcer-class-complete",
      "true"
    );
    await expect(classCard).toHaveAttribute("data-qualified-rider-count", "3");
    await expect(classCard).toHaveAttribute("data-standing-group-count", "1");
    const qualifiedButton = page.getByRole("button", {
      name: "Liste des cavaliers classés",
    });
    await expect(qualifiedButton).toBeVisible();
    await qualifiedButton.click();
    await expect(page.getByRole("dialog")).toContainText("Cavalier 1");
    await expect(page.getByRole("dialog")).toContainText("3 cavalier(s)");
  });

  test("importe et fait defiler les commanditaires par niveau", async ({
    page,
  }) => {
    await seedRobotShow(page);
    await page.goto(`/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}`);
    await page.getByRole("button", { name: /Réglages Live/ }).click();

    const dialog = page.getByRole("dialog");
    const tvShortCodeBadge = dialog.locator("[data-tv-short-code]");
    await expect(tvShortCodeBadge).toBeVisible();
    const tvShortCode = await tvShortCodeBadge.getAttribute(
      "data-tv-short-code"
    );
    expect(tvShortCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await expect(
      dialog.getByRole("link", { name: "Ouvrir écran TV général" })
    ).toHaveAttribute("href", `/tv/${tvShortCode}`);
    await dialog.getByRole("button", { name: "+ Ajouter un niveau" }).click();
    const firstSponsorLevelInput = dialog.getByPlaceholder(
      "Nom du niveau (ex. Argent)"
    );
    await firstSponsorLevelInput.fill("Argent");
    await firstSponsorLevelInput.pressSequentially(
      " / Silver Partenaire Prestige Extraordinaire"
    );
    await dialog.locator('input[type="file"][accept="image/*"]').nth(0).setInputFiles([
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
    await dialog.locator('input[type="file"][accept="image/*"]').nth(1).setInputFiles({
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
      .toEqual([
        "Argent / Silver Partenaire Prestige Extraordinaire",
        "Bronze",
      ]);

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
      `/tv/${tvShortCode}`
    );
    await expect(page).toHaveURL(
      new RegExp(
        `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv$`
      )
    );
    const sponsorRail = page.locator('[data-sponsor-layout="expanded"]');
    const sponsorTitle = sponsorRail.locator("[data-sponsor-title]");
    const sponsorLevel = sponsorRail.locator("[data-sponsor-level]");
    const publicShowQr = page.locator("[data-tv-public-qr]");

    await expect(sponsorRail).toBeVisible();
    await expect(publicShowQr).toBeVisible();
    await expect(publicShowQr).toHaveAttribute(
      "data-tv-public-url",
      new RegExp(
        `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}$`
      )
    );
    await expect(publicShowQr.locator("svg")).toBeVisible();
    await expect
      .poll(async () => {
        const qrBox = await publicShowQr.locator("svg").boundingBox();
        return {
          isLargeEnough: qrBox.width >= 82 && qrBox.height >= 82,
          isSquare: Math.abs(qrBox.width - qrBox.height) < 1,
        };
      })
      .toEqual({ isLargeEnough: true, isSquare: true });
    await expect(
      page.getByRole("heading", { level: 1, name: "Robot Derby local" })
    ).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "Argent / Silver Partenaire Prestige Extraordinaire"
    );
    await expect(sponsorLevel).toHaveText(
      "Argent / Silver Partenaire Prestige Extraordinaire"
    );
    await expect(sponsorLevel).toHaveAttribute("data-tv-scrolling", "true");
    const scrollingSponsorLevelText = sponsorLevel.locator("span");
    const sponsorLevelStartX = await scrollingSponsorLevelText.evaluate(
      (element) => element.getBoundingClientRect().x
    );
    await expect
      .poll(
        () =>
          scrollingSponsorLevelText.evaluate(
            (element, startX) =>
              Math.abs(element.getBoundingClientRect().x - startX) > 5,
            sponsorLevelStartX
          ),
        { timeout: 4000 }
      )
      .toBe(true);
    await expect
      .poll(async () => {
        const titleBox = await sponsorTitle.boundingBox();
        const levelBox = await sponsorLevel.boundingBox();
        const [
          titleFontSize,
          levelFontSize,
          titleColor,
          levelColor,
          levelLineHeight,
          levelPaddingBottom,
        ] =
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
            sponsorLevel.evaluate((element) =>
              Number.parseFloat(window.getComputedStyle(element).lineHeight)
            ),
            sponsorLevel.evaluate((element) =>
              Number.parseFloat(window.getComputedStyle(element).paddingBottom)
            ),
          ]);

        return {
          isBelow: levelBox.y > titleBox.y,
          isLarger: levelFontSize > titleFontSize,
          hasDifferentColor: levelColor !== titleColor,
          hasDescenderRoom:
            levelLineHeight > levelFontSize && levelPaddingBottom > 0,
        };
      })
      .toEqual({
        isBelow: true,
        isLarger: true,
        hasDifferentColor: true,
        hasDescenderRoom: true,
      });
    await expect(page.locator("body")).toContainText("Bronze", {
      timeout: 12000,
    });

    await navigateSpa(page, "/tv");
    await expect(page.locator("[data-tv-shortcut-page]")).toBeVisible();
    await expect(page.locator("body")).toContainText("Robot Derby local");
    await page.getByRole("button", { name: "Rouvrir / Reopen" }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv$`
      )
    );

    await navigateSpa(
      page,
      `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/overlay`
    );
    await expect(page.locator("body")).toContainText(
      "Argent / Silver Partenaire Prestige Extraordinaire"
    );
  });
});
