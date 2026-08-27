const { expect, test } = require("@playwright/test");
const {
  ASSOCIATION_ID,
  CLASS_ID,
  SHOW_ID,
  buildRobotShowStorageSeed,
} = require("./showRobotData");

test("keeps the information strip below the video at 480 by 270", async ({
  baseURL,
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 480, height: 270 });
  const seed = buildRobotShowStorageSeed();
  const show = seed.json["reining_shows_v1"][0];
  const classItem = seed.json["reining_classes_v1"][0];
  const setup = seed.json["reining_class_setup_v1"][CLASS_ID];

  show.tvDisplayVideoPath = new URL(
    "/tv-display-preview.mp4",
    baseURL
  ).href;
  show.tvDisplayVideoArena = "Manege Robot";
  classItem.name = "NRHA Intermediate Open";
  setup.liveDataSource = "announcer";
  seed.json["showscore_announcer_live_sessions_v1"] = {
    [CLASS_ID]: {
      classId: CLASS_ID,
      runs: setup.runs.map((run) => ({
        ...run,
        status:
          run.draw <= 2
            ? "scored"
            : run.draw === 3
              ? "on_course"
              : "pending",
        scoreTotal: run.draw === 2 ? "72.5" : run.draw === 1 ? "70" : "",
        completedAt:
          run.draw <= 2 ? "2026-05-28T14:12:00.000Z" : null,
      })),
      activeManoeuvre: { draw: 3, manoeuvreIndex: 2 },
      startedAt: "2026-05-28T14:00:00.000Z",
      updatedAt: "2026-05-28T14:15:00.000Z",
    },
  };

  await page.addInitScript((storageSeed) => {
    const NativeDate = Date;
    const now = new NativeDate("2026-05-28T14:15:00.000Z").valueOf();
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [now]));
      }
      static now() {
        return now;
      }
    }
    FixedDate.parse = NativeDate.parse;
    FixedDate.UTC = NativeDate.UTC;
    window.Date = FixedDate;
    window.localStorage.clear();
    Object.entries(storageSeed.raw).forEach(([key, value]) => {
      window.localStorage.setItem(key, value);
    });
    Object.entries(storageSeed.json).forEach(([key, value]) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    });
  }, seed);

  await page.goto("/");
  await page.evaluate(
    ({ associationId, showId }) => {
      window.history.pushState(
        {},
        "",
        `/public/associations/${associationId}/shows/${showId}/tv?mode=competition&arena=Manege%20Robot`
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    { associationId: ASSOCIATION_ID, showId: SHOW_ID }
  );

  const layout = page.locator('[data-tv-layout="competition-video"]');
  const videoWrap = page.locator(".tv-competition-video-wrap");
  const strip = page.locator(".tv-competition-strip");
  await expect(layout).toBeVisible();
  await expect(strip).toBeVisible();
  await expect(
    page.locator(".tv-competition-participant-score")
  ).toHaveText("72½");

  const lastParticipantTypography = await page
    .locator(".tv-competition-participant--has-score")
    .evaluate((participant) => {
      const name = participant.querySelector(
        ".tv-competition-participant-name"
      );
      const horse = participant.querySelector(
        ".tv-competition-participant-horse"
      );
      const score = participant.querySelector(
        ".tv-competition-participant-score"
      );
      return {
        nameWeight: getComputedStyle(name).fontWeight,
        horseWeight: getComputedStyle(horse).fontWeight,
        nameFontSize: Number.parseFloat(getComputedStyle(name).fontSize),
        horseFontSize: Number.parseFloat(getComputedStyle(horse).fontSize),
        scoreFontSize: Number.parseFloat(getComputedStyle(score).fontSize),
      };
    });
  expect(lastParticipantTypography.horseWeight).toBe(
    lastParticipantTypography.nameWeight
  );
  expect(lastParticipantTypography.horseFontSize).toBe(
    lastParticipantTypography.nameFontSize
  );
  expect(lastParticipantTypography.scoreFontSize).toBeGreaterThanOrEqual(34);

  await page.locator("video").evaluate((video) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#173f4a"/><stop offset="1" stop-color="#05090d"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#g)"/>
      <circle cx="800" cy="410" r="240" fill="none" stroke="#f4d98c" stroke-width="18" opacity=".45"/>
      <text x="800" y="390" fill="#f4d98c" font-family="Arial" font-size="96" font-weight="900" text-anchor="middle">SHOWSCORE</text>
      <text x="800" y="485" fill="#fff" font-family="Arial" font-size="46" font-weight="700" text-anchor="middle">COMPETITION ARENA</text>
    </svg>`;
    video.poster = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });

  const geometry = await page.evaluate(() => {
    const wrap = document.querySelector(".tv-competition-video-wrap").getBoundingClientRect();
    const liveStrip = document.querySelector(".tv-competition-strip").getBoundingClientRect();
    const columns = Array.from(document.querySelector(".tv-competition-strip").children).map(
      (element) => element.getBoundingClientRect().width
    );
    return {
      viewport: [window.innerWidth, window.innerHeight],
      stripHeight: liveStrip.height,
      stripTop: liveStrip.top,
      videoBottom: wrap.bottom,
      columns,
      bodyWidth: document.body.scrollWidth,
    };
  });

  expect(geometry.viewport).toEqual([480, 270]);
  expect(geometry.stripHeight).toBe(74);
  expect(geometry.videoBottom).toBeLessThanOrEqual(geometry.stripTop);
  expect(geometry.stripTop).toBeGreaterThan(190);
  expect(geometry.columns).toHaveLength(3);
  expect(Math.min(...geometry.columns)).toBeGreaterThan(145);
  expect(geometry.bodyWidth).toBe(480);

  await page.screenshot({
    path: testInfo.outputPath("tv-competition-480x270.png"),
  });

});
