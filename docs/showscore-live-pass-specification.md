# ShowScore — spécification des pass live

Date : 26 octobre 2026.

Statut : décisions produit approuvées; document de référence pour l'implémentation. Aucun paiement réel ni contrôle d'accès payant n'est activé par ce document.

## Objectif et périmètre

Lancer les pass live pour l'AQR. Une association paie séparément son accès saison aux outils HSP et ShowScore destinés à la gestion et au déroulement du concours. Les utilisateurs publics peuvent acheter un pass SS pour suivre les données provisoires et recevoir des notifications.

GitHub est la référence pour le code et les décisions. Chaque bloc de travail terminé doit être vérifié, commité et poussé afin de pouvoir poursuivre sur un autre appareil ou dans Codex Cloud. Ne jamais versionner de secrets.

## Accès et publication

| Accès | Données et fonctions |
| --- | --- |
| Public gratuit, sans compte | Programme, ordre de passage publié, concurrent dans le pen, prochains passages, progression du show, résultats officiels et scoresheets après publication officielle de la classe |
| Pass show | Données live payantes du concours acheté : pointages provisoires publiables, standings provisoires et notifications |
| Pass saison | Mêmes fonctions pour les concours couverts d'une association et d'une saison précises |
| Équipe autorisée et TV | Accès opérationnel selon les rôles de l'association, sans achat d'un pass public |

Le pass ne permet pas de consulter les brouillons privés du scribe ou des données dont la diffusion n'a pas été autorisée. Définir explicitement l'état « publiable en live » avant le branchement des vues payantes.

La publication officielle est explicite, autorisée par la direction du concours ou le secrétariat habilité, et effectuée par classe. Elle rend gratuitement accessibles les résultats et les scoresheets correspondants. Ne pas attendre la fin du concours entier. Les résultats finaux ont toujours préséance sur les données provisoires.

Les visiteurs voient les emplacements des contenus payants avec des valeurs masquées et un cadenas, ainsi qu'une invitation à se connecter et acheter un pass. Les vraies valeurs protégées ne sont jamais envoyées à un client sans droit d'accès : protéger aussi les API, les abonnements temps réel, les exports et les caches. Le masquage visuel seul n'est pas une protection.

## Comptes et pass

- Création du compte gratuite; compte requis pour acheter et utiliser un pass.
- Réutiliser l'identité HSP/SS après vérification du parcours public existant.
- Un pass appartient à l'utilisateur acheteur et se retrouve sur ses autres appareils après connexion.
- Pass show limité à un concours; pass saison limité à une association et une saison.
- AQR uniquement au lancement; aucun pass universel à implémenter maintenant.
- Les droits de consultation, les rôles opérationnels et les abonnements de notification sont des concepts distincts.

## Prix et saison

Tous les montants sont en CAD, plus taxes applicables. Achats ponctuels, sans renouvellement automatique.

- Pass show : 12 $ + taxes.
- Pass saison initial envisagé : 50 $ + taxes.
- Le prix saison baisse après chaque show selon une grille fixée avant la saison; baisse plus forte au début et plus petite ensuite.
- Les achats de pass show ne sont pas crédités sur un achat saison.
- Présenter côte à côte le pass show et le pass saison au tarif courant, avec les concours inclus.
- Ne pas vendre un pass show déjà couvert par le pass saison de l'utilisateur ni facturer deux fois le même pass.
- Ne pas présenter un cinquième pass show « à 2 $ » : la proposition antérieure de crédit cumulatif est abandonnée.

Exemple approuvé dans son principe, à adapter au calendrier AQR réel :

| Saison illustrative de six shows | Pass show | Reste de saison |
| --- | --- | --- |
| Avant ou pendant le show 1 | 12 $ | 50 $ |
| Après le show 1 | 12 $ | 40 $ |
| Après le show 2 | 12 $ | 32 $ |
| Après le show 3 | 12 $ | 26 $ |
| Après le show 4 | 12 $ | 22 $ |
| Dernier show seulement | 12 $ | Option saison retirée |

Cette grille est illustrative, pas une tarification de production. Le serveur détermine le tarif et les shows couverts; conserver un instantané de ces informations lors de l'achat. Définir avant lancement le traitement des reports, annulations et ajouts au calendrier.

## Circuit de paiement SS

HSP encaisse les paiements via Stripe. Le circuit SS reste distinct des factures HSP et des paiements destinés aux associations : commande SS, paiement, reçu et activation du pass. Aucun partage de paiement avec l'association n'est demandé pour ces achats.

