# PROJECT_CONTEXT.md

Derniere mise a jour: 2026-05-28

Ce fichier sert de dossier de passation pour un futur compte ChatGPT/Codex ou un nouveau developpeur IA. Il doit permettre de reprendre le projet ShowScore/Reining App avec un minimum de perte de contexte.

Important:

- Toujours lire le code local avant de modifier. L'application a beaucoup evolue recemment.
- Toujours verifier `git status --short --branch` avant d'editer.
- Ne jamais annuler des changements non faits par Codex sans permission explicite.
- Les migrations Supabase sont critiques. Plusieurs "bugs" apparents en prod peuvent simplement venir d'une migration SQL non executee.
- Le projet est en phase de QA terrain: les grosses fonctionnalites demandees sont terminees, mais il faut maintenant tester les petits irritants.

---

## 1. Objectif complet du projet

ShowScore est une application web de gestion de competitions equestres jugees, construite d'abord autour du reining, puis elargie a plusieurs disciplines AQHA/performance.

Le but est de permettre a une association de:

- creer une association;
- creer des competitions/shows;
- creer des journees;
- creer des classes;
- importer ou saisir l'ordre de passage;
- choisir un patron/pattern;
- preparer la feuille de pointage;
- permettre aux scribes de scorer en direct;
- supporter 1 a 5 juges;
- gerer les juges et les feuilles de juges;
- signer/finaliser une classe;
- permettre au secretariat de valider;
- generer des PDF officiels;
- publier les scoresheets;
- afficher une vitrine publique;
- afficher un live public;
- afficher une vue annonceur;
- gerer les paid warm ups;
- gerer les roles et utilisateurs par association;
- suivre les analytics et le journal d'activite.

Le produit vise un usage reel en show, avec ordinateurs/tablettes, reseau parfois instable, plusieurs roles actifs en meme temps, et besoin de publication publique fiable.

---

## 2. Etat actuel du projet

Etat fonctionnel majeur:

- Traductions FR/EN pour les pages principales, accueil et vitrine publique.
- Vitrine publique avec SEO public.
- Live public et live annonceur.
- Live multi-juges avec affichage des scores par juge et addition.
- PDF officiel et PDF multi-juges.
- Scoresheets publiques.
- Signature en popup plus fluide.
- Navigation restructuree en menu principal, sous-menu association, sous-menu competition.
- Role routing: un utilisateur avec un seul role operationnel est redirige vers son onglet naturel.
- Onglet Scribe au niveau du show.
- Multi-juges de base implemente.
- Analytics global et journal d'activite ajoute.
- Politique de confidentialite mise a jour pour analytics/journal.
- Classes sans patron ajoutees pour suivi horaire/live seulement, avec details participants/sections.

Etat git au moment de cette passation:

- `git status --short --branch` etait propre avant la creation de ce fichier.
- Le dernier commit important avant ce fichier: `c581cac Add analytics and activity logging`.
- Selon les moments, la branche peut etre ahead si l'utilisateur n'a pas pousse. Toujours verifier.

---

## 3. Stack technologique

Frontend:

- React 19
- Create React App / `react-scripts`
- React Router DOM 7
- CSS inline styles principalement
- No TypeScript
- No Redux Toolkit actif apparent, meme si des slices historiques existent

Backend/cloud:

- Supabase
- Supabase Auth email/password
- Supabase Postgres
- Supabase RLS
- Supabase RPC functions pour certains acces et analytics

Storage local:

- `localStorage`
- Repositories cloud-ready qui fallback local si Supabase absent ou erreur

PDF:

- `jspdf`
- `pdfjs-dist` pour tests/lecture PDF

Tests:

- Jest via `react-scripts test`
- Tests centralises surtout dans `src/App.test.js`
- Playwright E2E via `npm run test:e2e`
- Robot visuel local via `npm run test:e2e:visible`
- Robot demo lente via `npm run test:e2e:demo`
- Robot video via `npm run test:e2e:record`
- Demo produit A a Z via `npm run test:e2e:product-demo`
- Video demo produit HD via `npm run test:e2e:product-demo:record`

PWA:

- Service worker custom dans `public/service-worker.js`
- Registration dans `src/features/pwa/registerServiceWorker.js`
- Prompt installation/update public dans `PublicAppInstallPrompt`

Runtime:

- Node >= 20
- npm >= 10

Commandes:

```bash
npm start
npm test -- --watchAll=false
npm run build
```

Serveur local:

- L'utilisateur utilisait souvent `http://127.0.0.1:3001`.
- Dernier serveur demarre par Codex: `http://127.0.0.1:3002` car 3001 etait occupe.

---

## 4. Structure des dossiers

Racine:

- `README.md`: setup general.
- `PROJECT_CONTEXT.md`: ce fichier.
- `package.json`: scripts et dependances.
- `docs/`: schemas Supabase, migrations, deployment, roadmap data model.
- `public/`: index, service worker, redirects.
- `src/`: application React.

`docs/`:

