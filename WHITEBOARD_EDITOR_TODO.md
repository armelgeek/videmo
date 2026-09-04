# Whiteboard — reste à faire

État au terme de la session de correction du moteur d'annotations.
Chaque point indique s'il a été **mesuré** ou seulement **déduit du code**.

---

## 1. Formats non-16:9 — corrigé, vérification partielle

### 1.1 ~~Tout format autre que 16:9 casse la scène~~ — corrigé

La régression introduite en rendant `aspectRatio` effectif (`9c91d60`) est
traitée. L'artwork est désormais ajusté en « contain » dans un rectangle
centré (`rectContenu`), les annotations sont projetées sur **ce rectangle** et
non sur le canvas entier, et les bornes du moteur (`contentBounds`) le suivent.

**La question ouverte est tranchée** : au changement de forme, les régions sont
**transportées** d'un rectangle d'artwork à l'autre (`reprojeterRegion`) plutôt
que régénérées depuis la scène de démo. Les annotations éditées par
l'utilisateur sont donc préservées.

**Vérifié** : en 9:16, artwork centré et non déformé, cadres alignés sur le
tracé. **Non vérifié** : la lecture elle-même en portrait — l'extension
navigateur s'est déconnectée avant. 12 tests couvrent le dimensionnement et la
reprojection (aller-retour sans dérive, pas de déformation, cas dégénérés).

### 1.2 En portrait, le dessin est petit — par construction

Une scène 16:9 ajustée dans un cadre 9:16 n'occupe qu'une bande d'environ un
tiers de la hauteur. C'est le comportement correct d'un « contain », pas un
défaut : produire une vraie vidéo portrait demande un artwork portrait.
À trancher côté produit — recadrage, artwork dédié, ou zoom sur la région
active.

---

## 2. Réglages retirés — dette à solder

Quatre réglages ont été retirés du panneau parce qu'ils ne faisaient rien ou
entraient en conflit avec la durée des annotations. **Les champs subsistent
dans `WhiteboardConfig` pour ne pas casser les projets enregistrés, mais ne
sont plus lus.**