Les frais d'utilisation HSP de 5 $ + taxes sont ajoutés aux factures HSP concernées. Ils ne sont ni des frais de création de compte SS, ni un préalable à l'achat d'un pass, ni une ligne à ajouter au paiement SS.

Parcours : contenu verrouillé → connexion/création du compte → choix et récapitulatif du pass → acceptation des conditions → paiement → retour au contenu débloqué.

Exigences :

- Prix, taxes, total, association, concours/saison et contenu clairement indiqués avant paiement.
- Confirmation serveur authentifiée et idempotente; ne jamais activer uniquement depuis la page de retour du paiement.
- Gérer confirmation retardée, fermeture du navigateur, reprises, doublons et remboursements.
- Conserver commande, identifiant de paiement, identité acheteuse, droits accordés, prix et version des conditions acceptées.
- Page « Mes pass », reçu conservable et lien de soutien.
- Vérifier la configuration fiscale et les inscriptions actives avant de collecter les taxes.

### Constat de l'examen Stripe HSP

Examen local du 26 octobre 2026 : `server/billing/stripe.mjs` contient un circuit de PaymentIntents, des webhooks signés, des clés d'idempotence, un rapprochement et des paiements Connect avec frais HSP. Ce code refuse explicitement le mode réel. Il détecte des remboursements/contestations externes, sans constituer un parcours de remboursement des pass SS.

Le connecteur de cette session expose uniquement « Gadreau Development sandbox », en mode test. Cela ne prouve ni l'absence d'un compte réel ailleurs ni la configuration de production de HSP. Ne pas présenter les paiements réels ou les taxes comme déjà prêts.

## Suivis et notifications payantes

Suivi de plusieurs cavaliers sans limite produit au lancement. Prévoir des protections techniques contre les abus sans imposer une limite commerciale arbitraire.

| Événement | Comportement |
| --- | --- |
| Draw publié contenant un cavalier suivi | Alerter avec la classe et l'ordre de passage disponibles |
| Résultats publiés pour un cavalier suivi | Alerter et ouvrir les résultats officiels |
| Approche d'un passage | Alerter lorsqu'il reste le nombre de passages choisi par l'utilisateur avant le cavalier suivi |

Toutes ces notifications sont réservées aux pass couvrant le concours, même lorsque leur destination est un résultat désormais gratuit. Le seuil est modifiable par l'utilisateur. Le réglage par cavalier reste un choix d'interface à préciser.

Compter les passages réellement restants selon l'ordre opérationnel, en tenant compte des scratches et changements de draw. Identifier chaque passage, y compris lorsqu'un cavalier monte plusieurs chevaux. Définir le franchissement du seuil, les changements de réglage, les pauses et les réordonnancements pour éviter les doublons ou alertes tardives trompeuses. Une correction ne doit pas relancer indéfiniment la même alerte.

Page prévue : « Mes suivis et alertes », avec favoris, types d'alertes, seuil, état des permissions sur cet appareil, activation et notification de test.

Approche de lancement : notifications Web Push dans la web app installable, avec validation sur vrais iPhone et Android. Sur iPhone compatible, installation sur l'écran d'accueil et autorisation déclenchée par une action de l'utilisateur sont nécessaires. Ne pas promettre une livraison instantanée ou garantie. Les alertes ne remplacent pas les annonces officielles.

Au moment de l'audit, le dépôt SS possède l'enregistrement d'un service worker, mais aucune demande de permission ni abonnement Web Push n'a été trouvé dans le code examiné. L'installation actuelle seule n'active donc pas les notifications.

## Annulation, remboursement et information précontractuelle

Orientation approuvée : informer clairement des dépendances au réseau, aux appareils et à la saisie de l'association, sans renoncer aux droits impératifs des consommateurs.

### Base de clause à faire valider juridiquement

> L'accès aux données en direct dépend de la connexion Internet de l'utilisateur et du site du concours, des réglages de son appareil ainsi que de la saisie et de la publication des données par l'association organisatrice. Les notifications constituent une aide au suivi et ne remplacent pas les annonces officielles du concours.
>
> Sous réserve des droits prévus par la loi, aucun remboursement n'est accordé pour les difficultés de connexion propres à l'utilisateur, ses réglages d'appareil ou de notifications, ni pour les retards ou erreurs ponctuels de saisie ou de publication de l'association. Toute absence substantielle du service acheté fait l'objet d'un examen distinct.
>
> Les pointages et classements accessibles en direct avec un pass ShowScore sont provisoires et n'ont pas encore été validés par la direction du concours. Ils peuvent être corrigés et différer des résultats officiels finaux. Les résultats officiels publiés après validation par la direction du concours ont toujours préséance. Sous réserve des droits prévus par la loi, une différence entre les données provisoires et les résultats officiels ne constitue pas, à elle seule, un motif de remboursement.

