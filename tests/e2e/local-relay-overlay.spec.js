const { test, expect } = require("@playwright/test");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

let relayProcess;
let relayPort;
let relayDataDirectory;

test.beforeAll(async () => {
  relayPort = await reservePort();
  relayDataDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "showscore-overlay-browser-")
  );
  relayProcess = spawn(process.execPath, ["src/server.mjs"], {
    cwd: path.resolve(__dirname, "../../local-relay"),
    env: {
      ...process.env,
      SHOWSCORE_RELAY_CODE: "482731",
      SHOWSCORE_RELAY_DATA_DIR: relayDataDirectory,
      SHOWSCORE_RELAY_HOST: "127.0.0.1",
      SHOWSCORE_RELAY_PORT: String(relayPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  relayProcess.stdout.on("data", (chunk) => { output += String(chunk); });
  relayProcess.stderr.on("data", (chunk) => { output += String(chunk); });
  await waitUntil(() => output.includes("ShowScore Local Relay est prêt"));
});

test.afterAll(async () => {
  if (relayProcess?.exitCode == null) {
    relayProcess.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => relayProcess.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
  if (relayDataDirectory) {
    fs.rmSync(relayDataDirectory, { recursive: true, force: true });
  }
});

test("serves the overlays with two visible sponsors and every local TV layout", async ({ browser, baseURL }) => {
  const publicOverlayPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await publicOverlayPage.goto(
    `${baseURL}/public/associations/demo/shows/demo/overlay?demo=1`
  );
  await expect(
    publicOverlayPage.locator('[data-overlay-sponsor-mode="rail"] img')
  ).toHaveCount(2);

  const overlayPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const producerPage = await browser.newPage();
  await overlayPage.goto(`http://127.0.0.1:${relayPort}/overlay`);
  await producerPage.goto(`http://127.0.0.1:${relayPort}/`);

  await producerPage.evaluate(async ({ port, snapshot }) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/producer`);
    window.relayTestSocket = socket;
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.send(JSON.stringify({
      type: "producer.hello",
      producerId: "browser-test",
      pairingCode: "482731",
    }));
    await new Promise((resolve) => {
      socket.addEventListener("message", (event) => {
        if (JSON.parse(event.data).type === "producer.ready") resolve();
      });
    });
    socket.send(JSON.stringify({
      type: "snapshot.publish",
      producerId: "browser-test",
      version: "100",
      snapshot,
    }));
  }, { port: relayPort, snapshot: buildSnapshot(true) });

  await expect(overlayPage.locator("#sponsor-takeover")).toBeVisible();
  await expect(overlayPage.locator("#bar")).toBeHidden();
  await expect(overlayPage.getByText("Drag en cours")).toBeVisible();
  await expect(overlayPage.getByText(/Merci à nos commanditaires/)).toBeVisible();
  await expect(overlayPage.locator(".takeover__sponsor img")).toHaveCount(2);

  await producerPage.evaluate((snapshot) => {
    window.relayTestSocket.send(JSON.stringify({
      type: "snapshot.publish",
      producerId: "browser-test",
      version: "101",
      snapshot,
    }));
  }, buildSnapshot(false));

  await expect(overlayPage.locator("#sponsor-takeover")).toBeHidden();
  await expect(overlayPage.locator("#bar")).toBeVisible();
  await expect(overlayPage.locator("#active")).toContainText("Alex Roy");
  await expect(overlayPage.locator("#active")).toContainText("Blue Star");

  const tvPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await tvPage.goto(`http://127.0.0.1:${relayPort}/tv?arena=Man%C3%A8ge%201`);
  await expect(tvPage.locator("#live-panel")).toBeVisible();
  await expect(tvPage.locator("#current-name")).toHaveText("Alex Roy");
  await expect(tvPage.locator("#current-details")).toContainText("Blue Star");
  await expect(tvPage.locator("#sponsor-list img")).toHaveCount(3);

  const competitionPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await competitionPage.goto(
    `http://127.0.0.1:${relayPort}/tv?arena=Man%C3%A8ge%201&mode=competition`
  );
  await expect(competitionPage.locator("#competition-panel")).toBeVisible();
  await expect(competitionPage.locator("#competition-current")).toHaveText("Alex Roy");
  await expect(competitionPage.locator("#competition-arena")).toContainText("Manège 1");

  const standingsPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await standingsPage.goto(
    `http://127.0.0.1:${relayPort}/tv?arena=Man%C3%A8ge%201&mode=standings`
  );
  await expect(standingsPage.locator("#standings-panel")).toBeVisible();
  await expect(standingsPage.locator("#standings-title")).toContainText("OPEN");
  await expect(standingsPage.locator(".standings__row")).toHaveCount(2);
  await expect(standingsPage.locator(".standings__row").first()).toContainText("73.5");

  await expect.poll(async () => {
    const response = await producerPage.evaluate(() =>
      fetch("/api/status").then((result) => result.json())
    );
    return {
      overlay: response.overlayViewerCount,
      tv: response.tvViewerCount,
    };
  }).toEqual({ overlay: 1, tv: 3 });

  const pausedSnapshot = buildSnapshot(false);
  pausedSnapshot.show.isTvDisplayPaused = true;
  pausedSnapshot.show.tvDisplayMessageFr = "Retour après la pause";
  pausedSnapshot.show.tvDisplayMessageEn = "Back after the break";
  await producerPage.evaluate((snapshot) => {
    window.relayTestSocket.send(JSON.stringify({
      type: "snapshot.publish",
      producerId: "browser-test",
      version: "102",
      snapshot,
    }));
  }, pausedSnapshot);
  await expect(tvPage.locator("#center-panel")).toBeVisible();
  await expect(tvPage.locator("#center-title")).toHaveText("Retour après la pause");
  await expect(tvPage.locator("#center-subtitle")).toHaveText("Back after the break");
});

function buildSnapshot(isDragActive) {
  const sponsorSvg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#fff"/><text x="200" y="115" text-anchor="middle" font-size="52">SPONSOR</text></svg>'
  ).toString("base64");

  return {
    schemaVersion: 1,
    association: {
      id: "aqr",
      name: "Association Test",
      sponsorGroups: [
        {
          id: "gold",
          name: "Or",
          logos: [
            {
              id: "sponsor-1",
              name: "Sponsor 1",
              logoDataUrl: `data:image/svg+xml;base64,${sponsorSvg}`,
            },
            {
              id: "sponsor-2",
              name: "Sponsor 2",
              logoDataUrl: `data:image/svg+xml;base64,${sponsorSvg}`,
            },
            {
              id: "sponsor-3",
              name: "Sponsor 3",
              logoDataUrl: `data:image/svg+xml;base64,${sponsorSvg}`,
            },
          ],
        },
      ],
    },
    show: { id: "show-1", name: "Derby Test", obsOverlayMode: "live" },
    liveClasses: [
      {
        classId: "class-1",
        className: "Open",
        arena: "Manège 1",
        activeDragItem: isDragActive
          ? { id: "drag-1", isActive: true, startedAt: new Date().toISOString() }
          : null,
        activeRun: isDragActive
          ? null
          : { id: "run-1", draw: 1, rider: "Alex Roy", horse: "Blue Star" },
        scoringStarted: true,
        classStandings: [
          {
            id: "open",
            classCode: "OPEN",
            className: "Open",
            entries: [
              {
                id: "leader-1",
                rank: 1,
                backNumber: "101",
                rider: "Sam Roy",
                horse: "Golden Star",
                scoreTotal: "73.5",
              },
              {
                id: "leader-2",
                rank: 2,
                backNumber: "202",
                rider: "Jo Tremblay",
                horse: "Silver Moon",
                scoreTotal: "72",
              },
            ],
          },
        ],
      },
    ],
    livePaidWarmups: [],
  };
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitUntil(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Le relais de test n’a pas démarré.");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
