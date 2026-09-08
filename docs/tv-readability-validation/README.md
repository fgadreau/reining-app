# Lisibilité TV et signature ShowScore

Base : `origin/preprod`, `7eceed401029fdf7cae33908a5a651b205fb5dc2`. Branche : `fix/tv-readability-signature`. Aucune donnée cloud utilisée ou modifiée. Aucun déploiement : l’intégration Git Vercel est désactivée pour cette branche uniquement.

## Changements

- Le bandeau d’environnement est placé dans le routeur et suit `useLocation`. Sur les routes TV, raccourcis TV, diffusion livestream et overlays, seul le bandeau informatif est masqué. Une erreur de configuration reste affichée, même en production, sur toutes les routes. Le retour en gestion rétablit le bandeau sans rechargement.
- La carte d’accueil TV en attente mesure son contenu et sa place disponible. Si le contenu dépasse, elle cherche la plus grande taille qui tient, en adaptant les deux titres, les espacements et le padding, avec une marge intérieure conservée. Aucun changement lorsque le contenu tient naturellement. `ResizeObserver` et l’attente des polices recalculent cet ajustement ; un redimensionnement plus grand retrouve les tailles naturelles. Les noms complets, le logo et le message bilingue restent présents.
- La largeur de l’en-tête et sa zone texte sont contraintes. Le titre utilise son ellipse existante ; le QR garde sa taille, entièrement dans le viewport.
- La signature remplace exclusivement le texte ShowScore déjà présent dans le rail **sans commanditaires**. Aucun nouveau créneau n’est prélevé sur les partenaires. Le fichier SVG approuvé FR/EN est utilisé sans modification de tracé, de vue ou de proportion ; un filtre CSS le rend monochrome blanc, avec opacité 0,8. Largeur 116 px (environ 32 px de haut), 80 px sous 820 px de hauteur. Le logo d’association reste prioritaire, nettement plus grand.

## Présence de la signature

| Mode | Présence |
| --- | --- |
| Attente, live général, classement, pause | Logo secondaire à la place du texte ShowScore de repli, uniquement si le rail n’affiche pas de commanditaires. |
| Rail avec partenaires | Absente : toute la place est conservée aux commanditaires. |
| Compétition vidéo et compétition en chargement | Absente : aucun ajout sur la vidéo ou le bandeau des participants. |
| Diffusion livestream et overlays | Aucun nouveau logo : leurs emplacements utiles restent inchangés. Le bandeau informatif d’environnement y est néanmoins masqué. |

Les paires « sans signature » de l’archive masquent l’image dans le navigateur sans redistribuer l’espace, afin de juger son emplacement. Ce n’est pas un nouveau paramètre utilisateur. Les captures « avant » proviennent de la base exacte avant correction. Les vues vidéo avec/sans signature sont identiques par choix.

## Validation

- Quatre combinaisons d’attente : noms courts/longs × 1440×900/1920×1080, puis redimensionnement vers l’autre format et retour. Le test vérifie que tous les enfants visibles tiennent dans la carte, que le message EN existe, que le logo reste visible et que le QR tient en largeur. Le cas court Full HD n’active pas l’ajustement.
- Test live : Cavalier 3 et score 217½ présents avec la signature secondaire.
- Deux tests du bandeau : navigation SPA aller/retour gestion/TV pour toutes les familles de routes et maintien de l’alerte bloquante en configuration de production sans libellé informatif.
- Six tests E2E de protection : classement, prochaine classe, Fire Stick 960×540, vidéo avec participants et score, commanditaires par niveaux, disposition approuvée vidéo 480×270. Tous réussis.
- Contrôles requis : `npm test -- --maxWorkers=2` : **272 tests réussis, 13 fichiers** ; `npm run build` : **réussi**. Les cinq nouveaux E2E passent également. Journaux joints au ZIP. L’avertissement préexistant de bundle >500 ko demeure.

Les mesures comparatives de l’archive portent sur l’en-tête, le QR, la zone live, le rail commanditaires, la vidéo et les titres. Les zones live et vidéo et les tailles du QR sont conservées dans les cas comparés. Le cas court 1920×1080 conserve sa géométrie naturelle. En 1440×900 avec nom long, la largeur auparavant hors écran est corrigée ; le rail revient également à la largeur du viewport, sans diminuer son espace visible.

## Captures

La galerie `index.html` du ZIP contient les captures avant/après des quatre cartes d’attente et des modes live 1920×1080, live 960×540, compétition vidéo 480×270 ; des paires supplémentaires couvrent classement, prochaine classe, pause et vidéo à 1440×900. Elle comprend les mesures `geometry.json`, le protocole de capture, les logs et le diff complet avec SHA exacts.

## Limites

Les minima du mécanisme de lisibilité sont de 34 px pour le titre et 24 px pour le sous-titre (ou la taille naturelle si elle est plus petite). Des textes démesurés peuvent dépasser la capacité physique de la carte malgré ces limites ; les jeux longs validés figurent dans les captures. La lisibilité à distance sur une TV physique reste à apprécier visuellement. La mention Par HSP/By HSP est fine à la taille secondaire choisie ; le symbole et le mot ShowScore restent reconnaissables.

Chromium et données fictives uniquement. La concurrence Supabase et le décodage d’une vraie vidéo ne sont pas validés par ces contrôles. Les six scénarios de la PR #70 restent résolus dans leur suite locale ; aucune nouvelle affirmation de validation cloud n’est faite. Aucun score, permission, règle de relais ni actif SVG approuvé modifié.