| Champ | État | À décider |
|---|---|---|
| `revealSpeed` | Moteur figé au 1× fidèle (40) | Supprimer du modèle, ou en faire une vraie vitesse de *prévisualisation* (qui devra aussi piloter le `playbackRate` de l'audio) |
| `handSpeed` | Ignoré par `paceStep` en mode annotation | Lui donner un sens qui n'entre pas en conflit avec la durée, ou le supprimer |
| `chunks` | Remplacé par `tuilesPourRegion` (taille de tuile constante) | Supprimer du modèle |
| `useAnnotation` | Mode annotation toujours actif | Supprimer du modèle |
| `aspectRatio` | Déplacé vers `projectParams` | Supprimer de `WhiteboardConfig` |
| `resolution` | Devenu choix d'export | Décider où il vit côté export |

Un nettoyage groupé demandera une **migration du store persisté**
(`storyboard-storage` dans localStorage).

---

## 3. Moteur / rendu

### 3.1 ~~Mains verticales non calibrées~~ — fausse alerte, mesurée

`CUSTOM_HANDS` déclare `tipX: 0, tipY: 0` pour les variantes `*vertical`.
Cela semblait implausible ; **c'est pourtant juste**.

Mesuré sur les neuf assets (`hand{1,2,3}vertical-{720,1080,1440}p.png`) :
l'extrémité opaque est exactement `(0, 0)` dans chacun. Les images sont
recadrées au ras de la pointe, qui touche le coin haut-gauche — vérifié
visuellement sur `hand1vertical-720p` (pointe à ~3 px du coin, le fût noir
ne commençant qu'à (35, 72)).

Méthode validée d'abord sur les mains horizontales déjà calibrées : à
l'échelle 0,6 utilisée par `hands.js`, elle retrouve 229→229, 325→325,
448→448, 166→166, 249→248, 345→344.

Rien à calibrer. Si le portrait ne fonctionne pas, la cause est ailleurs.

### 3.2 ~~Le delta est écrêté à 100 ms~~ — corrigé dans le chemin vivant

`use-whiteboard-renderer.ts` ne fait plus `Math.min(100, delta)` : il pose
`BIG_GAP_MS = 1000` et n'écarte qu'un rAF parqué, en honorant en entier une
vraie frame lente.

**Subsiste ailleurs** : `lib/editor/EditorEngine.js:593` garde
`Math.min(100, _now - state._lastFrameMs)`, et `ENGINE_LIMITATIONS.md`
documente encore l'ancien comportement.

### 3.3 Granularité absente pour 9 styles sur 13

`tuilesPourRegion` ne concerne que ChunkJump, OutlineChunks, Scribble et
Specialized. Les neuf autres n'ont aucun réglage de granularité — ce qui est
cohérent aujourd'hui, mais à garder en tête si le besoin revient.

---

## 4. Export et audio — rien n'est câblé

**Mesuré** : les seuls appelants de `.tick()` sont l'aperçu
(`use-whiteboard-renderer.ts`). `animation-engine.ts:65` expose un
`tick(speed, deltaMs)` **que personne n'appelle**, et
`browser-export.js` est un stub de 23 lignes qui expose
`window.AnimationFactory` — ce n'est pas un moteur de rendu.

À faire le jour où l'export existe :

- **Ne jamais laisser un réglage d'UI piloter l'horloge du rendu.**
  `animation-engine.ts` est déjà figé à `FIDELE_1X`, à préserver.
- **L'audio est la référence temporelle.** `AnnotationManager` le documente :
  `reveal.from/to` viennent de l'alignement de la transcription horodatée de
  la narration sur les régions. Le repli `durationMs` ne sert qu'en l'absence
  d'audio.
- Vérifier que l'export avance l'horloge par temps absolu et non par
  accumulation de deltas, pour ne pas hériter de l'écrêtage du point 3.2.

---

## 5. Panneaux parallèles non alignés

`components/inkplainer-sidebar.tsx` expose encore `revealSpeed`, `handSpeed`,
`chunks`, `resolution` et `useAnnotation` — c'est-à-dire exactement les
réglages retirés du panneau principal. Deux UI qui divergent sur le même
moteur.

~~`components/whiteboard-editor-panel.tsx` porte une erreur TypeScript
(`Cannot find name 'setLayers'`)~~ — l'erreur n'existe plus.

`lib/editor/components/preview-player.tsx` monte le canvas whiteboard en
**1920×1080 en dur**, sans suivre le ratio du projet — contrairement à l'étape
Whiteboard. `editor.tsx` lui passe donc ces dimensions en constantes. Deuxième
consommateur de `useWhiteboardRenderer`, à aligner sur `tailleCanvas`.

---

## 6. Vérifications manquantes

- **Lecture en portrait non confirmée.** L'état au repos est vérifié (artwork
  centré, cadres alignés) mais l'animation elle-même n'a pas été vue tourner en
  9:16 — extension navigateur déconnectée en cours de test.
- **Six styles ajoutés au menu jamais vus à l'écran** : `outlinechunks`,
  `outlinefill`, `outlineonly`, `spec-text`, `specialized`, `topanchor`. Ils
  sont couverts par `styles-smoke.test.ts` (la factory les connaît, ils
  traversent une timeline annotée sans lever, ils appellent `finishAnim`) mais
  leur rendu visuel n'a pas été inspecté.
- **Le seek côté moteur EST couvert** : `prime-at.test.ts` porte 5 cas sur
  `primeAt` (borne, position négative, ré-entrée en région, purge de cadence,
  ré-armement après fin). C'est `repositionTo` côté renderer qui n'a rien.
- **Le rejeu borné à une région a été perdu.** `repositionTo` fait aujourd'hui
  `primeAt(0)` puis `advance(0, localTarget)` : le rejeu repart de zéro et son
  coût redevient linéaire en la position cherchée — exactement ce que `d5f94d0`
  avait supprimé. Le helper `regionRect` (ligne 1032) et le long commentaire qui
  décrit la version bornée subsistent, mais `regionRect` n'a **aucun appelant**.
  Régressé par l'une des corrections de scintillement postérieures
  (`4792f03`, `d7c4b1e`, `21577fa`, `2c5543d`).
- **Aucun test ne couvre le drag continu de la tête de lecture** : l'outil
  d'automatisation n'émet qu'un seul événement de position.
- **Le « retard de la main » d'origine n'a jamais été reproduit.** Trois
  hypothèses ont été mesurées et écartées (écart horizontal de Scanner : −1 px ;
  calibration des mains 1–3 : 1 px ; waypoints d'OutlineFill : triés, 0
  inversion). Le seul défaut trouvé et corrigé est le débordement vertical de
  la pointe hors de l'annotation en fin de balayage. **À confirmer que c'était
  bien ça.**

---

## 7. Santé du dépôt

- **0 erreur TypeScript** sur tout le dépôt (les 17 d'alors ont été résorbées).
- **264 tests verts** (32 fichiers) sur le dépôt, dont 220 dans
  `lib/whiteboard-animation`.
- **L'arbre moteur dupliqué à la racine a été supprimé** (`78ad9dd`, 28 fichiers).
  `AnimationFactory.ts` pointait dessus via `require('./index.js')` — donc le
  futur export aurait rendu avec un moteur privé des correctifs. Il pointe
  désormais sur `./lib/index.js`.
- La forme persistée de `WhiteboardConfig` a changé. Zustand fusionne, donc les
  projets existants ne cassent pas, mais leurs valeurs enregistrées pour les
  champs retirés sont désormais ignorées.

---

## Annexe — corrigé pendant cette session

Pour situer le contexte des points ci-dessus.

| Commit | Correction |
|---|---|
| `26f6c2f` | Cadence du tracé pilotée par le temps écoulé et non par une estimation de budget de frames (les régions finissaient à 57–84 % de leur fenêtre) |
| `fe61060` | Le scrub du timeline repeint enfin le canvas (`currentTime` n'était qu'une sortie du moteur) |
| `d5f94d0` | Rejeu d'un seek borné à une seule région, coût passé de 42–143 ms à 14–34 ms |
| `d866a7e` | Le curseur avance aussi pendant les pauses entre annotations (5 gels sur la scène de référence) |
| `6b44226` | Les 6 styles absents du menu exposés, + smoke test des 13 |
| `da25fd0` | La pointe de Scanner ne sort plus sous l'annotation en fin de balayage (jusqu'à 22 px dehors) |
| `b3e5beb` | Horloge du moteur figée au 1× fidèle, Reveal Speed retiré de l'UI |
| `63c000b` | Nombre de tuiles déduit de la taille de la région (le trait changeait d'épaisseur : rayon 6 à 12 selon la région) |
| `9c91d60` | Ratio devenu paramètre de projet, résolution devenue choix d'export, palier de main déduit du canvas |
| `9ef2b32` | Calque d'annotations masqué pendant lecture et scrub, interrupteur retiré |
