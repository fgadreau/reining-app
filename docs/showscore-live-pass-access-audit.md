# Audit initial — accès publics et pass ShowScore

Date initiale : 26 octobre 2026. Périmètre : examen statique des dépôts locaux SS et HSP, puis lecture des métadonnées de la base PREPROD via le connecteur Supabase. Aucune donnée métier nominative extraite, aucune base modifiée, aucun déploiement ni paiement effectué. Aucune interrogation du contenu de la base PROD.

## Conclusion

Le live actuel est conçu pour être public. Il n'existe pas encore de séparation acheteur/non-acheteur dans les chemins examinés. Un verrou d'interface ne suffit pas : les lectures initiales, le broadcast, le repli Postgres Changes et l'accès TV doivent être traités ensemble avant la vente des pass.

Commencer exclusivement en préproduction : PR vers `preprod`, Supabase PREPROD partagé avec HSP, Stripe sandbox, utilisateurs et shows de test. Aucun changement de production dans cette phase. Les migrations de la base partagée restent dans HSP.

## Sources inspectées

Chemins SS relatifs à ce dépôt; chemins HSP relatifs au dépôt voisin HorseShowPlatform.

| Source | Constat |
| --- | --- |
| SS `src/features/publication/publicationRepository.js` | États `hidden`, `live`, `live_no_score`, `live_scoring`, `live_finished`, `official`, `published`; modes de score `hidden`, `completed_total`, `full_details`. Ces états pilotent la diffusion, pas un droit commercial. |
| SS `src/features/publication/publicViewRepository.js` — `getPublicShowViewRepository` et chargements associés | Le client lit notamment sessions de scoring, sessions juges, setups, publication, résultats officiels et session annonceur; les helpers utilisent des sélections de lignes complètes. |
| Même fichier — `buildPublicLiveClassView` | Construit dans le navigateur pointages, détails et standings à partir des sessions reçues. Les booléens d'affichage ne protègent pas les données sources. Les chemins multi-juges et annonceur doivent être couverts. |
| Même fichier — abonnement public | Canal `showscore-public:<showId>` avec `private: true`, puis repli `public-show-fallback:<showId>` sur Postgres Changes, notamment scoring/juges/setups/publication/officiel/annonceur. |
| SS `src/pages/public/PublicShowTvPage.jsx`, `PublicShowOverlayPage.jsx`, pages livestream | Réutilisent le repository public; la TV et les overlays ne constituent pas aujourd'hui un périmètre d'autorisation commercial distinct. |
| HSP `supabase/migrations/20260807000100_showscore_public_broadcast.sql` | Autorise `anon` et `authenticated` à recevoir un topic de show public. Le projecteur contient notamment `runs` des sessions scoring/juges/annonceur et `official_runs` des résultats. « Private » désigne un canal soumis à autorisation, pas réservé aux comptes payants. |
| HSP `supabase/migrations/20260801000800_showscore_block_function_alignment.sql` | Le helper `showscore_public_live_class_exists` se base sur le bloc public, le show public et l'état live. Il ne vérifie pas de pass. |
| HSP `supabase/migrations/20260801002700_showscore_announcer_live_sessions.sql` | La politique de lecture des sessions annonceur prévoit un chemin public via `showscore_public_class_exists`, en plus des droits de l'équipe. À intégrer à la revue cumulative des politiques. |
| SS `src/features/classes/officialResultRepository.js` — `validateOfficialResultRepository` | Vérifie les signatures, enregistre la validation secrétariat, synchronise les scores HSP, puis publie la scoresheet si `publishScoresheet` est vrai. C'est une séquence d'opérations, pas une publication atomique garantie. |
| SS `publicViewRepository.js` — `buildPublicClassView` | Scoresheet affichée si publication `published` et validation secrétariat; présence d'un repli sur `scoringRuns` si le snapshot officiel est vide. Vérifier que le futur chemin gratuit ne réexpose jamais une session provisoire. |
| Même fichier — `buildPublicResultClassViews` | Résultats finaux construits à partir de `block_result_publications`, statut publié et groupes de résultats; document scoresheet facultatif. Publication des résultats et publication de la scoresheet sont distinctes aujourd'hui. |
| SS `public/service-worker.js` | Cycle installation/mise à jour, fetch sans cache implémenté et aucun gestionnaire push. Aucun système de notifications trouvé dans le périmètre inspecté. |
| SS `docs/deployment.md`, `docs/production-promotion.md` | Parcours prévu : fonctionnalités vers `preprod`, validation croisée HSP/SS, puis promotion contrôlée vers `main`. |