- `supabase-schema.sql`: schema complet de depart pour nouveau projet Supabase.
- `supabase-analytics-migration.sql`: migration analytics/journal pour projets existants.
- `supabase-schedule-only-classes-migration.sql`: migration classes sans patron / details horaire live.
- `supabase-multi-judges-migration.sql`: migration multi-juges.
- `supabase-live-statuses-migration.sql`: statuts live.
- `supabase-paid-warmups-migration.sql`: paid warmups.
- `supabase-class-timing-migration.sql`: timing des classes.
- `supabase-custom-patterns-migration.sql`: patrons custom.
- `supabase-public-directory-migration.sql`: directory public/vitrine.
- `supabase-announcer-realtime-migration.sql`: realtime annonceur.
- `supabase-association-public-profile-migration.sql`: profil public association.
- `supabase-onboarding-access-migration.sql`: acces/invitations.
- `platform-admin-bootstrap.sql`: ajouter un platform admin.
- `deployment.md`: environnements DEV/STAGING/PROD.
- `v2-data-model.md`: ancien modele/roadmap, encore utile.

`src/app/router/`:

- `AppRouter.jsx`: routes principales de l'app.

`src/components/`:

- `AppMenu.jsx`: navigation principale et contextuelle.
- `CloudAuthBar.jsx`: etat auth/cloud/login, maintenant inline dans le menu.
- `LanguageSwitcher.jsx`: FR/EN.
- `AssociationLogo.jsx`: logo/initiales.
- `SeoMeta.jsx`: meta SEO.
- `PublicAppInstallPrompt.jsx`: prompt installer/recharger app.
- `SignaturePad.jsx`: composant signature.
- `ScoreTable.js`, `RunRows.js`, `ManoeuvrePicker.js`: UI scoring historique.

`src/features/analytics/`:

- `analyticsRepository.js`: tracking, fallback local, lecture events, resume.
- `AnalyticsRouteTracker.jsx`: page views automatiques.
- `analyticsRouteContext.js`: parsing route -> contexte event.

`src/features/associations/`:

- `associationRepository.js`: CRUD association local/Supabase + audit events.
- `associationProfile.js`: logo/site/initiales.
- `timezones.js`: detection et liste fuseaux horaires.
- `associationsData.js`: stockage local.

`src/features/auth/`:

- `authRepository.js`: login/signup/signout Supabase et local test.
- `localTestAuth.js`: login local `test@showscore.local` / `test1234`.
- `accessRoles.js`: roles et permissions.
- `accessRepository.js`: memberships, platform admin, user profiles.
- `useAssociationAccess.js`: hook central permissions.
- `useAuthUser.js`: session user.
- `showRoleRouting.js`: redirection selon role unique.
- `invitationRepository.js`: invitations par email/token.
- `invitationLinks.js`: generation lien invitation.

`src/features/classes/`:

- `classRepository.js`: CRUD classe, donnees completes, timing stats.
- `classSetupRepository.js`: setup classe cloud/local + event `class_setup_ready`.
- `classSetupStorage.js`: local setup.
- `classSetupImport.js`: import draw CSV/coller Excel/PDF-ish.
- `classJudges.js`: normalisation juges.
- `classOfficialData.js`: construction donnees officielles.
- `classFinalizationService.js`: finalisation/signature/official results.
- `officialPdfService.js`: PDF officiel, PDF multi-juges.
- `officialResultRepository.js`: resultats officiels Supabase/local.
- `classTiming.js`, `classTimeAnalytics.js`: durees, moyennes, projections.

`src/features/scoring/`:

- `scoringRepository.js`: scoring sessions single judge.
- `judgeScoringSessionRepository.js`: sessions par juge.
- `multiJudgeScoring.js`: somme des juges, drop high/low.
- `multiJudgeOfficialData.js`: PDF/resultats combines.
- `multiJudgeLiveData.js`: live multi-juges.
- `scoringOptions.js`: options de score/penalite selon pattern.
- `scoringRuleText.js`: texte de regles pour PDF.
- `provisionalRanking.js`: classement provisoire pour classes a ajustement.
- `scoringSyncQueue.js`: queue/sync local.

`src/features/publication/`:

- `publicationRepository.js`: statuts local.
- `publicationCloudRepository.js`: statuts Supabase + audit publication.
- `publicViewRepository.js`: construction vitrine/live public.

`src/features/live/`:

- `liveViewRepository.js`: vue annonceur.
- `liveFreshness.js`: fraicheur live.

`src/features/patterns/`:

- `patternDefinitions.js`: patrons, disciplines, headers, descriptions.

`src/features/paidWarmups/`:

- `paidWarmupRepository.js`: CRUD paid warmup.
- `paidWarmupLive.js`: logique live warmup.
- `paidWarmupImport.js`: import.
- `paidWarmupStorage.js`: local.

`src/features/i18n/`:

- `translations.js`: toutes les traductions.
- `i18n.js`: detection, translate.
- `I18nProvider.jsx`: contexte langue.

`src/features/seo/`:

- `publicSeo.js`: titres/descriptions publics.

`src/pages/`:

- `home/HomePage.jsx`: accueil.
- `auth/LoginPage.jsx`: login/signup/invitation.
- `association/AssociationsPage.jsx`: liste associations + creation.
- `association/AssociationShowPage.jsx`: competitions d'une association.
- `association/AssociationSettingsPage.jsx`: reglages association.
- `association/AssociationAccessPage.jsx`: utilisateurs/acces.
- `association/AssociationActivityPage.jsx`: journal d'activite association.
- `association/ShowDetailPage.jsx`: gestion competition/journees.
- `association/DayClassesPage.jsx`: classes d'une journee.
- `association/ClassSetupPage.jsx`: setup classe.
- `association/ShowScribePage.jsx`: onglet Scribe show-level.
- `scribe/ClassScoringPage.jsx`: scoring.
- `association/SecretariatDashboardPage.jsx`: secretariat.
- `association/AnnouncerDashboardPage.jsx`: annonceur.
- `association/ShowTimeManagementPage.jsx`: gestion du temps.
- `association/PublicResultsPage.jsx`: vitrine show.
- `public/PublicAssociationsPage.jsx`: directory public.
- `public/PublicAssociationShowsPage.jsx`: shows publics d'une association.
- `admin/PlatformAnalyticsPage.jsx`: analytics global ShowScore.
- `legal/LegalPages.jsx`: terms/privacy/results notice.

