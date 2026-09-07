# Identité ShowScore — validation

Branche : `feat/showscore-brand-identity`, issue de `preprod`. Aucun changement existant n’a été annulé. Les trois SVG fournis dans `branding/` sont conservés à l’identique et copiés dans `public/branding/`.

## Intégration

La palette est centralisée dans `src/styles/brand.css` et consommée par les objets de styles JavaScript existants avec des variables CSS et leurs anciennes couleurs en repli. `BrandBoundary` applique le thème exclusivement aux routes hors diffusion. Les deux fenêtres de pénalité rendues par portail reçoivent explicitement le thème. Les cellules de pointage et leurs couleurs opérationnelles restent inchangées.

Navigation : logo horizontal sur ordinateur/tablette, symbole dans les menus compacts. Accueil : deux accès distincts, vitrine prioritaire et gestion secondaire, commandes alignées, liens et conditions d’accès conservés. Connexion : logo à la place de l’ancien en-tête technique. Les couleurs des erreurs, avertissements, succès, connexion et associations sont conservées.

Les SVG français restent intacts. La déclinaison `showscore-logo-en.svg` conserve exactement les tracés et transformations du symbole et du lettrage ShowScore ; seule l’attribution est localisée en texte « By HSP ».

## Périmètre TV protégé

- `/tv`, `/tv/:code` → `PublicTvShortcutPage`.
- `/public/associations/:associationId/shows/:showId/tv` → `PublicShowTvPage`, `PublicShowTvPage.css`.
- `/public/associations/:associationId/shows/:showId/livestream/tv` → `PublicShowLivestreamTvPage`.
- `/public/associations/:associationId/shows/:showId/overlay` → `PublicShowOverlayPage`.

Dépendances conservées : `AssociationLogo`, publication et mises à jour publiques, sélection des sessions live, horaires, commanditaires, vidéo TV, raccourcis TV et calculs de pointage. `AppMenu` conserve son rendu précédent sur ces routes. Aucun changement dans `App.css`, `index.css`, les animations, les fichiers des écrans TV ou `local-relay/`. Le conteneur `.showscore-theme` est absent de ces routes, y compris après navigation.

## Icônes

L’icône officielle `branding/showscore-icone.svg` est maintenant fournie et utilisée exclusivement pour les favicons et les icônes installables. Sa copie publique est identique octet pour octet. Le cadre arrondi, les tracés, le viewBox et les transformations sont conservés ; la rasterisation se fait sur blanc.

`node tools/generate-brand-assets.cjs` génère les PNG 16, 32, 180, 192 et 512 pixels et un vrai ICO contenant les PNG 16/32. Les références HTML, métadonnées sociales, Apple et manifeste sont actualisées. Le service worker existant n’a aucun cache d’assets ; aucune purge ni modification de son fonctionnement n’est nécessaire. Toutes les références SVG/PNG/ICO et l’URL du manifeste portent maintenant `v=showscore-hsp-2`. Les anciennes réponses en cache ne correspondent donc plus aux URL demandées. Un système ayant déjà épinglé une icône installée peut attendre sa prochaine mise à jour du manifeste.

À 32 pixels, le S et la silhouette sont reconnaissables. À 16 pixels, les détails du cavalier et des membres du cheval se confondent partiellement. Aucun épaississement, simplification ou redessin du symbole n’a été appliqué. Aucune icône « maskable » n’est déclarée : la composition approuvée est conservée sans adaptation au masque du système.

## Contrastes et formats

Couleurs sur blanc : bleu nuit 12,97:1 ; aubergine 8,96:1 ; texte foncé 14,83:1. Le gris secondaire est assombri à `#58677e` pour rester au-dessus de 4,5:1 sur les fonds clairs. Focus clavier aubergine avec décalage, couleurs fonctionnelles conservées.

Captures Chromium en FR/EN : ordinateur 1440×900, tablette 768×1024, mobile 390×844. Accueil, connexion, vitrine et gestion contrôlés sans débordement horizontal. Formulaire de connexion contrôlé avec configuration fictive et réponses réseau simulées, sans soumission ni utilisation de compte réel. Les appareils physiques et Safari ne sont pas couverts.

Voir [l’aperçu des captures](index.html). Les captures utilisent exclusivement les données de test du dépôt.

## Reproduction

```bash
npm run build
npm test -- --maxWorkers=2
npx vitest run src/pages/public/PublicShowTvPage.test.js --environment jsdom --globals --maxWorkers=2
npm --prefix local-relay ci --omit=dev
npm run relay:test
npm exec -- playwright test tests/e2e/brand-visual.spec.js tests/e2e/tv-480-screenshot.spec.js tests/e2e/local-relay-overlay.spec.js
```