Les anciennes migrations publiques, dont `0051_showscore_public_access.sql`, précèdent le passage classes → blocks. Elles ne décrivent pas seules les permissions actuelles. Ne pas modifier un ancien fichier pour tenter de corriger la sécurité : examiner les politiques finales, grants, fonctions et vues puis créer une migration HSP additive appropriée.

## Matrice cible

| Donnée | Visiteur / compte sans pass | Pass couvrant le show | Équipe / TV autorisée |
| --- | --- | --- | --- |
| Programme et draw publiés | Oui | Oui | Selon rôle |
| Dans le pen, prochains passages, progression | Oui, projection sans scores | Oui | Selon rôle |
| Score provisoire publiable, détail et standings live | Non | Oui, selon autorisation de diffusion | Selon rôle et configuration de diffusion TV |
| Brouillon non publiable du scribe | Non | Non | Seulement rôles autorisés |
| Résultats officiels et scoresheets publiés | Oui, simultanément | Oui | Oui selon rôle |
| Notifications personnalisées | Non | Oui, avec consentement par appareil | Ne pas assimiler automatiquement rôle professionnel et pass personnel |

Un utilisateur connecté sans pass ne doit pas obtenir davantage de scores qu'un visiteur. Les modes de diffusion de l'association restent un plafond : un pass ne transforme pas un live sans scores en accès aux brouillons.

## Architecture à préparer

1. Séparer les projections serveur : progression publique sans scores; live payable avec droit utilisateur; documents officiels publiés gratuits; accès opérationnels selon rôle.
2. Conserver les données brutes de saisie hors des projections publiques. Vérifier les colonnes JSON `runs`, les sessions multi-juges, les standings calculables et les snapshots officiels dans tous les chemins.
3. Séparer les événements publics et payants. Un événement public peut invalider un snapshot gratuit sans transporter les scores. Le canal payant doit vérifier le périmètre show/association/saison et traiter la révocation d'accès.
4. Protéger également Postgres Changes ou supprimer ce repli pour les données payantes : un repli ne doit jamais contourner le contrôle du canal principal.
5. Prévoir un appairage ou une session d'affichage pour les TV autorisées. Une URL publique ou un code court partagé n'est pas, à lui seul, une preuve d'autorisation pour accéder aux données payantes. Décider du traitement des overlays OBS et du livestream, sans casser les affichages du concours.
6. Unifier le moment de publication gratuite résultats/scoresheets par classe, avec gestion des erreurs intermédiaires et des blocs contenant plusieurs classes concurrentes. Préciser ce qui peut être publié indépendamment sans divulguer une autre classe non validée.
7. Revoir les replis locaux, les états en mémoire et les caches lors de la connexion, déconnexion, changement de compte et remboursement. Ne pas laisser un ancien snapshot payant visible à un autre utilisateur.

Ces points constituent des propositions techniques à préciser avant implémentation; aucune migration ni architecture de paiement n'est activée par cet audit.

## Plan de validation PREPROD

### Préparer

- Confirmer URL stable SS, URL HSP, références PREPROD et absence de connexion à PROD, sans exposer les secrets dans les rapports.
- Vérifier les migrations réellement appliquées et les politiques finales, fonctions, grants et canaux autorisés. L'examen local ne démontre pas leur état distant.
- Utiliser un show de test AQR, des classes concurrentes, un bloc multi-juges et un live source annonceur.
- Préparer visiteur, compte sans pass, pass show, pass saison valide, pass d'une autre saison/association, secrétaire, scribe et TV appairée.
- Paiements Stripe sandbox uniquement; aucun achat réel.