---

## 5. Routes principales

Routes dans `src/app/router/AppRouter.jsx`:

- `/`: accueil.
- `/login`: connexion/creation compte/invitation.
- `/terms`, `/privacy`, `/results-notice`: pages legales.
- `/public`: liste publique associations avec contenu public.
- `/public/associations/:associationId`: shows publics d'une association.
- `/public/associations/:associationId/shows/:showId`: vitrine publique show.
- `/admin/analytics`: analytics global, reserve a platform admin/local.
- `/associations`: liste/creation associations.
- `/associations/:associationId/shows`: competitions d'une association.
- `/associations/:associationId/access`: utilisateurs/acces.
- `/associations/:associationId/activity`: journal activite.
- `/associations/:associationId/settings`: reglages association.
- `/associations/:associationId/shows/:showId`: gestion show/journees.
- `/associations/:associationId/shows/:showId/secretariat`: secretariat.
- `/associations/:associationId/shows/:showId/time`: gestion du temps.
- `/associations/:associationId/shows/:showId/announcer`: annonceur.
- `/associations/:associationId/shows/:showId/scribe`: liste classes a scorer.
- `/associations/:associationId/shows/:showId/days/:dayId`: classes.
- `/associations/:associationId/classes/:classId/setup`: setup classe.
- `/associations/:associationId/shows/:showId/days/:dayId/paid-warmups/:paidWarmupId/setup`: setup warmup.
- `/associations/:associationId/scribe/classes/:classId`: scoring classe.

---

## 6. Navigation actuelle

Menu principal:

- `Accueil`
- `Vitrine publique`
- `Association`
- `Analytics` si platform admin/local/unconfigured
- Auth/status a droite, puis FR/EN

Sous-menu association, visible seulement quand on est dans une association mais pas dans un show:

- `Competitions`
- `Utilisateurs` si admin association
- `Reglages` si manager
- `Journal` si manager

Sous-menu competition, visible dans un show:

- Pastille logo + nom/shortName association
- `← Association`
- `Gestion`
- `Secretariat`
- `Annonceur`
- `Scribe`
- `Gestion du temps`

Decision UX importante:

- On a evite un menu a 3 etages visible en permanence.
- Quand on entre dans un show, le sous-menu association disparait.
- Le contexte association reste visible via logo + nom dans le menu de competition.

---

## 7. Rôles et permissions

Roles dans `src/features/auth/accessRoles.js`:

- `admin`
- `secretary`
- `scribe`
- `announcer`

Permissions importantes:

- `admin`: admin association, gestion utilisateurs, gestion association, peut tout faire dans son association.
- `secretary`: gestion show/journees/classes, secretariat, publication, peut scorer aussi.
- `scribe`: scoring, certaines modifications manuelles de draw.
- `announcer`: vue annonceur, paid warmup live.

Local/test:

- Si Supabase n'est pas configure ou login test local actif, l'utilisateur est considere sans restriction.
- Login local: `test@showscore.local` / `test1234`.

Platform admin:

- Table `platform_admins`.
- Ajout par `docs/platform-admin-bootstrap.sql`.
- Peut voir analytics global et agir comme super admin.

Role routing:

- Fichier `showRoleRouting.js`.
- Si un utilisateur a exactement un role operationnel:
  - `scribe` -> `/scribe`
  - `announcer` -> `/announcer`
  - `secretary` -> `/secretariat`
- Si plusieurs roles ou admin: reste sur gestion du show.

Important:

- Un utilisateur peut avoir plusieurs roles pour une association.
- Les admins/secretaries peuvent avoir acces a plus que leur role de base.
- Ne pas supposer qu'un email correspond a un seul role.

---

## 8. Fonctionnement general et flux utilisateur

Flux association:

1. Aller dans `Association`.
2. Creer ou ouvrir une association.
3. Regler nom, nom court, fuseau horaire, site web, logo.
4. Ajouter utilisateurs/roles.
5. Ouvrir `Competitions`.

Flux competition:

1. Creer un show.
2. Ouvrir le show.
3. Creer une ou plusieurs journees.
4. Ouvrir une journee.
5. Creer classes ou paid warmups.
6. Ouvrir setup d'une classe.

Flux setup classe:

1. Choisir nombre de juges dans creation/classe.
2. Dans setup, entrer les noms des juges.
3. Choisir pattern.
4. Importer/saisir runs.
5. Regler drag interval/duree, paid warmup si pertinent.
6. Setup devient pret.

Flux scribe:

1. Le scribe va dans l'onglet `Scribe` du show.
2. Il voit les classes setup pret/in progress/completed non publiees.
3. Il ouvre une classe.
4. Pour multi-juges, il doit choisir volontairement le juge avant de reserver/scorer.
5. Seulement la personne qui a claim la feuille peut modifier le score.
6. Classe finalisee apres signature.
7. Quand scoresheet publiee, elle disparait de l'onglet Scribe.

Flux secretariat:

1. Voir classes.
2. Valider les official results.
3. Generer/verifier PDF.
4. Publier/retirer scoresheets.

