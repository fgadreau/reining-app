# Audit initial — accès publics et pass ShowScore

Date : 26 octobre 2026. Périmètre : examen statique des dépôts locaux SS et HSP. Aucune base distante interrogée ou modifiée, aucun déploiement ni paiement effectué. Les règles réellement déployées en PREPROD restent à comparer à ces sources.

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

## Prochaine tranche

Vérifier en lecture seule la configuration PREPROD réelle et figer le contrat de projection publique/payante ainsi que l'autorisation TV. Ensuite seulement, préparer dans HSP le modèle de droits et les protections serveur, avec tests d'autorisation négatifs avant les modifications d'interface et de paiement.

Référence technique consultée : [Supabase — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). L'index Markdown du changelog n'a pas pu être lu par l'outil web; vérifier les changements pertinents avant toute implémentation Supabase.