Afficher « Provisoire — en attente de validation » sur les données concernées. Présenter les limites importantes avant paiement, conserver la version acceptée et transmettre les conditions avec la confirmation d'achat.

Règles opérationnelles proposées, à finaliser avant mise en vente :

- Pas de remboursement volontaire pour changement d'idée, absence ou retrait du cavalier suivi après activation, sous réserve de la loi.
- Rembourser un double paiement confirmé.
- Corriger l'accès non livré; rembourser si la prestation ne peut être fournie.
- Rembourser le pass show lorsque le concours est annulé sans prestation live.
- En cas de report, maintenir l'accès pour la nouvelle date et traiter les demandes selon les droits applicables.
- Définir une règle explicite de remboursement partiel du pass saison si des concours inclus sont annulés; conserver leur liste lors de l'achat.
- Suspendre les ventes lorsqu'une indisponibilité substantielle du live est connue.

Ne pas publier une exonération absolue : l'article 10 de la Loi sur la protection du consommateur interdit certaines clauses dégageant le commerçant des conséquences de ses actes ou de ceux de son représentant. Le rôle contractuel de l'association et les recours pour service non fourni doivent être examinés.

Références : [Loi sur la protection du consommateur](https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-40.1), notamment articles 10 et 54.4 à 54.16; [commerce en ligne — OPC](https://www.opc.gouv.qc.ca/enligne/); [Web Push sur iOS — WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); [installation Android — Google](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid).

## Plan d'implémentation

1. Auditer les accès publics et états de publication existants, les identités, le temps réel et les vues TV. Produire la matrice des données gratuites, provisoires payantes et privées.
2. Concevoir commandes SS, grille tarifaire, droits et publications officielles. Les changements du schéma partagé doivent suivre l'historique de migrations HSP, référence existante de la base commune; coordonner les changements dans les deux dépôts.
3. Implémenter et vérifier les protections serveur, y compris abonnements live et absence de fuite par caches, avant d'afficher les verrous commerciaux.
4. Construire le circuit Stripe SS en sandbox : commandes, taxes vérifiées, confirmation serveur, pass, reçus et gestion des incidents.
5. Adapter les pages publiques, le choix des pass et « Mes pass »; rendre résultats et scoresheets gratuits à la publication officielle par classe.
6. Ajouter favoris, événements de notification, seuil de passages, déduplication et abonnements par appareil; tester sur vrais téléphones.
7. Valider le parcours complet avec l'AQR, finaliser conditions, calendrier, fiscalité et production Stripe avant mise en vente.

Chaque étape doit aboutir à des changements vérifiés, commités et poussés. Éviter de livrer des fonctionnalités annoncées mais indisponibles.

## Vérifications d'acceptation

- Un visiteur accède aux informations gratuites sans compte et ne peut récupérer de données payantes par requête directe ou temps réel.
- Un pass show ne débloque qu'un concours; un pass saison ne débloque que les concours de son périmètre association/saison.
- Les postes opérationnels et TV conservent leurs accès autorisés indépendamment des pass publics.
- Prix et couverture affichés concordent avec le calcul serveur, même au changement de tarif saison.
- Deux confirmations de paiement ne créent pas deux droits ou deux commandes facturées; une fermeture du navigateur n'empêche pas l'activation après paiement confirmé.
- Résultats et scoresheets d'une classe deviennent gratuits ensemble après validation officielle; les autres classes restent dans leur état propre.
- Les notifications ne partent que pour les suivis et pass admissibles; scratches, passages multiples et réordonnancements ne créent pas de doublons.
- Achat, accès sur un autre appareil, permissions push, remboursement et révocation du droit correspondant sont vérifiés de bout en bout.

## Informations restant à confirmer

- Calendrier et identité de la saison AQR; grille finale et règles de changement du tarif.
- Liste précise des champs publiables avant validation officielle et rôles autorisés à les publier.
- Identité légale du vendeur HSP, inscriptions fiscales, compte Stripe réel et adresse de soutien.
- Politique finale pour reports, annulations, interruptions substantielles et remboursements du pass saison.
- Validation juridique des conditions avant publication.

## Ampleur indicative

Estimation de planification, non engagement de délai : 2 à 4 semaines pour un premier circuit payant vérifié; environ 4 à 8 jours supplémentaires pour favoris et notifications complètes. À réestimer après l'audit des données publiques, des états de publication et de l'intégration existante. Les essais iPhone/Android et la préparation juridique/fiscale peuvent modifier le calendrier.