Flux annonceur:

1. L'annonceur ouvre son onglet.
2. Il peut ouvrir la classe qu'il annonce.
3. Il voit ce qui se passe sans restrictions publiques.
4. Il peut gerer les paid warmups.

Flux public:

1. Vitrine publique par association/show.
2. Live public selon options de publication.
3. Scoresheets publiees.
4. Prompt PWA/install/reload.

---

## 9. Systeme de scoring

Disciplines/patterns:

- Reining
- Ranch Riding
- Western Riding
- Trail / Obstacle Western
- Western Horsemanship
- Hunt Seat Equitation
- Showmanship

Detail important:

- `Small Fry Ranch Riding` n'est pas une discipline separee.
- Les patterns `Small Fry Ranch Riding #1-#5` sont maintenant dans le groupe `Ranch Riding`.
- Ils conservent leurs noms, mais utilisent les regles Ranch Riding.

Fichier central:

- `src/features/patterns/patternDefinitions.js`

Scoring:

- Utilitaires de base dans `src/utils/scoring.js`.
- Options par pattern dans `scoringOptions.js`.
- Textes de regles PDF dans `scoringRuleText.js`.
- Special statuses/penalties peuvent rendre un run complet meme sans scores complets:
  - Scratch
  - No score
  - Score 0
  - autres selon options

Ranch Riding / Western Riding / Reining:

- Reining, Ranch Riding, Western Riding et Small Fry Ranch Riding utilisent des totals de juges qui peuvent etre combines.
- Les descriptions PDF suivent maintenant la classe/pattern et non un range generique.

Patterns custom:

- Trail custom: minimum 6 manoeuvres.
- Western Horsemanship, Hunt Seat Equitation, Showmanship: patterns custom performance.
- Certains ont `overall form/effectiveness` et/ou rail adjustment.

Run:

- Contient draw, backNumber, rider, horse, owner.
- Contient scores de manoeuvres, penalties, penTotal, scoreTotal.
- Peut contenir startedAt/completedAt/durationSeconds pour timing.

Timing:

- Debut reel de classe enregistre au premier score/penalite.
- Estimation fin de classe basee sur temps mesures et drags.
- Stats globales par pattern via RPC `global_pattern_timing_stats`.

---

## 10. Multi-juges

Etat actuel:

- Support 1 a 5 juges.
- Mode 1 juge doit rester intact car c'est l'usage majoritaire.
- Chaque classe a une liste de juges dans `class_setups.judges`.
- Chaque juge a sa propre session dans `judge_scoring_sessions`.
- Chaque scribe doit avoir son propre login.
- Chaque juge peut etre claim par un scribe.
- Pas de liberation automatique du claim, volontairement, pour eviter qu'un scribe perde son acces apres coupure internet.

Regles metier confirmees avec l'utilisateur:

- Un score est lie au juge, au concurrent/run et a la classe.
- Les manoeuvres restent separees par juge.
- L'addition se fait seulement sur les totaux des juges, pas sur chaque manoeuvre.
- Pour PDF combine: draw 1 apparait une fois par juge, puis draw 2 une fois par juge, etc.
- Le PDF combine ne doit pas additionner les juges dans les lignes de scoresheet.
- Le score global public/secretariat peut additionner les totals des juges.
- Aucune moyenne.
- Pour Reining/Ranch Riding/Small Fry/Western Riding: si 5 juges, le plus haut et le plus bas sont ignores dans le calcul global, donc maximum 3 scores retenus.
- Pour autres disciplines: les juges donnent chacun leurs classements; la combinaison se fait hors app. L'app affiche/produit les scoresheets, mais ne calcule pas un score global final combine pour ces disciplines.

Fichiers critiques:

- `classJudges.js`
- `judgeScoringSessionRepository.js`
- `multiJudgeScoring.js`
- `multiJudgeOfficialData.js`
- `multiJudgeLiveData.js`
- `ClassScoringPage.jsx`
- `officialPdfService.js`

Live multi-juges:

- Le live detaille n'est pas permis si plus d'un juge.
- En multi-juges, le public doit voir le score complet seulement quand tous les scribes/juges requis ont complete la run.
- Le live affiche les scores par juge + addition quand run complete.

---

## 11. PDF et signatures

PDF officiel:

- Genere via `officialPdfService.js`.
- Doit respecter les descriptions de pointage selon les regles de la classe.
- Le nom du patron ne doit pas sortir du cadre.
- Les PDFs existent en:
  - PDF combine avec toutes les signatures.
  - PDF par juge.

Signature:

- Fenetre signature amelioree en popup grand format/tablette.
- La signature doit etre plus fluide qu'un petit cadre.

Classes finalisees:

- Une fois finalisee/publiee, les scoresheets ne doivent plus etre visibles dans l'onglet Scribe.

---

## 12. Live public et annonceur

Statuts publication:

- `hidden`
- `live`
- `live_no_score`
- `live_scoring`
- `live_finished`
- `official`
- `published`

Definitions live:

- En francais:
  - En piste
  - En preparation = prochain
  - En attente = 2e prochain
- En anglais:
  - In the arena = actuellement en piste
  - On deck = prochain a entrer
  - In the hole = suivant apres lui

Choix UX recents:

- Les classes live sont masquees/collapsed d'emblee pour alleger la vitrine.
- Le nom du manege est affiche lorsque le live est masque.
- Dans le live, on a retire les libelles redondants "prochain participant" et "2e prochain", car les tags suffisent.
- En mode live score complet, l'encadre "deux derniers passes" a ete retire car l'ordre de passage live affiche deja les passes.

