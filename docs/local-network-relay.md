# Relais réseau local ShowScore

Le relais tourne dans Linux sur le Chromebook de l’annonceur. ShowScore continue d’enregistrer localement et de synchroniser avec Supabase comme avant; en parallèle, il envoie un petit instantané d’affichage au relais. OBS lit cet instantané directement sur le réseau local.

Le logiciel ne coûte rien. Il faut seulement le Chromebook, le routeur et les câbles réseau déjà prévus.

## Installation sur le Chromebook

1. Active l’environnement Linux dans les paramètres ChromeOS.
2. Installe Node.js 20.19 ou une version compatible plus récente et copie le projet ShowScore sur le Chromebook.
3. Dans un terminal Linux, place-toi dans le projet puis exécute :

   ```bash
   cd local-relay
   npm ci --omit=dev
   chmod +x start-relay.sh
   ```

4. Dans **Paramètres ChromeOS → Développeurs → Environnement de développement Linux → Transfert de ports**, ajoute le port TCP `9874` et active-le.
5. Trouve l’adresse IPv4 du Chromebook dans les détails du réseau ChromeOS. Par exemple : `192.168.50.10`.

## Démarrage avant un show

Dans Linux, démarre le relais en lui donnant l’adresse du Chromebook :

```bash
cd local-relay
./start-relay.sh 192.168.50.10
```

Le terminal affiche un code de jumelage à six chiffres et les adresses OBS. Laisse ce terminal ouvert pendant le show.

Dans le tableau de l’annonceur :

1. Ouvre **Relais réseau local**.
2. Garde `ws://127.0.0.1:9874/ws/producer` comme adresse.
3. Entre le code à six chiffres affiché dans le terminal et clique **Configurer**.
4. Autorise l’accès au réseau local si Chrome le demande.
5. Vérifie que **Relais local** indique « Connecté ».

Sur le Mac du vidéographe, ajoute une source **Navigateur** dans OBS :

- URL : `http://ADRESSE_DU_CHROMEBOOK:9874/overlay`
- largeur : `1920`
- hauteur : `1080`

Pour limiter l’affichage à un manège, ajoute le paramètre `arena`, par exemple :

```text
http://192.168.50.10:9874/overlay?arena=Manège%201
```

Le nombre **Écrans OBS connectés** passe à `1` quand la source OBS est ouverte. Pendant un drag actif, l’overlay affiche « Drag en cours » et les commanditaires occupent toute la page. Il revient automatiquement aux concurrents lorsque le drag se termine.

## Écrans TV locaux

Après la première transmission de ShowScore, le panneau du relais affiche automatiquement les liens correspondant aux manèges détectés :

- **Vue générale** : `http://ADRESSE_DU_CHROMEBOOK:9874/tv`
- **Vue d’un manège** : `http://ADRESSE_DU_CHROMEBOOK:9874/tv?arena=Manège%201`
- **Vue compétition d’un manège** : `http://ADRESSE_DU_CHROMEBOOK:9874/tv?arena=Manège%201&mode=competition`
- **Classements du bloc actif** : `http://ADRESSE_DU_CHROMEBOOK:9874/tv?arena=Manège%201&mode=standings`

Chaque téléviseur peut ouvrir son propre lien dans Chrome. Les vues restent à jour et se reconnectent automatiquement sans Internet. La vue générale conserve l’accueil, la pause bilingue, le cavalier en piste, les prochains concurrents, les derniers pointages, les paid warm-ups, les drags, les chronos et la rotation des commanditaires.

La vue Classement fait défiler automatiquement chaque classe ou division du bloc actif. Une classe de plus de sept concurrents classés est séparée en plusieurs pages. Les positions, cavaliers, chevaux, dossards et scores suivent les corrections transmises par l’annonceur.

La vue compétition locale conserve la bande d’information en direct et l’identité du manège. Dès que le tableau annonceur transmet sa configuration, le relais télécharge la vidéo MP4 de compétition dans son cache local. La première préparation doit donc se faire avec Internet; une fois le téléchargement terminé, la vidéo continue de jouer et peut être rechargée sans Internet. Son état est visible à `http://ADRESSE_DU_CHROMEBOOK:9874/api/video-status`. La télévision du livestream YouTube nécessite toujours Internet puisque sa source vidéo est externe.

## Vérification hors ligne

Avant le show, fais ce test avec les deux ordinateurs branchés au routeur :

1. Entre un concurrent et un pointage; OBS doit se mettre à jour.
2. Démarre un drag; les commanditaires doivent prendre tout l’écran.
3. Débranche le câble WAN du routeur, sans couper le réseau local.
4. Change le concurrent et corrige un pointage; OBS doit continuer à suivre.
5. Actualise la source OBS; le dernier état doit réapparaître.
6. Rebranche le WAN; les changements en attente doivent se synchroniser avec Supabase.

Si le Mac ne rejoint pas le relais, vérifie le transfert du port `9874`, le pare-feu, l’adresse IP ChromeOS et l’option d’isolation des clients du routeur. L’adresse Linux affichée en `100.115.x.x` n’est généralement pas celle à utiliser depuis le Mac.

## Limites de cette première version

- L’overlay OBS et les vues TV générales, par manège et compétition sont disponibles localement.
- Le relais garde une copie locale de la vidéo MP4 de compétition après sa première synchronisation.
- Le site public et la vidéo YouTube continuent de dépendre d’Internet.
- Le relais ne contient aucune clé Supabase et ne lit jamais le stockage du navigateur.
- Les logos nécessaires à l’overlay sont inclus dans chaque instantané; l’overlay ne charge aucune ressource Internet.
