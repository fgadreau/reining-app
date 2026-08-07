# Améliorations à reprendre après le show

Dernière mise à jour : 30 juillet 2026.

## Priorité 1 — Observabilité et protection de Supabase

- Brancher les métriques Supabase privilégiées à Grafana ou un collecteur
  Prometheus pour conserver l'historique CPU, mémoire, IOPS, connexions et WAL.
- Ajouter des alertes sur le CPU soutenu, la saturation des connexions, les
  erreurs REST/Realtime et une hausse anormale du nombre de requêtes par minute.
- Créer un tableau de bord ShowScore comparant le trafic REST, les connexions
  Realtime et les erreurs avant et après chaque déploiement.
- Automatiser un test de charge réaliste avec les vues annonceur, TV,
  livestream, overlay et résultats ouvertes simultanément.
- Définir un budget de requêtes par vue publique et un seuil de régression dans
  les tests.

## Priorité 2 — Réduire encore la charge des vues live

- Mesurer et réduire le niveau de base encore observé sur l'API REST lorsque
  plusieurs vues publiques restent ouvertes.
- Étudier un résumé public servi par une RPC ou une vue matérialisée légère afin
  d'éviter de relire toutes les tables à chaque rafraîchissement.
- Conserver les lectures groupées par table et interdire les retours aux
  requêtes par journée ou par classe.
- Ajouter du jitter et un backoff au rafraîchissement de secours pour éviter que
  tous les écrans interrogent Supabase en même temps.
- Suspendre toutes les lectures de secours quand un onglet est masqué et
  reprendre avec une seule lecture au retour.
- Documenter explicitement les tables publiées dans Realtime et tester que les
  abonnements ne ciblent jamais une table absente de la publication.
- Surveiller les états `CHANNEL_ERROR`, `TIMED_OUT` et `CLOSED`, puis réabonner
  proprement avec backoff.

## Priorité 3 — RLS et structure de la base

- Réviser les avertissements du conseiller Supabase :
  - 167 cas de politiques permissives multiples;
  - 20 cas `auth_rls_initplan`;
  - 1 index dupliqué.
- Fusionner les politiques RLS qui font plusieurs évaluations équivalentes par
  requête.
- Remplacer les appels directs répétés à `auth.uid()` et fonctions semblables
  par des sous-requêtes stables lorsque recommandé par Supabase.
- Examiner les clés étrangères non indexées avant d'ajouter des index; valider
  chaque ajout avec les requêtes réellement utilisées.
- Nettoyer seulement les index inutilisés confirmés après une période
  représentative, sans retirer les index ShowScore actuellement très utilisés.

## Priorité 4 — Robustesse des imports de draws

- Conserver un test de régression pour les cellules PDF Funware qui fusionnent
  numéro et association, par exemple `2400DA NRHA`.
- Ajouter à l'aperçu d'import la liste des divisions reconnues, ignorées et
  absentes avant de permettre la sauvegarde.
- Bloquer ou demander une confirmation lorsqu'un code inscrit sur un passage
  n'existe pas dans les divisions détectées.
- Afficher le nombre de passages, les draws manquants ou dupliqués et les
  identités modifiées lors d'un réimport.
- Préserver systématiquement les identifiants des passages inchangés afin de ne
  pas rompre un pointage ou un live existant.
- Ajouter des fixtures anonymisées couvrant les coupures de codes sur plusieurs
  lignes (`NPLT` + `É`, `MA` + `STNP`, `NP4-` + `4A`).

## Validation de référence du 30 juillet

- Incident : moyenne de 85 852 requêtes REST par heure, pointe à 119 368.
- Après correctifs : réduction de 98,1 % pendant la nuit et de 85 % durant
  l'utilisation du matin.
- État vérifié : services Supabase sains, aucune requête bloquée, aucun
  pointage anormalement long, cache tables/index à 100 %.
- Draw Derby Non-pro : 46 passages dans l'ordre 1 à 46, 13 divisions, aucun code
  de division orphelin.
