const { expect, test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const LOCAL_TEST_EMAIL = "test@showscore.local";
const DEMO_PARTICIPANTS = [
  ["1", "201", "Camille Tremblay", "Moonlight Whiz", "Ferme Tremblay"],
  ["2", "214", "Marc-Antoine Roy", "Smart Little Legend", "Ecuries du Nord"],
  ["3", "228", "Lea Gagnon", "Custom Chrome Star", "Ranch Belle-Rive"],
  ["4", "236", "Olivier Martel", "Shine Like Gold", "Equipe Martel"],
  ["5", "241", "Anais Bouchard", "Lil Ruf Jac", "Ecurie Bouchard"],
  ["6", "252", "Thomas Pelletier", "Hollywood Step", "Pelletier Performance"],
  ["7", "267", "Noemie Fortin", "Gunna Be Chic", "Ferme Fortin"],
  ["8", "279", "Julien Caron", "Sailin Spark", "Caron Ranch"],
];
const DEMO_PAID_WARMUP_ID = "demo-paid-warmup-open-arena";
const DEMO_PAID_WARMUP_PARTICIPANTS = [
  "Lucie Charbonneau",
  "Felix Goudreau",
  "Maya Desrosiers",
  "Antoine Perreault",
  "Sarah Nguyen",
  "Vincent Morin",
];

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
    const seedFlag = "showscore.product-demo.seeded";

    if (window.sessionStorage.getItem(seedFlag) === "1") {
      return;
    }

    window.localStorage.clear();
    window.sessionStorage.setItem(seedFlag, "1");
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
    window.localStorage.setItem("reining_class_records_v1", JSON.stringify({}));
    window.localStorage.setItem(
      "reining_publication_states_v1",
      JSON.stringify({})
    );
    window.localStorage.setItem("showscore_app_events_v1", JSON.stringify([]));
  }, makeLocalTestSession());
}

function buildDemoLogoDataUrl(label, fill, textColor = "#ffffff") {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">',
    `<rect width="320" height="180" rx="24" fill="${fill}"/>`,
    '<circle cx="62" cy="58" r="26" fill="rgba(255,255,255,0.22)"/>',
    '<path d="M70 118c38-62 88-62 150 0" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="14" stroke-linecap="round"/>',
    `<text x="160" y="98" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="${textColor}">${label}</text>`,
    '</svg>',
  ].join("");

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function seedPublicShowTools(page, associationId, showId) {
  const sponsorLogos = [
    {
      id: "demo-sponsor-nutrition",
      name: "EquiPlus Nutrition",
      logoDataUrl: buildDemoLogoDataUrl("EQUI+", "#0f766e"),
    },
    {
      id: "demo-sponsor-saddles",
      name: "Selles Nord",
      logoDataUrl: buildDemoLogoDataUrl("NORD", "#1d4ed8"),
    },
  ];

  await page.evaluate(
    ({ targetAssociationId, targetShowId, logos }) => {
      const shows = JSON.parse(
        window.localStorage.getItem("reining_shows_v1") || "[]"
      );
      window.localStorage.setItem(
        "reining_shows_v1",
        JSON.stringify(
          shows.map((show) =>
            show.id === targetShowId
              ? {
                  ...show,
                  status: "active",
                  isLivestreamPublic: true,
                  livestreamUrl: "https://youtu.be/dQw4w9WgXcQ",
                  isSchedulePublic: true,
                }
              : show
          )
        )
      );

      const associations = JSON.parse(
        window.localStorage.getItem("reiningApp.associations") || "[]"
      );
      window.localStorage.setItem(
        "reiningApp.associations",
        JSON.stringify(
          associations.map((association) =>
            association.id === targetAssociationId
              ? {
                  ...association,
                  logoDataUrl: association.logoDataUrl || logos[0].logoDataUrl,
                  websiteUrl:
                    association.websiteUrl || "https://showscore.app/demo-western",
                  sponsorLogos: logos,
                }
              : association
          )
        )
      );
    },
    { targetAssociationId: associationId, targetShowId: showId, logos: sponsorLogos }
  );
}

