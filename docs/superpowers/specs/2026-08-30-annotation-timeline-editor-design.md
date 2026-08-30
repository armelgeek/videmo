# Timeline editor d'annotations — design

Date : 2026-08-30
Statut : validé (sections 1–5), en attente de plan d'implémentation

## Objectif

Transformer le timeline placeholder de l'éditeur whiteboard en un véritable
éditeur temporel. Les *clips* du timeline sont les **annotations**, chacune avec
sa durée. Les annotations sont regroupées en **scènes** qui s'enchaînent
séquentiellement.

## Décisions

| Sujet | Décision |
|---|---|
| Définition d'une scène | Groupement logique d'annotations (un « chapitre »). L'image de fond peut rester la même d'une scène à l'autre. |
| Modèle temporel | Enchaînement automatique. `startMs` est **dérivé** de l'ordre + durées + gaps, jamais stocké comme donnée d'auteur. |
| Terminologie | Le terme **annotation** est conservé. L'ajout des scènes est purement additif. |
| Emplacement des gaps | `Annotation.reveal.gapBeforeMs?` — un seul champ optionnel, rétro-compatible. |
| Base UI | Réutilisation du timeline NLE existant `lib/editor/components/timeline.tsx`. |
| Scope v1 | Base + gestion des scènes + gaps + zoom/snapping. |

### Sur le choix du timeline NLE existant

`lib/editor/components/timeline.tsx` fait 630 lignes, expose ~50 props, et
raisonne en **temps absolu et en secondes**, là où notre modèle est **dérivé et
en millisecondes**. Réutiliser ce composant apporte gratuitement le zoom, le
snapping, les markers, la sélection multiple et les raccourcis clavier, au prix
d'une couche de traduction permanente entre les deux modèles.

Ce coût est assumé et **maîtrisé par confinement** : toute la traduction vit
dans un fichier unique, pur et testable (`adapter.ts`). La règle qui empêche la
dérive des deux modèles est énoncée en Section 2 et vérifiée par un test : *le
`start` absolu produit par le NLE n'est jamais stocké*.

## Section 1 — Modèle de données

### Annotation (inchangée, sauf un champ optionnel)

```ts
reveal: {
  durationMs: number
  gapBeforeMs?: number   // NOUVEAU, défaut 0 — pause avant cette annotation
  startMs: number        // DÉRIVÉ — recalculé, jamais édité à la main
  from: number           // DÉRIVÉ
  to: number             // DÉRIVÉ
}
```

`startMs`, `from` et `to` restent présents dans le type : `AnimationFactory` et
`use-whiteboard-renderer` les lisent et ne doivent pas être modifiés. Ils
deviennent des champs **calculés**, réinjectés par la dérivation avant rendu.
Seul l'éditeur sait qu'ils sont dérivés.

### Scene (nouveau, additif)

```ts
export interface Scene {
  id: string
  name: string
  annotationIds: string[]  // l'ORDRE fait loi = l'enchaînement
  gapBeforeMs: number      // pause avant le premier clip de la scène
  collapsed: boolean
}
```

Ajouté à `UnifiedEngineState.animation` sous la clé `scenes: Scene[]`.

Les annotations restent **à plat** dans `animation.annotations` ; les scènes ne
portent que des `id`. Aucune duplication, et les actions existantes
(`addAnnotation`, `updateAnnotation`, `removeAnnotation`) continuent de
fonctionner sans réécriture.

Une annotation présente dans `annotations` mais dans aucune scène est rattachée
à une scène implicite « Sans scène » en fin de timeline. Aucune annotation ne
peut disparaître silencieusement.

### Migration

`normalizeGaps()` convertit, **au chargement**, les trous implicites des données
existantes en `gapBeforeMs` explicites. Les fichiers source
(`scene-premium-bag.ts`, `demo-annotations.ts`) ne sont pas modifiés.

Exemple : `title` finit à 1900 ms, `bag` démarre à 2000 ms → `bag.gapBeforeMs = 100`.

## Section 2 — Couche de traduction

Fichier unique : `lib/whiteboard-animation/timeline/adapter.ts`. Sans état, sans
React, entièrement testable en isolation.

### `deriveTimeline(scenes, annotations) → DerivedTimeline`

Parcourt les scènes dans l'ordre, accumule `gapBeforeMs + durationMs`, produit
le `startMs` absolu de chaque annotation, les frontières de scène et la durée
totale. **Seule fonction du système qui calcule du temps.**

### `toEditorTimeline(derived) → { tracks, clips, mediaMap, markers }`

Descendante. Conversions :