### Vérifier avant d'ouvrir la vente

- Requêtes directes aux tables/RPC, snapshot, broadcast et repli : aucun score provisoire sans droit, même si l'interface est contournée.
- Progression et draw gratuits utilisables lorsque le score est retenu; absence de score dans les JSON et événements gratuits.
- Modes `live_no_score`, `live_scoring`, `live`, `live_finished` et autorisations multi-juges respectés pour tous les profils.
- Publication officielle : résultats et scoresheets gratuits ensemble, sans accès prématuré aux autres classes du bloc.
- Erreur pendant validation/synchronisation/publication : état explicite, reprise sans publier une version incohérente.
- TV/OBS autorisés et équipe fonctionnels; copier une URL TV ne doit pas fournir un accès payant sans autorisation.
- Déconnexion, changement d'utilisateur et remboursement : suppression du droit et fermeture/réévaluation du flux protégé.
- Paiement confirmé après fermeture de page, confirmations doublées, taxes et reçu vérifiés en sandbox.
- Draw, résultats et seuil de passages : livraison test sur iPhone/Android, scratches, plusieurs chevaux, réordonnancements et absence de doublons.

Conserver les preuves PREPROD par scénario (environnement, SHA SS/HSP, résultat attendu/obtenu, appareil). Aucun de ces essais fonctionnels n'a encore été exécuté dans cet audit documentaire.

## Complément — configuration PREPROD effectivement lue

Le connecteur distingue « Horse Show Platform » de « Horse Show Platform PREPROD ». Les requêtes de catalogue ont été limitées au projet explicitement nommé PREPROD (`qaguotdproxamgudnnsd`). Cette identification confirme la cible des requêtes SQL, pas la configuration du déploiement web actuellement servi. Celle-ci reste à vérifier séparément.

Lecture de `pg_policies`, `pg_proc`, `pg_class`, privilèges de tables/colonnes, `pg_publication_tables`, `storage.buckets` et historique des migrations. Les migrations `0051`, `0061`, `20260801000800`, `20260801002700` et `20260807000100` sont inscrites comme appliquées. Aucun essai d'achat ou de notification n'a été effectué.

### Constats classés par priorité

| Priorité | Constat vérifié | Conséquence et correction à préparer |
| --- | --- | --- |
| Bloquant pour les pass | Les sept tables scoring/juges/setup/officiel/publication/annonceur/résultats ont RLS activée mais aussi SELECT pour `anon` et `authenticated`. Les colonnes `runs` et `official_runs` sont accessibles selon les politiques de ligne. | RLS activée ne signifie pas accès payant protégé. Prévoir projections filtrées et autorisation du pass avant d'exposer les scores. |
| Bloquant pour les pass | Les politiques publiques scoring/juges appellent `showscore_public_live_class_exists`; sa définition déployée autorise aussi `live_no_score` sans vérifier de pass. | Le mode sans scores ne protège pas les sessions au niveau serveur; les scores éventuels d'une session restent lisibles si les autres conditions sont réunies. Séparer la progression gratuite des sessions de pointage. |
| Bloquant pour la publication contrôlée | Les anciennes politiques `Anyone can view official results of public shows` et `Anyone can view class setups of public shows` sont encore présentes, en plus des règles plus récentes. Elles se contentent du show public. | Les politiques permissives s'additionnent : ajouter une règle restrictive supplémentaire ne neutralise pas l'ancienne. Supprimer/remplacer les chemins larges dans une nouvelle migration HSP, en conservant les accès professionnels requis. La politique des résultats officiels ne requiert actuellement ni finalisation ni publication. |
| Bloquant pour les pass | Le helper de broadcast déployé autorise les visiteurs du show public et le projecteur transporte les tableaux de runs. Les quatre tables scoring/juges/officiel/annonceur restent dans `supabase_realtime`. | Protéger le broadcast et son repli ensemble; distinguer flux gratuit, payant et affichages autorisés. |
| Bloquant pour la confidentialité avant publication | Le bucket `class-scoresheets` est public. Une politique Storage SELECT permet aussi la lecture de tous ses objets. | Masquer les métadonnées du document ne protège pas une URL connue. Préparer un stockage privé avec accès autorisé, ou une publication contrôlée des fichiers, et revoir les URL mises en cache. Ne pas simplement changer le bucket sans adapter les consommateurs. |
| Important | La table `show_score_class_documents` vérifie bien un helper de publication pour son chemin public. Celui-ci exige notamment résultats publiés, flags publics et show au statut `open`. | Protection des métadonnées distincte de celle du fichier. Vérifier aussi que les résultats/scoresheets restent publics une fois le show fermé ou archivé, conformément au produit. |
| Important | La session annonceur possède un chemin public via la visibilité du bloc, sans pass. | Inclure la source annonceur dans la protection, même si le scoring principal est corrigé. |

