# Reprise — pass live ShowScore

État à la fermeture de la session du 26 octobre 2026 (heure de Toronto).

## Où reprendre

- Dépôt : `fgadreau/reining-app`.
- Branche de travail : `docs/showscore-pass-preprod-audit`.
- PR ouverte vers `preprod` : [#83](https://github.com/fgadreau/reining-app/pull/83).
- Ancienne PR [#82](https://github.com/fgadreau/reining-app/pull/82) fermée sans fusion, car elle ciblait `main`.
- Les documents de cette branche sont sur GitHub; ils ne sont pas encore fusionnés dans `preprod` ou `main` à cet instant. Sur un autre appareil, récupérer cette branche ou la PR #83.
- Aucun code applicatif, permission distante, migration, paiement ou déploiement modifié. Audit et spécification uniquement.

## Documents de référence

1. [Spécification et décisions produit](showscore-live-pass-specification.md) : prix, périmètres, contenus gratuits/payants, Stripe distinct, notifications, clauses et remboursements.
2. [Audit des accès et publications](showscore-live-pass-access-audit.md) : sources inspectées, permissions PREPROD réellement lues, constats prioritaires, limites de l'audit et scénarios de vérification.
3. [Environnements](deployment.md) et [promotion en production](production-promotion.md) : procédure existante à respecter.

## Décisions à préserver

- AQR uniquement au lancement; pass show 12 CAD + taxes; pass saison initial envisagé 50 CAD + taxes, pour une association et une saison.
- Prix saison dégressif selon les shows restants, grille finale à adapter au calendrier AQR. Aucun crédit des pass show antérieurs. L'exemple à six shows n'est pas un calendrier confirmé.
- Compte SS gratuit. Les frais HSP de 5 $ + taxes appartiennent aux factures HSP, sans lien avec le paiement SS.
- Circuit SS distinct et simple, encaissé par HSP via Stripe, sans renouvellement automatique.
- Programme/draw/progression gratuits; données live provisoires et toutes les notifications payantes; résultats officiels et scoresheets gratuits ensemble à leur publication.
- Suivis de cavaliers sans limite produit au lancement. Notifications draw publié, résultats publiés et approche du passage avec seuil modifiable.
- Web app installable iPhone/Android envisagée; aucune notification push déjà implémentée ou validée.
- Résultats provisoires clairement identifiés; résultats officiels prioritaires. Clauses proposées sous réserve des droits légaux, à valider avant publication.
- Commencer exclusivement sur PREPROD avec Stripe sandbox. Aucun changement en production pour cette phase.
- GitHub reste la référence; vérifier, commiter et pousser les blocs terminés.

## Constats déjà établis

- Les lectures des sessions live et les flux temps réel actuels ne contrôlent pas de pass.
- PREPROD confirme des politiques publiques cumulatives trop larges, notamment un ancien accès aux résultats officiels limité au seul critère show public.
- Le mode `live_no_score` autorise encore côté serveur les sessions scoring/juges; le masquage intervient dans le client.
- Le canal broadcast « privé » est autorisé aux visiteurs du show public; son repli Postgres Changes doit être protégé aussi.
- Le bucket de scans `class-scoresheets` est public, indépendamment du contrôle des métadonnées du document.
- TV, OBS et pages publiques réutilisent les mêmes données. L'accès aux affichages doit être distingué des pass personnels.
- Résultats et scoresheets suivent plusieurs opérations/publications; vérifier la cohérence pour les classes concurrentes et les reprises après échec.
- Les replis locaux et le changement d'identité doivent être revus pour éviter de réafficher des données retenues par le serveur.
- Le Stripe HSP examiné et le compte disponible dans le connecteur sont en test. Cela ne démontre pas l'absence d'un autre compte réel; aucune configuration fiscale réelle n'a été validée.

Le détail des preuves et des nuances figure dans l'audit; ne pas convertir un risque de cache ou de parcours en incident confirmé sans test.

## Vérifications ciblées restantes avant implémentation

1. TV/OBS : tracer les routes, codes courts, relais locaux et éventuels accès partagés; définir une autorisation d'affichage sans contournement des pass. Ne pas casser le fonctionnement hors ligne des postes opérationnels.
2. Publication : retracer les actions de l'interface jusqu'aux écritures HSP/SS, les erreurs intermédiaires, les classes concurrentes et la fermeture/archivage du show. Définir l'instant unique où résultats et scoresheets deviennent gratuits et où une notification peut partir.
3. Site PREPROD : vérifier la configuration réellement déployée, les références de build, l'authentification et les caches. La cible SQL PREPROD a été identifiée et lue, mais cela ne prouve pas le raccordement du site web.

Après ces contrôles, passer aux protections et aux tests; ne pas prolonger indéfiniment l'audit sans nouvelle question concrète. Les futurs droits payants ne pourront être validés que par des tests d'accès positifs et négatifs après leur implémentation.

## Ordre de réalisation à conserver

1. Projections serveur progression gratuite / live payant / officiel gratuit et accès TV.
2. Modèle de droits et nettoyage des politiques cumulatives dans une nouvelle migration canonique HSP; protection des fichiers.
3. Tests PREPROD visiteur, compte sans pass, pass valide/invalide, équipe et TV, incluant requêtes directes et temps réel.
4. Paiements SS en sandbox, activation serveur idempotente, taxes vérifiées, reçus et incidents.
5. Interface publique et pass, suivis et notifications, essais réels iPhone/Android.
6. Validation AQR, politique finale, fiscalité et Stripe production avant toute promotion contrôlée.

Le dépôt HSP voisin possède la chaîne canonique de migrations partagées. Ne pas exécuter les SQL historiques standalone SS sur la base commune et ne pas modifier des migrations historiques pour corriger les permissions.

## Limites et informations manquantes

Aucun test HTTP par profil, achat sandbox complet, essai de notification, essai TV ou déploiement n'a été effectué dans cette session. Aucun constat de cet audit n'atteste l'état de PROD. Les lectures distantes étaient limitées aux catalogues et permissions PREPROD, sans extraction de données nominatives ou téléchargement de scoresheets.

Restent à confirmer avant la vente : calendrier/grille AQR, champs live autorisés à la diffusion, identité légale du vendeur, inscriptions fiscales, adresse de soutien et politique finale de reports/annulations/remboursements. Les textes juridiques sont des propositions, pas une validation professionnelle.