async function seedDemoPaidWarmup(page, options) {
  const {
    associationId,
    showId,
    dayId,
    isPublicLive = false,
    completedCount = 0,
    activeEntryIndex = null,
  } = options;

  await page.evaluate(
    ({
      targetAssociationId,
      targetShowId,
      targetDayId,
      warmupId,
      participants,
      publicLive,
      completedEntries,
      activeIndex,
    }) => {
      const entries = participants.map((rider, index) => {
        const isCompleted = index < completedEntries;
        const isNoShow = isCompleted && index === 1;

        return {
          id: `${warmupId}-entry-${index + 1}`,
          order: index + 1,
          rider,
          status: isCompleted ? (isNoShow ? "no_show" : "done") : "pending",
          completedAt: isCompleted
            ? `2026-06-12T13:${String(44 + index * 3).padStart(2, "0")}:00.000Z`
            : null,
        };
      });
      const activeEntry =
        Number.isInteger(activeIndex) && activeIndex >= 0
          ? entries[activeIndex]
          : null;
      const warmup = {
        id: warmupId,
        associationId: targetAssociationId,
        showId: targetShowId,
        dayId: targetDayId,
        name: "Paid warm up ouvert",
        arena: "Manège principal",
        durationMinutesPerRider: 3,
        dragInterval: 3,
        dragDurationMinutes: 5,
        scheduleStartMode: "after_previous",
        scheduleStartTime: "",
        isPublicLive: Boolean(publicLive),
        activeEntryId: activeEntry?.id || null,
        activeStartedAt: activeEntry
          ? new Date(Date.now() - 95 * 1000).toISOString()
          : null,
        entries,
        sortOrder: 2,
        createdAt: "2026-06-12T13:30:00.000Z",
        updatedAt: new Date().toISOString(),
      };
      const allWarmups = JSON.parse(
        window.localStorage.getItem("reining_paid_warmups_v1") || "[]"
      );

      window.localStorage.setItem(
        "reining_paid_warmups_v1",
        JSON.stringify([
          ...allWarmups.filter((item) => item.id !== warmupId),
          warmup,
        ])
      );
    },
    {
      targetAssociationId: associationId,
      targetShowId: showId,
      targetDayId: dayId,
      warmupId: DEMO_PAID_WARMUP_ID,
      participants: DEMO_PAID_WARMUP_PARTICIPANTS,
      publicLive: isPublicLive,
      completedEntries: completedCount,
      activeIndex: activeEntryIndex,
    }
  );

  return DEMO_PAID_WARMUP_ID;
}

async function seedDemoAuditEvents(page, ids) {
  await page.evaluate(
    ({ associationId, showId, dayId, classId, actorEmail }) => {
      const currentEvents = JSON.parse(
        window.localStorage.getItem("showscore_app_events_v1") || "[]"
      );
      const demoEvents = [
        {
          id: "demo-audit-public-tools",
          eventType: "audit",
          eventName: "public_tools_reviewed",
          associationId,
          showId,
          dayId,
          classId,
          actorEmail,
          path: `/associations/${associationId}/shows/${showId}`,
          metadata: {
            scope: "livestream_schedule_overlay",
          },
          createdAt: "2026-06-12T15:15:00.000Z",
        },
        {
          id: "demo-audit-secretariat-publish",
          eventType: "audit",
          eventName: "secretariat_published_scoresheet",
          associationId,
          showId,
          dayId,
          classId,
          actorEmail,
          path: `/associations/${associationId}/shows/${showId}/secretariat`,
          metadata: {
            className: "Ranch Riding Amateur",
          },
          createdAt: "2026-06-12T15:18:00.000Z",
        },
      ];

      window.localStorage.setItem(
        "showscore_app_events_v1",
        JSON.stringify([
          ...demoEvents,
          ...currentEvents.filter(
            (event) => !demoEvents.some((demoEvent) => demoEvent.id === event.id)
          ),
        ])
      );
    },
    { ...ids, actorEmail: LOCAL_TEST_EMAIL }
  );
}

async function showStep(page, extraMs = 0) {
  if (process.env.E2E_SHOW_STEPS !== "1") return;

  const pauseMs = Number(process.env.E2E_STEP_PAUSE || 1500);
  await page.waitForTimeout(pauseMs + extraMs);
}

