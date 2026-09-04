# Export vidéo du whiteboard — rendu serveur hors ligne

**Date** : 2026-09-04
**État** : design validé, implémentation non commencée

## Le problème

`app/(protected)/storyboard/page.tsx:1951` simule l'export : une modale
s'ouvre, une barre progresse, un lien « video.mp4 » apparaît — et rien n'est
produit.

```js
// TODO: Implement actual export logic
setTimeout(() => { setExportPhase("complete"); setDownloadUrl("video.mp4"); }, 2000);
```

Pour un éditeur de vidéos, c'est la seule fonction qui compte. C'est le
bloquant du MVP.

## Pourquoi un rendu hors ligne, et pas une capture de l'aperçu

L'aperçu est piloté par `requestAnimationFrame` : sa cadence dépend de la
charge de la machine. Capturer son canvas en temps réel donnerait une vidéo
dont la durée varie d'une exécution à l'autre, et qui saute dès que l'onglet
passe en arrière-plan.

En rendu hors ligne, l'horloge est déduite de l'indice d'image et le moteur est
avancé à la main, aussi vite que la machine le permet. Le résultat ne dépend
plus de la vitesse de rendu.

## L'existant qu'on réutilise

Le moteur a été conçu pour ça. `lib/whiteboard-animation/lib/editor/harnais-headless.js`
documente la recette — jsdom pour le DOM, node-canvas pour dessiner — et
renvoie à `server/canvas-renderer.js`, « qui rend déjà les vidéos comme ça ».

Ce fichier n'est pas dans ce dépôt : il est resté dans sketchpilot
(`~/dev/Hayzar/SAAS/sketchpilot/server/canvas-renderer.js`, 27 ko). C'est lui
qu'on porte. On ne réinvente pas la recette de rendu.

Déjà en place dans ce dépôt :

| | |
|---|---|
| `jsdom` | dépendance (^30.0.1) |
| binaire `ffmpeg` | présent dans le PATH |
| images des mains | `public/images/hand*.png` |
| patron de job asynchrone | `lib/video-generation/store.ts` + `app/api/video/status/[jobId]` |
| moteur | `lib/whiteboard-animation/lib` (`buildProjectSchedule`, `resoudreTransition`, `CUSTOM_HANDS`, `handDrawRect`) |

À ajouter : `canvas` (node-canvas) et `fluent-ffmpeg`.

## Architecture

Le rendu tourne dans un **process Node enfant**, forké par une route Next.

```
ExportModal ──POST──> /api/whiteboard/render ──fork()──> render-worker.js
     │                        │                                │
     │                   renderStore                     canvas-renderer.js
     │                    (job + child)                   jsdom + node-canvas
     │                        │                                │
     └──GET (polling)─────────┘                            ffmpeg (image2pipe)
     └──DELETE (annuler) ──> child.kill()                       │
                                                          RENDER_OUTPUT_DIR/<jobId>.mp4
                                                                │
                          <──GET /api/whiteboard/render/[jobId]/file (session vérifiée)
```

**Pourquoi un enfant plutôt qu'en processus.** node-canvas est natif : il ne
rend pas la main à la boucle d'événements pendant un `drawImage`. Un rendu en
processus rendrait l'application molle pendant tout un export, et le bouton
« Annuler » de la modale ne pourrait rien interrompre. Tuer un process, si.

**Pourquoi pas BullMQ + Redis**, comme sketchpilot. Ça imposerait de déployer
Redis et de superviser un second service. La frontière de module choisie ici
(le renderer ne connaît ni Express ni la file) permet d'y passer plus tard sans
réécrire le renderer.

## Composants

### `lib/whiteboard-animation/server/canvas-renderer.js`

Port de sketchpilot. Conserve son API : `renderAnimationFrames`,
`renderToVideo`, `renderProjectFrames`, `renderProjectToVideo`.

Conserve surtout ses invariants :

- **Un JSDOM neuf par scène.** C'est ce qui empêche `contentBounds`,
  `revealCanvas` et `_regionRect` de fuir d'une scène à l'autre. Cette classe
  de fuite a déjà coûté plusieurs correctifs (`bfa5a41`, `d923f4f`).
