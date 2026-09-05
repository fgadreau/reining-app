# Générer la fiche annonceur

La source active est `docs/fiche-annonceur-showscore.html`. Le PDF actif est généré,
jamais modifié à la main. La copie Chromebook originale du 28 juillet 2026 reste dans
`docs/archive/fiche-annonceur-showscore-chromebook-2026-07-28.pdf` (archive, pas une fiche à distribuer).

Depuis la racine du dépôt, avec les dépendances du projet et le Chromium de
Playwright déjà installés, exécuter la commande suivante. Aucun téléchargement ni
service distant n'est nécessaire ; les requêtes autres que `file:` sont bloquées.
Le CSS et `docs/qr/role-annonceur.svg` sont chargés localement. L'impression utilise
Letter, les marges CSS de 0,42 pouce, une échelle de 1 et les arrière-plans.
La police est Arial, puis Liberation Sans : installer l'une des deux localement.

La commande refuse d'écrire le PDF si les QR, les deux pages Letter ou leur ordre
français/anglais ne sont pas valides. Vérifier visuellement les deux pages après
chaque modification ; conserver le navigateur et les polices utilisés pour des
rendus comparables (validation initiale : Chromium/Skia 148, Liberation Sans).
Les métadonnées temporelles du PDF peuvent différer entre deux générations.
Actualiser la date du HTML et celle de la vérification ci-dessous ensemble.

```sh
node --input-type=module <<'JS'
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/*', route => {
    if (route.request().url().startsWith('file:')) return route.continue();
    return route.abort();
  });
  await page.goto(pathToFileURL(process.cwd() + '/docs/fiche-annonceur-showscore.html').href);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  const images = await page.locator('img').evaluateAll(items =>
    items.map(item => item.complete && item.naturalWidth > 0));
  if (images.length !== 2 || images.some(ok => !ok)) throw new Error('Missing local QR');
  const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1 });
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  if (pdf.numPages !== 2) throw new Error('Expected 2 pages, got ' + pdf.numPages);
  for (let i = 1; i <= 2; i++) {
    const sheet = await pdf.getPage(i);
    if (sheet.view.join(',') !== '0,0,612,792') throw new Error('Expected Letter');
    const text = (await sheet.getTextContent()).items.map(item => item.str).join(' ');
    const title = i === 1 ? 'Fiche rapide annonceur' : 'Quick Announcer Sheet';
    if (!text.includes(title) || !text.includes('2026-09-05')) throw new Error('Unexpected language/date');
  }
  await fs.writeFile('docs/fiche-annonceur-showscore.pdf', bytes);
  console.log('PDF verified: 2 Letter pages, FR then EN, 2 local QR.');
} finally {
  await browser.close();
}
JS
```