function isDemoPacingEnabled() {
  return process.env.E2E_DEMO_PACING === "1";
}

async function demoPause(page, ms = 1200) {
  if (!isDemoPacingEnabled()) return;
  await page.waitForTimeout(ms);
}

async function installDemoCursor(page) {
  await page.addInitScript(() => {
    window.__showScoreEnsureDemoCursor = () => {
      if (!document.body || document.getElementById("showscore-demo-cursor")) {
        return;
      }

      const style = document.createElement("style");
      style.id = "showscore-demo-cursor-style";
      style.textContent = `
        #showscore-demo-cursor {
          position: fixed;
          left: 0;
          top: 0;
          width: 34px;
          height: 34px;
          border: 4px solid #ff2d55;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.5);
          box-shadow: 0 0 0 8px rgba(255, 45, 85, 0.18), 0 10px 24px rgba(15, 23, 42, 0.28);
          pointer-events: none;
          z-index: 2147483647;
          transform: translate(24px, 24px);
          transition: transform 420ms ease, opacity 180ms ease;
          opacity: 0.96;
        }

        #showscore-demo-cursor::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #ff2d55;
          transform: translate(-50%, -50%);
        }

        #showscore-demo-cursor-label {
          position: absolute;
          left: 40px;
          top: -4px;
          min-width: 120px;
          padding: 5px 8px;
          border-radius: 8px;
          background: #111827;
          color: #fff;
          font: 700 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          white-space: nowrap;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.25);
        }
      `;
      document.head.appendChild(style);

      const cursor = document.createElement("div");
      cursor.id = "showscore-demo-cursor";
      const label = document.createElement("div");
      label.id = "showscore-demo-cursor-label";
      label.textContent = "Démo";
      cursor.appendChild(label);
      document.body.appendChild(cursor);
    };

    window.__showScoreMoveDemoCursor = (x, y, labelText = "Démo") => {
      window.__showScoreEnsureDemoCursor?.();
      const cursor = document.getElementById("showscore-demo-cursor");
      const label = document.getElementById("showscore-demo-cursor-label");

      if (!cursor) return;
      cursor.style.transform = `translate(${x - 17}px, ${y - 17}px)`;
      if (label) label.textContent = labelText;
    };

    window.addEventListener("DOMContentLoaded", () => {
      window.__showScoreEnsureDemoCursor?.();
    });
  });
}

async function ensureDemoCursor(page) {
  if (!isDemoPacingEnabled()) return;
  await page.evaluate(() => window.__showScoreEnsureDemoCursor?.());
}

async function moveDemoCursorTo(page, locator, label = "Démo") {
  if (!isDemoPacingEnabled()) return;

  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;

  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 28);
  await page.evaluate(
    ({ cursorX, cursorY, cursorLabel }) =>
      window.__showScoreMoveDemoCursor?.(cursorX, cursorY, cursorLabel),
    { cursorX: x, cursorY: y, cursorLabel: label }
  );
  await page.mouse.move(x, y, { steps: 10 });
  await demoPause(page, 450);
}

async function demoClick(page, locator, label = "Cliquer") {
  await moveDemoCursorTo(page, locator, label);
  await locator.click();
  await demoPause(page, 750);
}

async function demoFill(page, locator, value, label = "Remplir") {
  await moveDemoCursorTo(page, locator, label);
  await locator.fill(value);
  await demoPause(page, 400);
}

async function demoSelect(page, locator, value, label = "Choisir") {
  await moveDemoCursorTo(page, locator, label);
  await locator.selectOption(value);
  await demoPause(page, 500);
}

async function demoGoto(page, url) {
  await page.goto(url);
  await ensureDemoCursor(page);
  await demoPause(page, 1000);
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
        setup?.pattern === "RR1" &&
        String(setup?.dragInterval || "") === "2"
      );
    },
    { targetClassId: classId, runCount: expectedRunCount }
  );
}

