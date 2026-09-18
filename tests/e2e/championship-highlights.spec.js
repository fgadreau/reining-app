const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");

for (const width of [1440, 390]) {
  test(`season highlights and final titles at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.evaluate(async () => {
      const { seedChampionshipDemo } = await import("/src/features/demo/championshipDemo.js");
      seedChampionshipDemo();
    });
    const url = "/public/associations/demo-championship-association/championnat";
    await page.goto(url);
    const toggle = page.getByRole("button", { name: /Faits saillants de la saison/ });
    await expect(toggle).toHaveCount(1);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Cavaliers uniques", { exact: true })).toBeHidden();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Cavaliers uniques", { exact: true })).toBeVisible();
    await expect(page.locator("#championship-highlights-content")).toContainText("6");
    await expect(page.getByText("Meilleure progression", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Meilleur score/)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`highlights-${width}.png`), fullPage: true });
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const classButton = page.getByRole("button", { name: /Omnium NRHA/ }).first();
    await classButton.click();
    await expect(page.getByText("Co-champion", { exact: true })).toHaveCount(0);
    await page.evaluate(() => {
      const key = "showscore_championship_seasons_v1";
      const seasons = JSON.parse(localStorage.getItem(key));
      seasons[0].status = "final";
      localStorage.setItem(key, JSON.stringify(seasons));
    });
    await page.reload();
    await classButton.click();
    await expect(page.getByText("Co-champion", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Réserve Champion", { exact: true })).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath(`titles-${width}.png`), fullPage: true });
    // Searching cannot promote a lower duo to champion.
    await page.getByLabel("Rechercher dans le championnat").fill("CAROL");
    await expect(page.getByText("Co-champion", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Réserve Champion", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByText("Reserve Champion", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Season highlights/ })).toBeVisible();

    if (width === 1440) {
      const pdf = await page.evaluate(async () => {
        const { generateChampionshipPdf } = await import("/src/utils/generateChampionshipPdf.js");
        const season = JSON.parse(localStorage.getItem("showscore_championship_seasons_v1"))[0];
        // Explicit 50,50,48,48 fixture for PDF reserve titles after co-champions.
        const entry = season.classes[0];
        entry.teams = Array.from({ length: 4 }, (_, index) => ({
          ...entry.teams[index % 3], teamKey: `fiction-${index}`, rider: `Cavalier fictif ${index + 1}`,
          horse: `Cheval fictif ${index + 1}`, totalPoints: index < 2 ? 50 : 48, rank: index < 2 ? 1 : 3,
        }));
        season.classes = [entry];
        const doc = generateChampionshipPdf({ season, associationName: "Association fictive", associationAbbreviation: "TEST" });
        return Array.from(new Uint8Array(doc.output("arraybuffer")));
      });
      const pdfPath = testInfo.outputPath("final-fiction.pdf");
      await fs.writeFile(pdfPath, Buffer.from(pdf));
      const rendered = await page.evaluate(async (bytes) => {
        const pdfjs = await import("/node_modules/pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/node_modules/pdfjs-dist/build/pdf.worker.mjs";
        const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
        const pdfPage = await doc.getPage(3);
        const text = (await pdfPage.getTextContent()).items.map((item) => item.str).join(" ");
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        return { text, png: canvas.toDataURL("image/png").split(",")[1] };
      }, pdf);
      expect(rendered.text.match(/Co-champion/g)).toHaveLength(2);
      expect(rendered.text.match(/Co-réserve Champion/g)).toHaveLength(2);
      await fs.writeFile(testInfo.outputPath("final-fiction-page3.png"), Buffer.from(rendered.png, "base64"));
    }
  });
}
