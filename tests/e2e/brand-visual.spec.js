const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { buildRobotShowStorageSeed, ASSOCIATION_ID, SHOW_ID } = require('./showRobotData');
const output = process.env.BRAND_CAPTURE_DIR || '/tmp/showscore-after';
for (const language of ['fr', 'en']) {
  for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
    test(`brand ${language} ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript(({ seed, language }) => {
        for (const [k, v] of Object.entries(seed.raw)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(seed.json)) localStorage.setItem(k, JSON.stringify(v));
        localStorage.setItem('showscore.language', language);
      }, { seed: buildRobotShowStorageSeed(), language });
      const routes = {
        home: '/', login: '/login', public: '/public', management: '/associations',
        tv: `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/tv`,
        livestream: `/public/associations/${ASSOCIATION_ID}/shows/${SHOW_ID}/livestream/tv`,
        shortcut: '/tv', overlay: '/public/associations/demo/shows/demo/overlay?demo=1',
      };
      for (const [screen, route] of Object.entries(routes)) {
        if (process.env.BRAND_SCREEN && screen !== process.env.BRAND_SCREEN) continue;
        await page.goto(route);
        await page.waitForTimeout(700);
        await page.evaluate(() => document.fonts.ready);
        if (!['tv', 'livestream', 'shortcut', 'overlay'].includes(screen)) {
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
        if (['tv', 'livestream', 'shortcut', 'overlay'].includes(screen)) {
          await expect(page.locator('.showscore-theme')).toHaveCount(0);
        }
        fs.mkdirSync(output, { recursive: true });
        await page.screenshot({ path: path.join(output, `${screen}-${language}-${name}.png`), fullPage: true, animations: 'disabled' });
      }
    });
  }
}