async function seedLiveScoringState(page, classId, options = {}) {
  await page.evaluate(({ targetClassId, state }) => {
    const setups = JSON.parse(
      window.localStorage.getItem("reining_class_setup_v1") || "{}"
    );
    const setup = setups[targetClassId];
    const setupRuns = Array.isArray(setup?.runs) ? setup.runs : [];
    const manoeuvreCount = 13;
    const now = state.now || "2026-06-12T14:20:00.000Z";
    const completedCount = Number(state.completedCount) || 0;
    const activeRunIndex =
      state.activeRunIndex === null || state.activeRunIndex === undefined
        ? null
        : Number(state.activeRunIndex);
    const activeManeuverCount = Math.max(Number(state.activeManeuverCount) || 3, 0);

    function makeScores(halfPointCount, cellCount) {
      return Array.from({ length: manoeuvreCount }, (_, index) => {
        if (index >= cellCount) return "";
        return index < halfPointCount ? "+0.5" : "0";
      });
    }

    const scoreProfiles = [
      { halfPoints: 4, total: "72.0", complete: true },
      { halfPoints: 3, total: "71.5", complete: true },
      { halfPoints: 5, total: "72.5", complete: true },
      { halfPoints: 2, total: "71.0", complete: true },
      { halfPoints: 1, total: "70.5", complete: true },
      { halfPoints: 6, total: "73.0", complete: true },
      { halfPoints: 0, total: "70.0", complete: true },
      { halfPoints: 4, total: "72.0", complete: true },
    ];

    const scoringRuns = setupRuns.map((run, index) => {
      const profile =
        scoreProfiles[index] || scoreProfiles[scoreProfiles.length - 1];
      const complete = index < completedCount;
      const active = activeRunIndex === index;
      const cellCount = complete
        ? manoeuvreCount
        : active
          ? Math.min(activeManeuverCount, manoeuvreCount)
          : 0;

      return {
        ...run,
        scores: makeScores(profile.halfPoints, cellCount),
        penalties: Array.from({ length: manoeuvreCount }, () => ""),
        penTotal: "",
        scoreTotal: complete ? profile.total : "",
        status: complete ? "completed" : "",
        note:
          index === 0
            ? "Run fluide, belle transition au lope."
            : index === 1
              ? "Bon controle, leger ajustement au changement de pied."
              : index === 5
                ? "Excellent controle, cadence tres reguliere."
              : "",
        isActive: active,
        startedAt: `2026-06-12T14:${String(10 + index * 3).padStart(
          2,
          "0"
        )}:00.000Z`,
        completedAt: complete
          ? `2026-06-12T14:${String(12 + index * 3).padStart(2, "0")}:00.000Z`
          : null,
        durationSeconds: complete ? 92 + index * 4 : null,
      };
    });

    setups[targetClassId] = {
      ...setup,
      startedAt: setup?.startedAt || "2026-06-12T14:10:00.000Z",
      dragInterval: 2,
      dragDurationMinutes: 4,
    };
    window.localStorage.setItem("reining_class_setup_v1", JSON.stringify(setups));
    window.localStorage.setItem(
      `reining-scoring-runs-${targetClassId}`,
      JSON.stringify(scoringRuns)
    );

    if (activeRunIndex === null) {
      window.localStorage.removeItem(`reining-scoring-active-manoeuvre-${targetClassId}`);
    } else {
      const activeRun = setupRuns[activeRunIndex];
      window.localStorage.setItem(
        `reining-scoring-active-manoeuvre-${targetClassId}`,
        JSON.stringify({
          draw: activeRun?.draw ?? activeRun?.order ?? activeRunIndex + 1,
          manoeuvreIndex: Math.min(activeManeuverCount, manoeuvreCount - 1),
        })
      );
    }

    const publications = JSON.parse(
      window.localStorage.getItem("reining_publication_states_v1") || "{}"
    );
    publications[targetClassId] = {
      classId: targetClassId,
      status: state.publicationStatus || "live",
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
  }, { targetClassId: classId, state: options });
}

async function seedSignedOfficialClass(page, classId) {
  await seedLiveScoringState(page, classId, {
    completedCount: DEMO_PARTICIPANTS.length,
    activeRunIndex: null,
    publicationStatus: "live_finished",
    now: "2026-06-12T15:05:00.000Z",
  });

  await page.evaluate((targetClassId) => {
    const setups = JSON.parse(
      window.localStorage.getItem("reining_class_setup_v1") || "{}"
    );
    const setup = setups[targetClassId] || {};
    const scoringRuns = JSON.parse(
      window.localStorage.getItem(`reining-scoring-runs-${targetClassId}`) || "[]"
    );
    const finalizedAt = "2026-06-12T15:08:00.000Z";
    const finalPdfFileName =
      "ADW-Derby-ShowScore-2026-Ranch-Riding-Amateur-officiel.pdf";

    setups[targetClassId] = {
      ...setup,
      finalized: true,
      finalizedAt,
      judgeSignedAt: finalizedAt,
      judgeSignature: "demo-signature-sophie-laroche",
      finalPdfFileName,
    };
    window.localStorage.setItem("reining_class_setup_v1", JSON.stringify(setups));

    const records = JSON.parse(
      window.localStorage.getItem("reining_class_records_v1") || "{}"
    );
    records[targetClassId] = {
      id: targetClassId,
      official: {
        judgeName: setup.judgeName || "Sophie Laroche",
        judgeSignature: "demo-signature-sophie-laroche",
        finalized: true,
        finalizedAt,
        judgeSignedAt: finalizedAt,
        secretariatValidatedAt: null,
        finalPdfFileName,
        customPattern: setup.customPattern || null,
        officialRuns: scoringRuns,
      },
    };
    window.localStorage.setItem("reining_class_records_v1", JSON.stringify(records));
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
    await installDemoCursor(page);
    await seedCleanLocalDemo(page);

    await demoGoto(page, "/associations");
    await expect(page.getByRole("heading", { name: "Associations" })).toBeVisible();
    await showStep(page);

    await demoClick(
      page,
      page.getByRole("button", { name: "Ajouter une association" }),
      "Créer l'association"
    );
    await demoFill(
      page,
      page.getByLabel("Nom", { exact: true }),
      "Association Demo Western",
      "Nom de l'association"
    );
    await demoFill(page, page.getByLabel("Nom court"), "ADW", "Abréviation");
    await demoFill(
      page,
      page.getByLabel("Site web"),
      "https://showscore.app/demo-western",
      "Site web"
    );
    await showStep(page);
    await demoClick(
      page,
      page.getByRole("button", { name: "Ajouter", exact: true }),
      "Enregistrer"
    );
    await expect(page.locator("body")).toContainText("Association Demo Western");
    await showStep(page);

    await demoClick(
      page,
      page.getByRole("link", { name: "Ouvrir les compétitions" }),
      "Compétitions"
    );
    const associationId = getIdFromUrl(
      page.url(),
      /\/associations\/([^/]+)\/shows$/,
      "associationId"
    );
    await expect(page.locator("body")).toContainText("Association Demo Western");

    await demoClick(
      page,
      page.getByRole("button", { name: "+ Ajouter un show" }),
      "Créer un show"
    );
    const showInputs = page.locator("input");
    await demoFill(page, showInputs.nth(0), "Derby ShowScore 2026", "Nom du show");
    await demoFill(page, showInputs.nth(1), "Saint-Hyacinthe, QC", "Ville");
    await demoFill(page, showInputs.nth(2), "Centre equestre Belle-Rive", "Site");
    await demoFill(page, showInputs.nth(3), "2026-06-12", "Début");
    await demoFill(page, showInputs.nth(4), "2026-06-14", "Fin");
    await demoSelect(page, page.locator("select").first(), "active", "Statut actif");
    await showStep(page);
    await demoClick(page, page.getByRole("button", { name: "Enregistrer" }), "Enregistrer");
    await expect(page.locator("body")).toContainText("Derby ShowScore 2026");
    await showStep(page);

    await demoClick(page, page.getByRole("link", { name: "Ouvrir le show" }), "Ouvrir le show");
    const showId = getIdFromUrl(
      page.url(),
      /\/shows\/([^/]+)$/,
      "showId"
    );
    await expect(page.getByRole("heading", { name: "Derby ShowScore 2026" })).toBeVisible();
    await expect(page.locator("body")).toContainText("vendredi 12 juin");
    await showStep(page);

    await demoClick(
      page,
      page.getByRole("link", { name: "Ouvrir les blocs" }).first(),
      "Blocs"
    );
    const dayId = getIdFromUrl(page.url(), /\/days\/([^/]+)$/, "dayId");
    await expect(page.locator("body")).toContainText("vendredi 12 juin");

    await demoClick(
      page,
      page.getByRole("button", { name: "+ Ajouter un bloc" }),
      "Ajouter un bloc"
    );
    const classInputs = page.locator("input");
    await demoFill(page, classInputs.nth(0), "Ranch Riding Amateur", "Classe");
    await demoFill(page, classInputs.nth(1), "RR-A", "Code");
    await demoFill(page, classInputs.nth(2), "Manège principal", "Manège");
    const classSelects = page.locator("select");
    await demoSelect(page, classSelects.nth(0), "RR1", "Pattern RR1");
    await demoSelect(page, classSelects.nth(1), "1", "Un juge");
    await showStep(page);
    await demoClick(page, page.getByRole("button", { name: "Enregistrer" }), "Enregistrer");
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await showStep(page);

    await demoClick(page, page.getByRole("link", { name: "Ouvrir setup" }), "Setup");
    const classId = getIdFromUrl(
      page.url(),
      /\/classes\/([^/]+)\/setup$/,
      "classId"
    );
    await expect(page.getByRole("heading", { name: "Setup de bloc" })).toBeVisible();

    await demoFill(
      page,
      page.locator('input[placeholder="Juge 1"]'),
      "Sophie Laroche",
      "Juge"
    );
    await demoSelect(page, page.locator("select").nth(2), "2", "Drag aux 2 runs");
    await demoFill(
      page,
      page.getByLabel("Durée du drag en minutes"),
      "4",
      "Durée du drag"
    );
    await demoSelect(page, page.locator("select").nth(3), "live", "Live détaillé");
    await demoClick(
      page,
      page.getByRole("button", { name: "Importer un draw" }),
      "Importer le draw"
    );
    await demoFill(
      page,
      page.locator("textarea"),
      DEMO_PARTICIPANTS.map((participant) => participant.join(", ")).join("\n"),
      "8 participants"
    );
    await showStep(page);
    await demoClick(
      page,
      page.getByRole("button", { name: "Remplacer les runs avec cet import" }),
      "Importer"
    );
    await expect(page.locator("body")).toContainText("Camille Tremblay");
    await expect(page.locator("body")).toContainText("Julien Caron");
    await waitForSetupRuns(page, classId, DEMO_PARTICIPANTS.length);
    await showStep(page);

    const paidWarmupId = await seedDemoPaidWarmup(page, {
      associationId,
      showId,
      dayId,
    });
    await seedPublicShowTools(page, associationId, showId);

    await demoGoto(
      page,
      `/associations/${associationId}/shows/${showId}/days/${dayId}/paid-warmups/${paidWarmupId}/setup`
    );
    await expect(page.locator("body")).toContainText("Paid warm up ouvert");
    await expect(page.locator('input[type="text"]').nth(2)).toHaveValue(
      "Lucie Charbonneau"
    );
    await expect(page.locator('input[type="text"]').nth(3)).toHaveValue(
      "Felix Goudreau"
    );
    await showStep(page, 1000);

    await demoGoto(page, `/associations/${associationId}/shows/${showId}`);
    await expect(page.getByRole("heading", { name: "Derby ShowScore 2026" })).toBeVisible();
    await expect(page.locator("body")).toContainText("État vitrine publique");
    await expect(page.locator("body")).toContainText("Vitrine visible");
    await demoClick(
      page,
      page.getByRole("button", { name: "Réglages livestream" }),
      "Livestream et OBS"
    );
    await expect(page.locator("body")).toContainText("Horaire public");
    await expect(page.locator("body")).toContainText("Commanditaires de l’association");
    await expect(page.locator("body")).toContainText("Ouvrir overlay OBS général");
    await showStep(page, 1500);

    await demoGoto(page, `/associations/${associationId}/shows/${showId}/schedule`);
    await expect(page.locator("body")).toContainText("Aperçu horaire");
    await expect(page.locator("body")).toContainText("Publié sur la vitrine");
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await expect(page.locator("body")).toContainText("Paid warm up ouvert");
    await showStep(page, 1500);

    await demoGoto(page, `/associations/${associationId}/shows/${showId}/time`);
    await expect(page.locator("body")).toContainText("Gestion du temps");
    await expect(page.locator("body")).toContainText("Runs restants");
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await showStep(page, 1500);

    await demoGoto(page, "/public");
    await expect(page.locator("body")).toContainText("Associations");
    await demoFill(
      page,
      page.locator('input[type="search"]'),
      "Western",
      "Recherche publique"
    );
    await expect(page.locator("body")).toContainText("Association Demo Western");
    await showStep(page, 1000);

    await demoGoto(page, `/public/associations/${associationId}`);
    await expect(page.locator("body")).toContainText("Derby ShowScore 2026");
    await expect(page.locator("body")).toContainText("Horaire");
    await showStep(page, 1000);

    await seedLiveScoringState(page, classId, {
      completedCount: 0,
      activeRunIndex: 0,
      activeManeuverCount: 4,
      publicationStatus: "live",
    });
    await demoGoto(page, `/public/associations/${associationId}/shows/${showId}`);
    await expect(page.getByRole("heading", { name: "Derby ShowScore 2026" })).toBeVisible();
    await demoClick(
      page,
      page.getByRole("button", { name: /Ranch Riding Amateur \(RR-A\)/ }),
      "Ouvrir le live"
    );
    await expect(page.locator("body")).toContainText("En piste");
    await expect(page.locator("body")).toContainText(/En pr.paration/);
    await expect(page.locator("body")).toContainText("En attente");
    await expect(page.locator("body")).toContainText("Camille Tremblay");
    await expect(page.locator("body")).toContainText("Marc-Antoine Roy");
    await expect(page.locator("body")).toContainText("Lea Gagnon");
    await showStep(page, 1500);

    await seedLiveScoringState(page, classId, {
      completedCount: 1,
      activeRunIndex: 1,
      activeManeuverCount: 5,
      publicationStatus: "live",
      now: "2026-06-12T14:16:00.000Z",
    });
    await demoGoto(page, `/public/associations/${associationId}/shows/${showId}`);
    await demoClick(
      page,
      page.getByRole("button", { name: /Ranch Riding Amateur \(RR-A\)/ }),
      "Score entrant"
    );
    await expect(page.locator("body")).toContainText(/\b72(?:\.0)?\b/);
    await expect(page.locator("body")).toContainText("Marc-Antoine Roy");
    await expect(page.locator("body")).toContainText("Run fluide");
    await showStep(page, 2000);

    await seedLiveScoringState(page, classId, {
      completedCount: 2,
      activeRunIndex: null,
      publicationStatus: "live",
      now: "2026-06-12T14:19:00.000Z",
    });
    await demoGoto(page, `/public/associations/${associationId}/shows/${showId}`);
    await demoClick(
      page,
      page.getByRole("button", { name: /Ranch Riding Amateur \(RR-A\)/ }),
      "Drag visible"
    );
    await expect(page.locator("body")).toContainText("Drag de surface");
    await expect(page.locator("body")).toContainText(/71(?:\.5|½)/);
    await showStep(page, 2500);

    await seedLiveScoringState(page, classId, {
      completedCount: 2,
      activeRunIndex: 2,
      activeManeuverCount: 6,
      publicationStatus: "live",
      now: "2026-06-12T14:24:00.000Z",
    });
    await demoGoto(page, `/associations/${associationId}/scribe/classes/${classId}`);
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await expect(page.locator("body")).toContainText("Sophie Laroche");
    await expect(page.locator("body")).toContainText(/\b72(?:\.0)?\b/);
    await expect(page.locator("body")).toContainText(/71(?:\.5|½)/);
    await showStep(page, 1500);

    await demoGoto(page, `/public/associations/${associationId}/shows/${showId}`);
    await demoClick(
      page,
      page.getByRole("button", { name: /Ranch Riding Amateur \(RR-A\)/ }),
      "Live actualisé"
    );
    await expect(page.locator("body")).toContainText("En piste");
    await expect(page.locator("body")).toContainText(/En pr.paration/);
    await expect(page.locator("body")).toContainText("Lea Gagnon");
    await expect(page.locator("body")).toContainText("Olivier Martel");
    await expect(page.locator("body")).toContainText("Anais Bouchard");
    await expect(page.locator("body")).toContainText(/\b72(?:\.0)?\b/);
    await expect(page.locator("body")).toContainText(/71(?:\.5|½)/);
    await showStep(page, 2500);

    await demoGoto(page, `/public/associations/${associationId}/shows/${showId}/overlay`);
    await expect(page.locator("body")).toContainText("Derby ShowScore 2026");
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await expect(page.locator("body")).toContainText("ShowScore.app");
    await showStep(page, 2000);

    await seedDemoPaidWarmup(page, {
      associationId,
      showId,
      dayId,
      isPublicLive: true,
      completedCount: 2,
      activeEntryIndex: 2,
    });
    await demoGoto(page, `/associations/${associationId}/shows/${showId}/announcer`);
    await expect(page.locator("body")).toContainText("Annonceur");
    await expect(page.locator("body")).toContainText("Paid warm up ouvert");
    await expect(page.locator("body")).toContainText("Maya Desrosiers");
    await expect(page.locator("body")).toContainText("Timer actif");
    await showStep(page, 2000);

    await demoGoto(page, `/public/associations/${associationId}/shows/${showId}`);
    await expect(page.locator("body")).toContainText("Livestream du show");
    await expect(page.locator("body")).toContainText("Paid warm up ouvert");
    await demoClick(
      page,
      page.getByRole("button", { name: /Paid warm up ouvert/ }),
      "Ouvrir paid warm up"
    );
    await expect(page.locator("body")).toContainText("Maya Desrosiers");
    await expect(page.locator("body")).toContainText("Sarah Nguyen");
    await showStep(page, 2000);

    await seedSignedOfficialClass(page, classId);
    await demoGoto(page, `/associations/${associationId}/shows/${showId}/secretariat`);
    await expect(page.locator("body")).toContainText("Ranch Riding Amateur");
    await expect(page.locator("body")).toContainText(/Signé[e]?, à valider/);
    await demoClick(
      page,
      page.getByRole("button", { name: "Valider officiel" }),
      "Valider"
    );
    await expect(page.locator("body")).toContainText(/Validé[e]?/);
    await demoClick(page, page.getByRole("button", { name: "Publier" }), "Publier");
    await expect(page.locator("body")).toContainText("Publié");
    await showStep(page, 2000);

    await seedDemoAuditEvents(page, {
      associationId,
      showId,
      dayId,
      classId,
    });
    await demoGoto(page, `/associations/${associationId}/activity`);
    await expect(page.locator("body")).toContainText("Journal d’activité");
    await expect(page.locator("body")).toContainText("Public Tools Reviewed");
    await expect(page.locator("body")).toContainText("Secretariat Published Scoresheet");
    await showStep(page, 1500);

    await demoGoto(page, "/admin/analytics");
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Vues publiques");
    await expect(page.locator("body")).toContainText("Actions");
    await showStep(page, 1500);

    await demoGoto(page, `/public/associations/${associationId}/shows/${showId}`);
    await expect(page.locator("body")).toContainText("Feuille de pointage officielle");
    await demoClick(
      page,
      page.getByRole("button", { name: /Ranch Riding Amateur \(RR-A\)/ }),
      "Scoresheet officielle"
    );
    await expect(page.locator("body")).toContainText("Julien Caron");
    await expect(page.locator("body")).toContainText("Thomas Pelletier");
    await expect(page.locator("body")).toContainText(/Score\s*73(?:\.0)?/);
    await showStep(page, 2500);

    expect(associationId).toBeTruthy();
    expect(showId).toBeTruthy();
    expect(dayId).toBeTruthy();
    expect(paidWarmupId).toBeTruthy();
  });
});