`BRAND_CAPTURE_DIR` choisit le dossier des captures (par défaut `/tmp/showscore-after`). `BRAND_SCREEN=home` limite la capture à un écran. Les références ont été capturées avant modification ; la référence TV 480×270 a également été reproduite dans une copie du commit d’origine.

```bash
node tools/compare-brand-captures.cjs /tmp/showscore-before /tmp/showscore-after docs/branding-validation/tv-comparison.json
```

## Résultats

- Build Vite réussi ; avertissement existant sur les bundles dépassant 500 kB.
- 268 tests applicatifs, 8 tests unitaires TV et 7 tests du relais réussis.
- 6 validations visuelles FR/EN et test TV 480×270 réussis ; test navigateur du relais et de ses commanditaires réussi.
- 25 comparaisons TV/diffusion identiques octet pour octet, dont le bandeau compétition 480×270 avec score 72½. Les empreintes sont dans `tv-comparison.json` ; une sélection de paires avant/après est conservée dans l’aperçu.
- Robot de show élargi : 12 scénarios réussis, 6 échecs **également reproduits sur le commit d’origine `3b1be06`** dans le même environnement. Ils concernent l’identité de test du scribe, les données live attendues dans la vitrine mobile, le mode commanditaires pendant le drag, le prochain cavalier/classe, les données sous la vidéo de compétition et l’activation de la source annonceur. Ils restent à corriger dans le chantier de données/tests, sans modification de la logique pendant cette intégration visuelle.
- Les commandes annonceur au clavier, le pavé sur plusieurs iPad et la synchronisation TV après saisie d’un score passent.

La validation cloud réelle, les appareils physiques et les six scénarios préexistants restent hors de la validation réussie. Aucune fusion ni mise en préproduction/production n’a été effectuée.


## Correction de l’icône approuvée

Vérifications nouvelles limitées aux icônes : égalité du SVG source/public ; dimensions PNG 16/32/180/192/512 ; deux images PNG exactes dans le conteneur ICO ; réponses HTTP 200 avec contenu identique aux fichiers pour toutes les références versionnées du favicon, Apple et du manifeste. En développement, Vite sert ces assets avec `Cache-Control: no-cache`. Aucun test applicatif ou TV relancé pour cette correction : les résultats ci-dessus proviennent de la validation précédente.

Le S reste reconnaissable à 16 et 32 pixels ; les détails du cavalier et du cheval sont fins à 16 pixels. Voir `after/approved-icons-16-32.png`.

## Six échecs préexistants : observations et impact

Tous reproduits sur `3b1be06`, avant intégration de la marque. Les observations ci-dessous décrivent les scénarios locaux de test ; elles ne démontrent pas, à elles seules, un incident en production ni une cause racine.

| Scénario | Observation vérifiée | Impact concret du résultat |
| --- | --- | --- |
| Scribe à cinq juges (ligne 431) | `test@showscore.local` absent ; l’écran demande une connexion personnelle et indique une sauvegarde locale. | La réservation de la feuille et le parcours complet avec identité scribe ne sont pas validés par ce scénario. |
| Vitrine mobile (ligne 483) | `Cavalier 3` attendu absent ; l’écran affiche les cavaliers 1/2 et une mise à jour ancienne. | La fidélité des données live attendues n’est pas validée ; l’échec n’établit pas un défaut de mise en page mobile. |
| Commanditaires pendant le drag (ligne 556) | L’overlay reste en mode `live`, au lieu de `sponsor-takeover`. | La bascule en grand affichage commanditaires puis son retour ne sont pas validés avec ces données. |
| Prochaine classe TV (ligne 666) | `Cavalier 10` attendu absent ; `Cavalier 1` reste affiché. | La transition de fin de classe vers la prochaine classe n’est pas validée par ce scénario. |
| Vidéo de compétition (ligne 746) | Le bandeau contient les participants mais pas le nom de classe attendu par le test. | L’assertion de contenu du bandeau échoue ; elle ne prouve pas une panne vidéo. Le test séparé 480×270 avec pointage passe. |
| Source annonceur (ligne 860) | Le champ de source live reste vide au lieu de `announcer`. | Le scénario d’activation de cette source puis d’affichage minimal ne peut pas être validé. Les tests distincts clavier/iPad/synchronisation après score passent. |

Les lignes se réfèrent à `tests/e2e/show-robot.spec.js`. Aucun changement de logique n’a été introduit pour contourner ces échecs.