Annonceur:

- La vue annonceur est proche du live, mais sans restriction publique.
- L'annonceur peut voir ce qui n'est pas officiellement publie.
- Il gere aussi les warmups.
- Il ouvre la classe qu'il veut annoncer.
- Pas de restriction par email; restriction par role.

---

## 13. Offline/local/sync

Philosophie:

- L'app est local-first.
- Supabase est requis pour les workflows multi-utilisateurs/cloud.
- Si Supabase n'est pas configure, l'app fonctionne avec localStorage.
- Si Supabase refuse ou echoue, plusieurs repositories retombent localement.

Important:

- Le fallback local est utile en dev, mais peut masquer un probleme de migration Supabase.
- En prod, si une feature ne marche pas, verifier d'abord si la migration SQL a ete executee.

Supabase client:

- `src/features/cloud/supabaseClient.js`.
- Si login local test actif, `getSupabaseClient()` retourne `null`.

Sync/queue:

- Scoring a une queue/sync dans `scoringSyncQueue.js`.
- Des badges montrent `Supabase connecte`, `Local`, `Test local`, etc.

Local storage:

- Associations, shows, days, classes, setups, scoring, publications ont du storage local.
- Les analytics ont aussi un fallback local dans `showscore_app_events_v1`.

---

## 14. Supabase et migrations

Pour nouveau projet Supabase:

1. Run `docs/supabase-schema.sql`.
2. Enable email/password auth.
3. Creer user Auth.
4. Run `docs/platform-admin-bootstrap.sql` avec email admin.
5. Configurer env vars.

Pour projet existant:

- Run les migrations pertinentes dans `docs/`.
- Migration recente obligatoire pour analytics cloud:
  - `docs/supabase-analytics-migration.sql`

Tables principales:

- `user_profiles`
- `platform_admins`
- `associations`
- `association_memberships`
- `association_invitations`
- `shows`
- `days`
- `classes`
- `paid_warmups`
- `class_setups`
- `scoring_sessions`
- `judge_scoring_sessions`
- `official_results`
- `publication_states`
- `app_events`

Fonctions/RPC importantes:

- `current_user_is_platform_admin`
- `current_user_has_association_role`
- `current_user_can_manage_association`
- `current_user_can_score_association`
- `current_user_can_admin_association`
- `current_user_can_read_class`
- `current_user_can_score_class`
- `current_user_can_manage_class`
- `class_has_published_official_result`
- `class_is_publicly_visible`
- `global_pattern_timing_stats`
- `public_show_timing_summary`
- `find_user_profile_for_association`
- `create_association_with_owner`
- `record_app_event`

RLS:

- Les policies sont tres importantes.
- Les lectures publiques passent seulement par classes/results/live publies.
- Les association managers peuvent lire seulement les audit events de leur association.
- Les platform admins peuvent lire tous les app events.
- Les insertions analytics passent par RPC `record_app_event` en security definer; il n'y a pas de policy insert directe necessaire cote client.

---

## 15. Analytics et journal d'activite

Ajoute recemment:

- `app_events` dans Supabase.
- Migration: `docs/supabase-analytics-migration.sql`.
- Fallback local si Supabase non configure.

Types:

- `analytics`: evenements generaux comme `page_view`.
- `audit`: journal d'actions.

Evenements actuellement logges:

- `page_view`
- `auth_signup_attempt`
- `auth_signup_success`
- `auth_signup_submitted`
- `auth_signup_failed`
- `auth_signin_attempt`
- `auth_signin_success`
- `auth_signin_failed`
- `auth_local_test_signin`
- `association_created`
- `association_updated`
- `association_deleted`
- `show_created`
- `show_updated`
- `show_deleted`
- `day_created`
- `day_updated`
- `day_deleted`
- `class_created`
- `class_updated`
- `class_deleted`
- `class_setup_ready`
- `membership_saved`
- `membership_deleted`
- `invitation_created`
- `invitation_cancelled`
- `invitation_accepted`
- `scoresheet_published`
- `scoresheet_hidden`
- `publication_status_changed`

Pages:

- `/admin/analytics`: global, pour platform admin/local.
- `/associations/:associationId/activity`: journal association, pour managers de l'association.

Limitations actuelles analytics:

- Pas encore de filtres avances date/action/user.
- Plusieurs lignes affichent encore IDs au lieu de noms lisibles.
- Pas d'export CSV.
- Pas de graphiques temporels.
- Pas d'aggregation SQL avancee; la page charge les evenements recents et resume cote client.

Important legal:

- `LegalPages.jsx` a ete mis a jour le 2026-05-28 pour mentionner analytics/journal.
- Ce n'est pas un avis juridique final.

---

## 16. SEO et vitrine publique

SEO:

- `SeoMeta.jsx`
- `publicSeo.js`
- Titres/descriptions par association/show.

Vitrine:

- Public directory `/public`.
- Association public page.
- Show public page.

Assets:

- L'app n'utilise pas de gros assets externes.
- Logo association peut etre URL/data URL.

---

## 17. PWA, cache, installation

PWA:

- `registerServiceWorker.js`.
- `PublicAppInstallPrompt.jsx`.

But:

- Inviter le public a installer l'app sur ecran d'accueil.
- Proposer reload si app pas a jour.

Limitation:

- Il faut tester les mises a jour apres deploiement sur vrais appareils.
- L'utilisateur avait remarque que parfois l'app installee ne semble pas se mettre a jour apres deploiement.

---

## 18. Roadmap V1 / V2 / V3

V1 historique:

- Local-only React app.
- Gestion basic association/show/day/class.
- Setup draw.
- Scoring scribe.
- Signature juge.
- PDF officiel.

V2 etat actuel:

- Cloud Supabase.
- Roles association.
- Invitations.
- Vitrine publique.
- Live public.
- Announcer.
- Secretariat.
- Publication states.
- SEO.
- PWA/update prompt.
- Navigation restructuree.
- Analytics/journal.
- Paid warmups.
- Timing.

V2.5 actuel:

- Multi-juges implemente.
- PDF combine/par juge.
- Live multi-juges.
- Onglet Scribe show-level.

V3 potentiel:

- Analytics plus avances.
- Export CSV analytics/journal.
- Graphiques par periode.
- Plus d'outils admin ShowScore.
- Integration email transactionnel.
- Robustesse offline/sync plus poussee.
- Historique/versions de scoresheets.
- Vraie page de support/diagnostic.
- Eventuellement outils de finance/abonnements.
- Eventuellement plus de disciplines/regles officielles.

---

## 19. Decisions techniques importantes

Local-first:

- Conserver l'app utilisable sans Supabase.
- Les repositories doivent generalement fallback local.

Repositories:

- La logique stockage/cloud doit rester dans `features/*Repository.js`, pas directement dans les pages.

RLS:

- Ne pas contourner RLS cote client.
- Ajouter des helpers SQL security definer si necessaire pour eviter recursion.

1 juge intact:

- Ne jamais casser le mode 1 juge.
- C'est environ 98% des usages prevus selon l'utilisateur.

Multi-juges:

- Scores de manoeuvres separes par juge.
- Addition seulement des totaux.
- Aucune moyenne.

Claims scribe:

- Pas de liberation automatique.
- La personne qui claim le juge/classe est la seule qui peut modifier.

Navigation:

- Eviter les menus a 3 etages visibles.
- Garder le contexte association via pastille logo/nom dans menu competition.

UI:

- App operationnelle, pas landing page marketing.
- Interfaces denses mais lisibles.
- Cards seulement quand utile; eviter nesting inutile.
- Les boutons operationnels doivent rester accessibles vite en show.

Supabase migrations:

- Le code peut etre en avance sur la base.
- Toujours verifier SQL avant de debugger trop loin.

---

## 20. Conventions de code

General:

- JavaScript/React, pas TypeScript.
- Components fonctionnels.
- Hooks React.
- Styles inline constants en bas de fichier.
- Traductions via `useTranslation()` et `translations.js`.
- Repositories async retournent fallback local quand possible.

Nommage:

- `associationId`, `showId`, `dayId`, `classId`.
- DTO JS camelCase.
- Supabase snake_case.
- Conversion dans repositories.

Tests:

- Tests unitaires dans `src/App.test.js`.
- Ajouter tests pour logique pure importante.
- Ne pas sur-tester UI si changement mineur.

Git:

- Verifier l'etat du repo avant de modifier ou de faire une operation git.
- Ne pas faire de commande destructive sans demande explicite.

Edition:

- Utiliser `apply_patch` pour edits manuels.
- Ne pas utiliser `cat > file`.

---

## 21. Bugs connus et limitations actuelles

Pas de bug bloquant connu au moment de cette passation.

Limitations / zones a tester:

- QA terrain complete a faire.
- Multi-juges a tester en vrai avec 1, 2, 3, 5 juges.
- 5 juges avec drop high/low a verifier sur plusieurs cas reels.
- Live multi-juges a verifier en conditions de plusieurs scribes.
- Droits/claims scribe a tester en prod avec comptes separes.
- Analytics cloud ne fonctionne que si `supabase-analytics-migration.sql` est executee.
- Journal d'activite affiche certains IDs au lieu de noms.
- Pas de filtres avances dans analytics/journal.
- PWA/cache update a tester apres deploiement.
- Politique/confidentialite doit etre validee legalement si usage commercial public.
- Certaines migrations existantes peuvent ne pas etre executees dans Supabase PROD/DEV.
- Build CRA peut parfois etre tue par memoire dans sandbox; relancer si message "process exited too early". Le build a passe au second essai.

---

## 22. Elements non termines

Rien de majeur dans la liste utilisateur originale.

Restes raisonnables:

- Executer migrations Supabase recentes.
- Tester end-to-end en local et prod.
- Ameliorer journal/analytics avec filtres.
- Remplacer IDs par noms lisibles dans journal.
- Ajouter export CSV analytics/journal si besoin.
- Ajouter tests UI/e2e plus tard.
- Valider service worker/update prompt en prod.

---

## 23. TODO prioritaires

Priorite 1 - avant vrai show:

1. Executer toutes les migrations Supabase manquantes en DEV puis PROD.
2. Verifier `docs/supabase-analytics-migration.sql`.
3. Tester login/invitation/roles en Supabase reel.
4. Tester flow complet:
   - association
   - show
   - journee
   - classe
   - setup
   - scoring
   - signature
   - secretariat
   - publication
   - vitrine publique
5. Tester multi-juges avec vrais comptes separes.
6. Tester live public sur mobile.
7. Tester annonceur et paid warmups.

Priorite 2:

1. Ajouter filtres journal/analytics.
2. Afficher noms show/classe dans journal.
3. Export CSV.
4. Ajouter diagnostics admin.
5. Ameliorer tests pour workflows critiques.

Priorite 3:

1. Ameliorer design responsive.
2. Ajouter graphiques analytics.
3. Ajouter docs utilisateur.
4. Ajouter monitoring d'erreurs.

---

## 24. Dependances importantes

Package dependencies:

- `@supabase/supabase-js`
- `react`
- `react-dom`
- `react-router-dom`
- `react-scripts`
- `jspdf`
- `pdfjs-dist`
- Testing Library packages

External:

- Supabase project DEV/PROD.
- Hosting Vercel or Netlify.

No known required paid API beyond Supabase/hosting.

---

## 25. Fichiers critiques a comprendre avant modification

`src/app/router/AppRouter.jsx`

- Toute nouvelle page/route y passe.
- `AnalyticsRouteTracker` est monte ici.

`src/components/AppMenu.jsx`

- Navigation principale et contextuelle.
- Contient logique access/menu.
- Attention a ne pas recreer un menu trop charge.

`src/features/auth/accessRoles.js`

- Source des roles/capabilities.
- Modifier avec prudence.

`src/features/auth/useAssociationAccess.js`

- Hook central des permissions.
- Utilise local mode/platform admin/memberships.

`src/features/cloud/supabaseClient.js`

- Si login local test actif, Supabase est desactive volontairement.

`src/features/patterns/patternDefinitions.js`

- Patterns, disciplines, headers, descriptions.
- Beaucoup de logique depend de ces IDs.

`src/features/scoring/scoringOptions.js`

- Options penalties/scoring par pattern.

`src/features/scoring/multiJudgeScoring.js`

- Calculs multi-juges, somme, drop high/low.

`src/features/scoring/multiJudgeLiveData.js`

- Live multi-juges.

`src/features/classes/officialPdfService.js`

- Generation PDF officiel.
- Attention aux tailles/positions texte.

`src/pages/scribe/ClassScoringPage.jsx`

- Tres important et probablement gros.
- Gestion scoring, juge selection, claims, signature.
- Lire avant toute modif scoring.

`src/features/publication/publicViewRepository.js`

- Construction donnees publiques.
- Ne pas exposer accidentellement des donnees non publiees.

`src/features/live/liveViewRepository.js`

- Vue annonceur.
- Plus permissive que public.

`src/features/analytics/analyticsRepository.js`

- Tracking events, fallback local, resume analytics.

`docs/supabase-schema.sql`

- Schema complet.

`docs/supabase-analytics-migration.sql`

- Migration analytics pour projet existant.

---

## 26. Problemes deja resolus

Traductions:

- Accueil et vitrine publique traduites FR/EN.

Navigation:

- Ancien menu trop charge (`Gestion`, `Shows`, `Show`, etc.).
- Nouvelle navigation en niveaux:
  - Accueil / Vitrine publique / Association / Analytics
  - Competitions / Utilisateurs / Reglages / Journal
  - Gestion / Secretariat / Annonceur / Scribe / Gestion du temps
- Ajout contexte association dans menu show.

Live:

- Active/on deck/in the hole clarifies.
- Encadres redondants retires.
- Live collapsed par defaut.
- Manege affiche quand masque.

Annonceur:

- Vue annonceur simplifiee et proche du live.
- Ouvre classe a annoncer.
- Voit plus que public.

Scribe:

- Onglet Scribe show-level.
- Classes publiees disparaissent.
- Selection juge avant claim.
- Empêche deux scribes de scorer le meme juge.

Multi-juges:

- Noms juges dans vitrine.
- Live multi-juges affiche scores par juge + addition.
- PDF combine/par juge.
- Mode 1 juge preserve.

PDF:

- Descriptions de pointage selon regles de classe.
- Nom patron ne sort plus du cadre.
- Signature popup plus fluide.

Admin/usability:

- Message Supabase remplace par message admin association.
- Fuseau horaire auto + dropdown complet.
- Prompt PWA install/update.

SEO:

- Metadata publiques par association/show.

Analytics:

- Infrastructure analytics/journal.
- Page analytics globale.
- Page journal association.

---

## 27. Hypotheses de design

Public cible:

- Associations de shows equestres.
- Secretariats.
- Scribes.
- Annonceurs.
- Public/participants.

Design:

- Plus outil operationnel que site marketing.
- Priorite aux actions rapides pendant un show.
- Interfaces calmes, denses, lisibles.
- Les workflows doivent etre clairs pour des utilisateurs non techniques.

Langue:

- FR/EN.
- L'utilisateur principal parle francais.
- Les termes de show restent parfois hybrides: show, run, paid warm up, scribe, draw.

Mobile:

- Public/vitrine doit etre bon mobile.
- Scoring/tablette important.

Performance:

- Le live peut recevoir plusieurs updates en meme temps.
- Eviter d'envoyer trop de details publics en multi-juges.

---

## 28. Comment demarrer le projet

Prerequis:

- Node 20+
- npm 10+

Setup:

```bash
nvm use
npm install
npm start
```

Si port 3000/3001 occupe:

```bash
PORT=3002 HOST=127.0.0.1 BROWSER=none npm start
```

En local sans Supabase:

- Aller a `/login`.
- Utiliser `test@showscore.local` / `test1234` si le bouton local est visible.
- Ou travailler en mode local non configure.

Avec Supabase:

1. Copier `.env.development.example` vers `.env.local`.
2. Remplir:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_PUBLISHABLE_KEY`
3. Run schema/migrations.
4. Restart `npm start`.

---

## 29. Comment tester le projet

Tests unitaires:

```bash
npm test -- --watchAll=false
```

Build:

```bash
npm run build
```

Robot E2E Playwright:

```bash
npm run test:e2e
```

Robot E2E visible:

```bash
npm run test:e2e:visible
```

Robot E2E demo lente:

```bash
npm run test:e2e:demo
```

Robot E2E avec video:

```bash
npm run test:e2e:record
```

Demo produit A a Z:

```bash
npm run test:e2e:product-demo
```

Video demo produit HD:

```bash
npm run test:e2e:product-demo:record
```

Le robot visible ouvre un vrai Chromium, genere un show local a 5 juges,
ouvre l'onglet Scribe, force le choix du juge avant claim, puis ouvre la
vitrine live et verifie les scores par juge + le total combine. Les donnees
sont semees dans un profil navigateur Playwright, donc elles ne modifient pas
les donnees du navigateur normal.

`npm run test:e2e:record` sauvegarde aussi une video WebM stable ici:
`test-results/show-robot-demo.webm`. Le dossier `test-results` est ignore par
Git.

`npm run test:e2e:product-demo:record` cree une demo plus filmable et plus
complete: association, show, journee, classe, setup, import de draw, scoring
simule et vitrine live detaillee. La video est forcee en 1920x1080 et sauvegardee
dans `test-results/show-score-product-demo.webm`.

Note:

- Le build CRA peut echouer une fois si process tue/OOM dans sandbox. Relancer avant de conclure.
- Si le build manque de memoire, relancer avec `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.
- Playwright demarre l'app sur `127.0.0.1:3010` par defaut.

Manual QA minimum:

1. Login local.
2. Creer association.
3. Regler association.
4. Creer show.
5. Creer journee.
6. Creer classe single judge.
7. Setup pattern + runs.
8. Scorer.
9. Signer.
10. Valider secretariat.
11. Publier.
12. Voir vitrine publique.
13. Voir PDF.
14. Tester live.
15. Tester annonceur.
16. Tester analytics/journal.

Manual QA multi-juges:

1. Creer classe 2 juges.
2. Ajouter noms des juges.
3. Ouvrir scribe avec deux comptes ou sessions.
4. Claim juge different.
5. Verifier impossibilite de scorer le meme juge.
6. Completer runs.
7. Verifier live public: scores par juge + addition.
8. Verifier PDF combine.
9. Verifier PDF par juge.

Manual QA Supabase:

1. Verifier migrations.
2. Tester compte admin.
3. Tester invitation email/token.
4. Tester role scribe only -> redirection Scribe.
5. Tester role announcer only -> redirection Annonceur.
6. Tester role secretary only -> redirection Secretariat.
7. Tester multi-role -> Gestion.
8. Tester analytics cloud via `app_events`.

---

## 30. Ce qu'un futur Codex doit absolument savoir

1. Ne pas casser le mode 1 juge.
2. Multi-juges additionne les totals, pas les manoeuvres.
3. Aucune moyenne multi-juges.
4. 5 juges en Reining/Ranch/Small Fry/Western Riding: drop high/low.
5. Small Fry Ranch Riding est dans Ranch Riding, pas une discipline separee.
6. L'annonceur voit plus que le public.
7. Le public ne doit jamais voir de donnees non publiees, sauf live explicitement autorise.
8. Le live detaille est desactive en multi-juges.
9. L'onglet Scribe cache les classes publiees.
10. Le scribe doit choisir un juge avant claim.
11. Pas de liberation automatique du claim.
12. Les migrations Supabase sont souvent la cle des bugs prod.
13. Les classes sans patron utilisent `NO_PATTERN` et `class_setups.schedule_details`; executer `docs/supabase-schedule-only-classes-migration.sql` en cloud.
14. Le fallback local peut masquer un bug cloud.
15. La navigation a ete travaillee; ne pas rajouter un troisieme etage visible sans bonne raison.
16. Les pages public/mobile sont importantes.
17. Les tests unitaires historiques sont dans `App.test.js`; ajouter tests pour logique pure.
18. Le robot Playwright principal est dans `tests/e2e/show-robot.spec.js`.
19. Les styles sont inline; rester coherent.
20. La politique de confidentialite existe, mais n'est pas un avis legal final.
21. L'application est maintenant en phase QA, pas en phase "ajouter grosses features".

---

## 31. Checklist avant toute nouvelle modification

```bash
git status --short --branch
npm test -- --watchAll=false
```

Puis:

- Identifier le fichier source de verite.
- Verifier si la logique doit aller dans repository/service plutot que page.
- Verifier traductions FR/EN.
- Verifier Supabase migration si ajout de colonne/table/RPC.
- Verifier fallback local.
- Ajouter test si logique metier.
- Run build.
- Commit local seulement si le travail est complet et que l'utilisateur veut continuer ainsi.

---

## 32. Resume court pour futur Codex presse

ShowScore est une app React/Supabase local-first pour gerer des competitions equestres jugees: setup classes, scoring, multi-juges, signatures, PDF, secretariat, annonceur, live public, vitrine publique, roles, analytics et journal. Les grosses features demandees sont implementees. Le projet est maintenant en phase QA. Le plus grand risque est de casser le mode 1 juge ou d'oublier une migration Supabase. Toujours tester `npm test -- --watchAll=false` et `npm run build`.