Ces constats portent sur les définitions et privilèges réellement présents. Ils démontrent des chemins d'autorisation trop larges pour le futur modèle; ils ne constituent pas un test HTTP d'extraction sur des données de participants. Aucun contenu de PDF n'a été téléchargé.

La recherche de vues ordinaires du schéma `public` référençant directement les tables scoring/juges/officiel n'a rien retourné. Ce contrôle limité ne couvre pas toutes les fonctions, vues matérialisées, accès indirects ou autres schémas; il ne vaut pas certification générale d'absence de fuite.

### Replis et publication côté SS

- `getPublicShowViewRepository` revient à `getPublicShowView(showId)` après erreur distante; ce chemin reconstruit le public à partir des données locales. `getPublicResultPublicationMap` possède également un repli local. Un refus d'autorisation ne devra jamais devenir une permission de réafficher un snapshot payant déjà stocké.
- `resultPublicationRepository.js` enregistre d'abord la publication localement, puis tente l'upsert distant et renvoie un état de synchronisation. `publicationCloudRepository.js` enregistre aussi localement avant l'upsert; certaines erreurs sont journalisées puis la fonction renvoie quand même l'état local. Une action locale ne doit pas déclencher une notification « publié » avant confirmation serveur.
- `authRepository.js` — `signOut` efface la session de test et le cache de synchronisation du profil, puis déconnecte Supabase. Cette fonction ne purge pas elle-même les données scoring/publication. Vérifier l'ensemble du cycle de déconnexion et isoler les caches par identité sans supprimer les données opérationnelles hors ligne du scribe.
- Les étapes validation, synchronisation HSP, publication scoresheet et publication des groupes de résultats restent distinctes. Préparer une publication cohérente et un événement serveur unique/versionné pour les alertes, avec reprise après échec.
- Un show peut contenir plusieurs classes concurrentes dans un bloc. Le futur statut « officiel gratuit » doit suivre la bonne unité de validation; ne pas rendre tout un bloc public si seule une classe doit l'être.

## Prochaine tranche

L'audit initial et la vérification des permissions PREPROD suffisent pour préparer l'implémentation. Avant toute ouverture payante :

1. Figer le contrat des projections progression gratuite / score live payant / résultats officiels gratuits, ainsi que l'autorisation TV/OBS.
2. Préparer dans HSP la migration du modèle de droits et des politiques cumulatives, avec protection des scans, sans l'appliquer en production.
3. Ajouter des tests négatifs d'autorisation puis les exécuter en PREPROD avec jeux de données de test : sans pass, mauvais show/saison, mode sans scores, documents non publiés, broadcast et repli.
4. Vérifier ensuite le vrai déploiement PREPROD (références de build, auth et caches), puis implémenter le paiement distinct en sandbox.

La configuration du déploiement web, les tests HTTP par profil, les parcours TV et les essais téléphones restent non vérifiés à ce stade. Aucun besoin de changer Stripe réel ou PROD pour poursuivre cette tranche.

Référence technique consultée : [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). L'index Markdown du changelog n'a pas pu être lu par l'outil web; vérifier les changements pertinents avant toute implémentation Supabase.
