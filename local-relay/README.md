# Relais réseau local ShowScore

Ce dossier est le programme autonome qui sert les pages OBS et TV sur le réseau local. Il conserve le dernier snapshot reçu et la vidéo MP4 de compétition même lorsque l’accès Internet coupe.

## Mise à jour du Chromebook déjà configuré

Dans le terminal Linux du Chromebook, exécutez une seule commande :

```bash
curl -fsSL https://raw.githubusercontent.com/fgadreau/reining-app/main/local-relay/update-relay.sh | bash
```

La commande télécharge la version publiée sur `main`, conserve le dossier `~/local-relay/data` ainsi que l’adresse réseau déjà configurée, réinstalle le lanceur ChromeOS et redémarre le service. La page `http://127.0.0.1:9875/` doit ensuite afficher la version `0.2.2` ou une version plus récente.

## Première installation

Pour une première installation, ajoutez l’adresse IPv4 du Chromebook à la même commande :

```bash
curl -fsSL https://raw.githubusercontent.com/fgadreau/reining-app/main/local-relay/update-relay.sh | bash -s -- 192.168.50.10
```

Utilisez l’adresse Wi-Fi ou Ethernet affichée dans ChromeOS, jamais l’adresse Linux `100.115.x.x`. Activez aussi le transfert du port TCP `9875` dans les paramètres de l’environnement Linux de ChromeOS.

L’installation ajoute **ShowScore – Relais local** aux applications Linux. Cette icône démarre le relais, attend qu’il réponde puis ouvre sa page d’état. Node.js `20.19.x` ou `22.13+`, npm et `curl` doivent être installés.

## Adresses utiles

- Tableau du relais : `http://127.0.0.1:9875/`
- État JSON : `http://127.0.0.1:9875/api/status`
- État du cache MP4 : `http://127.0.0.1:9875/api/video-status`
- Producteur ShowScore : `ws://127.0.0.1:9875/ws/producer`
- OBS : `http://ADRESSE_DU_RELAIS:9875/overlay`
- TV : `http://ADRESSE_DU_RELAIS:9875/tv`

Le code de jumelage, le dernier snapshot et le cache MP4 se trouvent dans `~/local-relay/data`. La mise à jour ne supprime jamais ce dossier.

## Windows

Le paquet Windows contient `Demarrer-ShowScore-Relais-Windows.cmd`. Un double-clic détecte automatiquement l’adresse IPv4 du PC, démarre le relais sur le port `9875` et affiche les adresses à utiliser dans ShowScore, OBS et les téléviseurs. Si le pare-feu Windows le demande, autorisez Node.js sur les réseaux privés.

## Démarrage manuel

```bash
cd ~/local-relay
./start-relay.sh 192.168.50.10
```

Le terminal doit alors rester ouvert. L’arrêt volontaire du service installé se fait avec :

```bash
systemctl --user stop showscore-relay.service
```

## Vérification avant un show

1. Ouvrez l’icône **ShowScore – Relais local**.
2. Confirmez la version et l’état **Vidéo MP4 locale · Prête** sur la page du relais.
3. Connectez le tableau annonceur et ouvrez les liens TV/OBS réellement utilisés.
4. Coupez seulement le WAN, changez le concurrent ou le score et confirmez la mise à jour locale.
5. Rétablissez Internet et vérifiez que la synchronisation cloud reprend.