- **`seekFrame` avance d'un tick par image en mode annotation.** L'heuristique
  `ticksPerFrame` ne s'applique qu'au mode legacy, qui n'a pas de durée propre.
  L'appliquer aux annotations faisait défiler la timeline 8 à 12× trop vite.
- **La frame N est l'état après N ticks.** La frame 0 est donc l'état initial,
  avant le moindre trait : la vidéo commence par le stylo qui arrive, comme
  l'aperçu.
- **Le moteur reste figé au 1× fidèle (40).** Les bornes `reveal.from/to` sont
  des timestamps de la narration ; tout multiplicateur ferait dériver le dessin
  par rapport à sa bande-son.

Trois adaptations, et pas une de plus :

1. `require('../lib')` → `lib/whiteboard-animation/lib`.
2. Chemins des mains : la réécriture `images/` → `../images/` devient
   `public/images/`.
3. Streaming des frames (section suivante).

### Le streaming, sans casser les transitions

`renderProjectFrames` accumule aujourd'hui toutes les frames en mémoire
(`frames.push`) avant d'encoder. À 1080p/30fps, 30 s font ~900 buffers PNG,
soit plusieurs Go.

L'accumulation existe parce qu'une transition a besoin de la **dernière** frame
de la scène N et de la **première** de la N+1. Il suffit donc d'en retenir
**deux** :

1. Rendre la scène N en écrivant ses frames dans le flux au fil de l'eau,
   en retenant la dernière.
2. À la scène N+1, retenir sa frame 0 sans l'écrire.
3. Émettre les frames de fondu entre les deux frames retenues.
4. Écrire la frame 0, puis le reste au fil de l'eau.

Mémoire constante au lieu de linéaire. `renderAnimationFrames` a déjà un
paramètre `onFrame` sur lequel se brancher.

### `lib/whiteboard-animation/server/render-worker.js`

Script Node autonome, forké par la route. Ne connaît ni Next ni HTTP.

- reçoit `{ jobId, project, width, height, fps, outputPath }` sur IPC
- émet `{ type: 'progress', value }` pendant le rendu
- émet `{ type: 'done', path }` ou `{ type: 'error', message }`
- sortie non nulle = échec, y compris quand il est tué

### `lib/whiteboard-animation/server/render-store.ts`

Calqué sur `videoStore`, plus la référence du child process pour l'annulation.
En mémoire : un redémarrage perd les jobs en cours — déjà le cas du store
existant, et acceptable pour le MVP.

### Routes

| Route | Rôle |
|---|---|
| `POST /api/whiteboard/render` | valide (Zod), crée le job, `fork()`, répond 202 + `jobId` |
| `GET /api/whiteboard/render/[jobId]` | progression et état |
| `DELETE /api/whiteboard/render/[jobId]` | `child.kill()` |
| `GET /api/whiteboard/render/[jobId]/file` | sert le mp4, session vérifiée |

**Les vidéos sont écrites hors de `public/`** (`RENDER_OUTPUT_DIR`, défaut
`.renders/`). Dans `public/`, le fichier serait servi par Next sans aucun
contrôle : quiconque devine l'URL télécharge la vidéo d'un autre.

Le job porte donc le `userId` de la session qui l'a créé. Les quatre routes
vérifient la session, et que `job.userId` est celui de l'appelant — sinon 404,
pas 403 : un 403 confirmerait l'existence du job. `jobId` est un identifiant
opaque et non devinable.

### `lib/whiteboard-animation/server/to-render-project.ts`

Adaptateur du store storyboard vers la forme attendue par le renderer
(`scenes[]`, `layers[]`, `narration`). Fonction pure, donc testable sans rien
monter.

Il tourne **dans la route**, pas dans le worker : le worker est un process Node
nu, il ne sait pas charger du TypeScript. La route construit le `project` et le
passe déjà formé sur IPC. Le worker ne dépend donc que de JavaScript simple.

### Branchement de l'UI

`onStartExport` de l'`ExportModal` POST puis interroge le statut ; `onCancel`
fait le DELETE. Le `setTimeout` disparaît.