| Domaine whiteboard | Domaine `lib/editor` |
|---|---|
| millisecondes | secondes (`/1000`) |
| une annotation | un `TimelineClip` (`mediaId` = id d'annotation) |
| une scène | un `Track` (`type: "video"`, `isLocked` si repliée) |
| une frontière de scène | un `Marker` → **snapping aux scènes gratuit** |

### `applyEditorEdit(edit, scenes, annotations) → { scenes, annotations }`

Remontante. Traduit chaque callback NLE en intention métier :

| Callback | Intention |
|---|---|
| `onClipUpdate` (resize droite) | change `durationMs` → ripple des suivantes |
| `onClipUpdate` (resize gauche) | change `gapBeforeMs` (et non `offset`, sans objet ici) |
| `onClipUpdate` (drag horizontal) | ré-ordonnancement : seul l'index d'insertion est retenu |
| `onClipUpdate` (drag vertical) | déplacement vers une autre scène |
| `onDeleteClip` / `onRippleDeleteClip` | identiques (le modèle dérivé est toujours ripple) |
| `onSplitClip` | découpe l'annotation en deux, même région |
| `onAddTrack` / `onReorderTracks` | créer / réordonner une scène |
| audio, effets, transitions | non branchés |

**Règle invariante** : le `start` absolu venant du NLE est toujours jeté. Il ne
sert qu'à déterminer un index d'insertion. La traduction n'est jamais
bidirectionnelle sur la même donnée — c'est ce qui empêche la dérive.

## Section 3 — Composants et câblage

### Point d'insertion

`inkplainer-canvas-area.tsx:107` rend `<InkplainerTimeline />` sans prop, et
c'est le **seul** appel dans le repo. `inkplainer-timeline.tsx` (39 lignes de
placeholder statique) est supprimé et remplacé par `<AnnotationTimeline />`.

### Arborescence — `lib/whiteboard-animation/timeline/`

```
adapter.ts                  Section 2 — pur, sans état, sans React
use-annotation-timeline.ts  câblage ; seul fichier qui connaît le store
annotation-timeline.tsx     monte <Timeline> de lib/editor
scene-actions.ts            create / rename / delete / reorder / collapse
index.ts
```

### `useAnnotationTimeline()`

```ts
const { scenes, annotations, currentTime, isPlaying } = useUnifiedEngine(...)
const derived = useMemo(() => deriveTimeline(scenes, annotations), [scenes, annotations])
const view    = useMemo(() => toEditorTimeline(derived), [derived])
```

Retourne un objet prêt à étaler sur `<Timeline {...props} />`. Les ~50 props se
répartissent en trois familles :

- **Branchées au store** (~12) : `onSeek`, `onPlayPause`, `onSelectClips`,
  `onClipUpdate`, `onDeleteClip`, `onRippleDeleteClip`, `onDuplicateClip`,
  `onSplitClip`, `onAddTrack`, `onReorderTracks`, `onTrackUpdate`, `onUndo`/`onRedo`.
  Toutes passent par `applyEditorEdit` — point d'entrée unique en écriture.
- **Locales au composant** (~6) : `zoomLevel`, `tool`, `onZoomChange`,
  `onZoomToFit`, `onDragStart`, `onShowShortcuts`.
- **Non fournies** (~30, optionnelles) : audio, effets, transitions, rendu,
  waveform. Absentes = branches non rendues.

`frameRate` vient de `timeline.fps`. `isLooping` / `isRendering` reçoivent des
valeurs fixes.

### Deux frictions connues

1. **`mediaMap` obligatoire.** `timeline-clip.tsx` lit `media.type`. On fabrique
   un `MediaItem` synthétique par annotation (`type: "image"`, `url` = image de
   la scène) ; le clip affiche une vignette, ce qui est lisible.
2. **Toolbar.** `timeline-toolbar.tsx` expose des outils sans objet ici et ne
   prend pas de prop de filtrage. On ajoute `variant?: "video" | "annotation"` —
   **une seule modification dans `lib/editor`**, additive, sans effet sur le
   timeline vidéo existant. Préféré à un fork du fichier, qui divergerait.

## Section 4 — Interactions (scope v1)

**Base** — playhead scrubbable (`onSeek` → `setCurrentTime`, conversion s→ms) ;
poignée droite = `durationMs` avec ripple ; drag = ré-ordonnancement ;
sélection → `setSelectedAnnotation`, qui ouvre l'inspector existant.

**Scènes** — créer / renommer / supprimer (`onAddTrack`, `onTrackUpdate`),
réordonner (`onReorderTracks`), replier (`collapsed`, porté par `Track.isLocked`),
déplacer une annotation d'une scène à l'autre (drag vertical).

**Gaps** — rendus comme l'espace vide entre deux clips ; édités par la poignée
gauche.

**Zoom & snapping** — `zoomLevel` local ; `use-timeline-snap` snappe déjà aux
markers, donc aux frontières de scène. Raccourcis (espace, suppr, J/K/L) déjà
gérés par `timeline.tsx`.

## Section 5 — Tests

**Prérequis** : le projet n'a **aucun runner de tests** — pas de script `test`
dans `package.json`, pas de `vitest.config` ni `jest.config`, contrairement à ce
qu'affirme `CLAUDE.md`. Il faut ajouter Vitest. `adapter.ts` étant pur, aucune
dépendance jsdom n'est nécessaire.

Cibles :

- `deriveTimeline` : gaps, scènes vides, annotations orphelines, durée totale.
- **Non-régression (test clé)** : `scene-premium-bag.ts` passé par
  `normalizeGaps` puis `deriveTimeline` doit reproduire exactement les `startMs`
  d'origine — 300, 2000, 5500, 7600, 9200 — et une durée totale de 11700 ms.
  C'est la preuve que la migration ne change rien au rendu.
- `applyEditorEdit` : un resize ripple bien les suivants ; un drag horizontal ne
  produit jamais de chevauchement ; un `start` absolu du NLE n'est jamais stocké.

## Hors périmètre v1

- Image de fond par scène (le modèle scène ne porte pas de layer).
- Piste de narration audio.
- Transitions entre scènes.
- Extraction de primitives partagées entre le timeline vidéo et le timeline
  d'annotations. À reconsidérer une fois les deux en production, quand les vraies
  frontières seront observables plutôt que devinées.
