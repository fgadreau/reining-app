// Render approved SVG paths unchanged with Chromium. ICO embeds 16/32px PNGs.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const target = path.resolve('public/branding');
  fs.mkdirSync(target, { recursive: true });
  for (const name of ['showscore-logo.svg', 'showscore-logo-empile.svg', 'showscore-symbole.svg']) {
    fs.copyFileSync(path.join('branding', name), path.join(target, name));
  }
  // Localize only the attribution; symbol and wordmark paths/transforms stay exact.
  const horizontal = fs.readFileSync('branding/showscore-logo.svg', 'utf8');
  const english = horizontal.replace('ShowScore — Par HSP', 'ShowScore — By HSP')
    .replace(/<g transform="translate\(510 305\)[\s\S]*?<\/g>/,
      '<text x="510" y="371" font-family="Arial, sans-serif" font-size="92" font-weight="700" fill="#653C59">By HSP</text>');
  fs.writeFileSync(path.join(target, 'showscore-logo-en.svg'), english);
  // Copy the approved icon exactly; rasterize on white without changing geometry.
  const svg = fs.readFileSync('branding/showscore-icone.svg', 'utf8');
  fs.writeFileSync(path.join(target, 'showscore-icone.svg'), svg);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [16, 32, 180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0;background:white}img{display:block;width:100%;height:100%}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`);
    await page.locator('img').evaluate(img => img.decode());
    await page.screenshot({ path: path.join(target, `icon-${size}.png`) });
  }
  await browser.close();
  const pngs = [16, 32].map(size => fs.readFileSync(path.join(target, `icon-${size}.png`)));
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach((png, i) => {
    const start = 6 + i * 16;
    header[start] = header[start + 1] = [16, 32][i];
    header.writeUInt16LE(1, start + 4); header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(png.length, start + 8); header.writeUInt32LE(offset, start + 12);
    offset += png.length;
  });
  fs.writeFileSync('public/favicon.ico', Buffer.concat([header, ...pngs]));
})();