La modale raisonne en `"720p" | "1080p"`, le renderer en pixels. La conversion
est faite **côté serveur**, à la validation : `720p` → 1280×720, `1080p` →
1920×1080, en respectant le ratio du projet (`projectParams.aspectRatio`) — une
scène 9:16 en « 1080p » fait 1080×1920, pas 1920×1080. `fps` vaut 30, non
exposé dans l'UI pour l'instant.

## Vérification

C'est ce qui distingue ce chemin de l'export navigateur : **il est testable
sans navigateur.**

| Test | Ce qu'il couvre |
|---|---|
| Fumée bout-en-bout | 3 à 4 frames sur un canvas minuscule → un mp4 lisible sort, avec la bonne durée et le bon nombre d'images (`ffprobe`) |
| Ordre des frames en streaming | les frames de fondu tombent entre les deux scènes, et la mémoire retenue reste à deux frames |
| Adaptateur | store storyboard → `project`, y compris scène unique, sans audio, sans transition |
| Job store | cycle de vie, annulation, job inconnu |

Le test de fumée est marqué lent : il lance ffmpeg.

## Ce que ça ne fait pas

- Pas de file durable : un redémarrage perd les rendus en cours.
- Pas de rendu concurrent plafonné — à ajouter si plusieurs utilisateurs
  exportent en même temps. C'est le moment où l'on passera à BullMQ.
- Pas de reprise sur erreur : un rendu échoué se relance depuis le début.

## Risques connus

### ~~`fork()` depuis une route Next~~ — s'est produit, et corrigé

Le risque s'est matérialisé au premier `next build`. **Turbopack analyse
statiquement le premier argument de `fork()`** et tente de le résoudre comme un
import :

```
Module not found: Can't resolve './ROOT/.../render-worker.js'
server relative imports are not implemented yet.
```

Le chemin était pourtant construit à l'exécution avec `join(process.cwd(), …)` :
le bundler le replie quand même. Aucun réglage de `serverExternalPackages` n'y
change rien, puisque le problème n'est pas la résolution d'un paquet mais le
traçage de `fork` lui-même.

**Correctif retenu** : `spawn(process.execPath, [WORKER], { stdio: ["pipe",
"pipe", "pipe", "ipc"] })`. Sémantiquement identique — le canal `ipc` rend
`child.send()` et les messages, donc le protocole du worker est inchangé — mais
le chemin n'est plus qu'un argument de ligne de commande, que le bundler n'a
aucune raison de résoudre. Vérifié : même sortie qu'avec `fork` (12 images,
progression `[45, 90, 100]`, code de sortie 0).

`serverExternalPackages: ["canvas", "fluent-ffmpeg", "jsdom"]` reste nécessaire
par ailleurs : ce sont des binaires natifs ou à chargement dynamique.

### Le worker et le traçage `standalone`

Le passage à `spawn` a un corollaire : plus aucun import ne désigne le worker,
donc le traceur de fichiers de Next ne peut pas le connaître. Or ce projet
déploie en `output: "standalone"`, qui ne copie que ce qui est tracé. Le worker
doit donc être inclus explicitement — de même que le moteur et les images de
mains, qu'il charge par chemin et jamais par import.

```ts
outputFileTracingIncludes: {
  "/api/whiteboard/render": [
    "./lib/whiteboard-animation/server/**",
    "./lib/whiteboard-animation/lib/**",
    "./public/images/**",
  ],
},
```

**Vérifié** sur un build réel : `.next/standalone/**` contient le worker, le
moteur, le binaire natif `canvas` et `public/images/`.

Réserve honnête : je n'ai pas mesuré ce que le standalone contiendrait *sans*
cette configuration. Elle est justifiée par construction — rien n'importe le
worker — mais son caractère indispensable n'est pas prouvé expérimentalement.

### Dépendance native

`canvas` est une dépendance **native**. Elle compile ou tire un binaire
préconstruit, et l'image Docker devra porter `libcairo`, `libpango`,
`libjpeg`. C'est le prix de la recette sketchpilot ; signalé maintenant plutôt
qu'au déploiement.
