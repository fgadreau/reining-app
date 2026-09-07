# Six scénarios live — causes et corrections

Branche : `fix/show-live-regression-scenarios`, créée depuis `origin/preprod` au commit `b0b830156ecf63d90cade55e19778f3243728b74` (fusion de la PR #69).

## Environnement et reproduction

Les six échecs ont été reproduits sans correction sur ce commit : six tests en échec. Les mêmes observations figurent dans la validation de la PR #69 sur `3b1be06`. Les données sont fictives et préparées par `tests/e2e/showRobotData.js` dans un contexte navigateur neuf.

Playwright démarre désormais son propre Vite sur `127.0.0.1:3020`, avec port strict, sans réutiliser l’aperçu du développeur. Ses variables Supabase et d’environnement de déploiement sont explicitement vides. Aucune donnée PREPROD ou production n’est utilisée ou modifiée.

## Cause commune : source live implicite

Le commit `6fc09ea` a introduit le défaut `DEFAULT_LIVE_DATA_SOURCE = ANNOUNCER`. `normalizeSetup` dans `src/features/classes/classSetupStorage.js` applique ce défaut quand la propriété est absente. Le robot préparait des sessions de **scribe** mais omettait `setup.liveDataSource`. `resolveLiveScoringSession` sélectionnait alors une session annonceur vide : aucun passage terminé, aucun drag actif, et le début du draw au lieu du participant attendu.

Le test de source annonceur rencontrait la même erreur de préparation : le sélecteur était déjà sur « annonceur », donc sélectionner cette valeur ne constituait pas un changement. Aucune sauvegarde n’était déclenchée et la propriété brute du stockage restait absente.

Correction : le jeu scribe indique explicitement `liveDataSource: "scribe"`. Les jeux annonceur existants continuent de préciser `"announcer"`. Le défaut applicatif demeure inchangé : il correspond au comportement métier voulu et possède déjà un test dans `src/App.test.js`.

## Bilan par scénario

| Scénario | Cause établie | Correction et vérification conservée/renforcée | Limite |
| --- | --- | --- | --- |
| Scribe, identité et réservation | Défaut applicatif : `useAuthUser` sortait avant d’appeler `getAuthUser` et de s’abonner aux événements locaux lorsque Supabase n’était pas configuré. Pourtant `getAuthSession` sait déjà charger la session locale autorisée. La source implicite affectait aussi les scores du scénario. | Le hook charge la session et écoute ses changements indépendamment de la configuration cloud, tout en conservant `isConfigured: false`. Deux tests unitaires reproduisaient l’échec avant correction, puis passent (chargement, connexion/déconnexion locale, absence d’identité inventée). Le scénario E2E démarre avec la feuille Charlie libre, vérifie la mention « Feuille réservée », l’identifiant, l’email et la date de réservation stockés, puis les cinq juges et les totaux 216 / 217½ dans la vitrine. | Réservation locale vérifiée ; aucune revendication de validation concurrente multi-clients Supabase. |
| Vitrine mobile | Préparation : sessions scribe ignorées à cause de la source implicite annonceur. | Source scribe explicite. Assertions conservées : Cavalier 3 en live, absence de débordement, publication officielle, détails des manœuvres accessibles à la demande. | Chromium 375×812, données fictives. |
| Commanditaires pendant le drag | Préparation : le drag se trouvait dans les sessions scribe non sélectionnées. Il s’agit de l’entretien/passage de herse, pas d’un déplacement de composant à la souris. | Source scribe explicite. Mode `sponsor-takeover`, commanditaires sur toute la surface 1920×1080, barre masquée, puis retour à `live`, rail et barre visibles lorsque le passage suivant démarre. Les assertions et le mécanisme réel de rafraîchissement sont conservés. | Logos fictifs ; aucune diffusion réelle modifiée. |
| Prochaine classe TV | Préparation : la source vide empêchait d’afficher le dernier passage et la classe suivante préparés par le test. | Source scribe explicite. Cavalier 10, indication « Prochaine classe », nom de la classe suivante et absence de « À confirmer » vérifiés. | Scénario local de fin de classe. |
| Bandeau vidéo | Attente périmée, plus source implicite. Le commit `32e318a` a volontairement retiré la colonne titre de classe et son défilement, au profit de trois colonnes participants dans la disposition approuvée. | Aucun élément n’est réintroduit dans l’interface. L’assertion obsolète est remplacée par le contrat actuel : exactement trois colonnes, cavalier/cheval 3, prochain cavalier 4, dernier cavalier 2 et total 217½, bandeau sous la vidéo, pas de débordement. Défilement du long nom, boucle vidéo, sélection du manège, pause des autres écrans, QR et commanditaires restent vérifiés. | Le média vidéo est simulé : le test vérifie la disposition et la configuration, pas le décodage d’un vrai flux. |
| Activation annonceur et ordre seul | Préparation : le sélecteur était déjà sur annonceur, donc aucun changement ni sauvegarde. | Source scribe initiale explicitement vérifiée ; changement et persistance attendus par polling, puis rechargement et contrôle de la valeur sauvegardée. Les assertions de saisie à cinq juges, total, validation par Entrée, avancement automatique et masquage d’identité en mode ordre seul sont conservées. | Local uniquement ; pas de test de panne réseau cloud. |

## Fiabilité de la préparation

L’ancien `addInitScript` effaçait et réinjectait le jeu à **chaque navigation complète**. Un second jeu dans le même test ajoutait un autre script dont l’ordre d’exécution n’était pas garanti. La préparation est désormais exécutée une fois sur l’origine locale ; elle peut être remplacée explicitement pour la phase publiée de la vitrine mobile. Les actions de l’application survivent aux rechargements, ce qui rend le contrôle de persistance de la source annonceur effectif.

Aucun scénario supprimé, aucune assertion de comportement existant supprimée pour masquer un problème, aucun délai arbitraire ajouté. La seule attente retirée visait une colonne volontairement supprimée dans l’interface approuvée ; elle est remplacée par les assertions métier et de géométrie de la disposition actuelle.

## Apparence et déploiement

Aucun fichier de composant TV, CSS, logo ou animation modifié. Le correctif applicatif concerne uniquement le hook d’identité. Les transitions TV sont vérifiées avec les données scribe correctes, sans refonte ni ajout de marque.

Pour respecter l’interdiction de déploiement, `vercel.json` désactive l’intégration Git **uniquement pour cette branche**, via [`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled). Les règles des branches `preprod` et `main` ne sont pas changées.

## Reproduire

```bash
npm exec -- playwright test tests/e2e/show-robot.spec.js --grep 'valide une classe'
npm exec -- playwright test tests/e2e/show-robot.spec.js --grep 'vitrine publique mobile'
npm exec -- playwright test tests/e2e/show-robot.spec.js --grep 'agrandit les commanditaires'
npm exec -- playwright test tests/e2e/show-robot.spec.js --grep 'prochaine classe'
npm exec -- playwright test tests/e2e/show-robot.spec.js --grep 'video du manege'
npm exec -- playwright test tests/e2e/show-robot.spec.js --grep 'live annonceur et'
npm exec -- playwright test tests/e2e/show-robot.spec.js --grep 'valide une classe|vitrine publique mobile|agrandit les commanditaires|prochaine classe|video du manege|live annonceur et'
npm test -- --maxWorkers=2
npm run build
npm run test:e2e
```

`E2E_CAPTURE_DIR` permet de conserver les captures des états métier ; `E2E_CAPTURE_SCREENSHOTS=1` conserve aussi les captures finales de tous les tests. Les données des captures sont fictives.

## Résultats obtenus

| Vérification | Résultat | Preuve |
| --- | --- | --- |
| Six scénarios avant correction | 6 échecs reproduits | [Log initial](logs/live-six-baseline.log) |
| Régression identité avant / après | 2 échecs, puis 2 succès | [Avant](logs/live-auth-before.log), [après](logs/live-auth-after.log) |
| Chacun des six scénarios séparément | 6/6 réussis | Logs individuels dans `logs/` |
| Les six scénarios ensemble | 6/6 réussis | [Log groupé](logs/live-six-grouped.log) |
| Suite E2E complète | 24/24 réussis, sans reprise | [Log complet](logs/live-full-e2e.log) |
| Contrôle requis `npm test` | 270/270 réussis, 12 fichiers | [Log](logs/live-required-tests.log) |
| Contrôle requis `npm run build` | Réussi | [Log](logs/live-build.log) |
| Relais | 7/7 réussis | [Log](logs/live-relay.log) |
| Tests unitaires TV supplémentaires | 8/8 réussis | [Log](logs/live-tv-unit.log) |

La compilation conserve l’avertissement existant sur la taille du bundle (>500 ko). Les journaux de tests conservent les avertissements observés ; ils ne sont pas présentés comme corrigés.

La capture TV 480×270 a été comparée à `docs/branding-validation/after/tv-480.png` : seuls **2 pixels sur 129 600** diffèrent, aux coordonnées (391, 227) et (391, 228), dans le texte participant. L’inspection visuelle ne révèle aucun changement de disposition, de couleur ou de typographie. La comparaison n’est donc pas déclarée strictement identique pixel par pixel. Les assertions géométriques et typographiques TV passent. Le visuel « SHOWSCORE / COMPETITION ARENA » de cette capture est le poster simulé préexistant du test, pas un logo ajouté à l’application.

## Captures de revue

- [Réservation effective de la feuille Charlie](captures/scribe-reservation.png)
- [Vitrine mobile : Cavalier 3 en piste](captures/mobile-live.png)
- [Commanditaires pendant le drag](captures/sponsors-drag.png)
- [Retour de l’overlay au live](captures/sponsors-live-restored.png)
- [TV : Cavalier 10 et prochaine classe](captures/tv-next-class.png)
- [TV vidéo : trois colonnes et score 217½](captures/tv-competition-video.png)
- [Source annonceur : affichage ordre seul](captures/announcer-order-only.png)
- [TV 480×270, comparaison de la disposition approuvée](captures/tv-480.png)

Les dates fixes du jeu scribe expliquent l’indicateur d’ancienneté visible sur certaines captures ; elles ne constituent pas la cause des six échecs. La validation porte sur Chromium, avec données locales fictives. La concurrence cloud et le décodage d’un vrai flux vidéo restent hors couverture de cette correction.
