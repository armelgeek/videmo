# Timeline editor d'annotations — design

Date : 2026-08-30
Statut : validé (sections 1–6) — révision : suppression du concept de scène

## Objectif

Transformer le timeline placeholder de l'éditeur whiteboard en un véritable
éditeur temporel. Les *clips* du timeline sont directement les
**annotations**, chacune avec sa durée, enchaînées **séquentiellement les unes
après les autres**. Pas de couche de regroupement (chapitre/scène) : l'ordre
des annotations fait l'enchaînement, point.

## Décisions

| Sujet | Décision |
|---|---|
| Unité du timeline | L'**annotation** elle-même. Pas de niveau de regroupement intermédiaire. |
| Modèle temporel | Enchaînement automatique. `startMs` est **dérivé** de l'ordre + durées + gaps, jamais stocké comme donnée d'auteur. |
| Terminologie | Le terme **annotation** est conservé, seul. |
| Emplacement des gaps | `Annotation.reveal.gapBeforeMs?` — un seul champ optionnel, rétro-compatible. |
| Base UI | Réutilisation du timeline NLE existant `lib/editor/components/timeline.tsx`, avec une seule piste. |
| Scope v1 | Base + gaps + zoom/snapping. |

### Note sur la révision

Une itération précédente de ce design introduisait un niveau « scène »
(groupement logique d'annotations, un « chapitre »). Ce niveau est retiré :
les annotations sont déjà l'unité pertinente et suffisante — chaque annotation
*est* un clip du timeline, il n'y a rien à regrouper au-dessus. Cette
simplification supprime le type `Scene`, la clé `scenes` du state, les actions
de gestion de scène, et toute la partie « pistes multiples » du timeline NLE :
il n'y a plus qu'**une seule piste**, contenant tous les clips à la suite.

### Sur le choix du timeline NLE existant

`lib/editor/components/timeline.tsx` fait 630 lignes, expose ~50 props, et
raisonne en **temps absolu et en secondes**, là où notre modèle est **dérivé et
en millisecondes**. Réutiliser ce composant apporte gratuitement le zoom, le
snapping, la sélection multiple et les raccourcis clavier, au prix d'une
couche de traduction permanente entre les deux modèles.

Ce coût est assumé et **maîtrisé par confinement** : toute la traduction vit
dans un fichier unique, pur et testable (`adapter.ts`). La règle qui empêche la
dérive des deux modèles est vérifiée par un test : *le `start` absolu produit
par le NLE n'est jamais stocké*.

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

Aucun autre changement de type : pas de `Scene`, pas de clé `scenes` dans
`UnifiedEngineState.animation`. L'ordre des annotations dans
`animation.annotations` **est** l'enchaînement — il fait loi.

### Migration

`normalizeGaps(annotations) → annotations` convertit, **au chargement**, les
trous implicites des données existantes en `gapBeforeMs` explicites. Les
fichiers source (`scene-premium-bag.ts`, `demo-annotations.ts`) ne sont pas
modifiés.

Exemple : `title` finit à 1900 ms, `bag` démarre à 2000 ms → `bag.gapBeforeMs = 100`.

## Section 2 — Couche de traduction

Fichier unique : `lib/whiteboard-animation/timeline/adapter.ts`. Sans état, sans
React, entièrement testable en isolation.

### `deriveTimeline(annotations) → DerivedTimeline`

Parcourt les annotations dans l'ordre du tableau, accumule
`gapBeforeMs + durationMs`, produit le `startMs` absolu de chaque annotation et
la durée totale. **Seule fonction du système qui calcule du temps.**

### `toEditorTimeline(derived) → { tracks, clips, mediaMap }`

Descendante. Conversions :

| Domaine whiteboard | Domaine `lib/editor` |
|---|---|
| millisecondes | secondes (`/1000`) |
| une annotation | un `TimelineClip` (`mediaId` = id d'annotation) |
| l'ensemble des annotations | une **unique** `Track` (`type: "video"`) |

Une seule piste, toujours présente, jamais ajoutée/supprimée/réordonnée : les
callbacks NLE liés aux pistes (`onAddTrack`, `onReorderTracks`) ne sont pas
branchés.

### `applyEditorEdit(edit, annotations) → annotations`

Remontante. Traduit chaque callback NLE en intention métier :

| Callback | Intention |
|---|---|
| `onClipUpdate` (resize droite) | change `durationMs` → ripple des suivantes |
| `onClipUpdate` (resize gauche) | change `gapBeforeMs` |
| `onClipUpdate` (drag horizontal) | ré-ordonnancement dans le tableau `annotations` : seul l'index d'insertion est retenu |
| `onDeleteClip` / `onRippleDeleteClip` | identiques (le modèle dérivé est toujours ripple) |
| `onSplitClip` | découpe l'annotation en deux, même région |
| audio, effets, transitions, pistes | non branchés |

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
index.ts
```

(Pas de `scene-actions.ts` : il n'y a plus d'entité scène à gérer.)

### `useAnnotationTimeline()`

```ts
const { annotations, currentTime, isPlaying } = useUnifiedEngine(...)
const derived = useMemo(() => deriveTimeline(annotations), [annotations])
const view    = useMemo(() => toEditorTimeline(derived), [derived])
```

Retourne un objet prêt à étaler sur `<Timeline {...props} />`. Les ~50 props se
répartissent en trois familles :

- **Branchées au store** (~8) : `onSeek`, `onPlayPause`, `onSelectClips`,
  `onClipUpdate`, `onDeleteClip`, `onRippleDeleteClip`, `onDuplicateClip`,
  `onSplitClip`, `onUndo`/`onRedo`. Toutes passent par `applyEditorEdit` —
  point d'entrée unique en écriture.
- **Locales au composant** (~6) : `zoomLevel`, `tool`, `onZoomChange`,
  `onZoomToFit`, `onDragStart`, `onShowShortcuts`.
- **Non fournies** (~35, optionnelles) : audio, effets, transitions, rendu,
  waveform, tout ce qui touche aux pistes multiples (`onAddTrack`,
  `onReorderTracks`, `onTrackUpdate`). Absentes = branches non rendues.

`frameRate` vient de `timeline.fps`. `isLooping` / `isRendering` reçoivent des
valeurs fixes.

### Deux frictions connues

1. **`mediaMap` obligatoire.** `timeline-clip.tsx` lit `media.type`. On fabrique
   un `MediaItem` synthétique par annotation (`type: "image"`, `url` = image
   associée à l'annotation) ; le clip affiche une vignette, ce qui est lisible.
2. **Toolbar.** `timeline-toolbar.tsx` expose des outils sans objet ici
   (gestion de pistes notamment) et ne prend pas de prop de filtrage. On ajoute
   `variant?: "video" | "annotation"` — **une seule modification dans
   `lib/editor`**, additive, sans effet sur le timeline vidéo existant.
   Préféré à un fork du fichier, qui divergerait.

## Section 4 — Interactions (scope v1)

**Base** — playhead scrubbable (`onSeek` → `setCurrentTime`, conversion s→ms) ;
poignée droite = `durationMs` avec ripple ; drag horizontal = ré-ordonnancement
dans la séquence ; sélection → `setSelectedAnnotation`, qui ouvre l'inspector
existant.

**Gaps** — rendus comme l'espace vide entre deux clips ; édités par la poignée
gauche.

**Zoom & snapping** — `zoomLevel` local ; `use-timeline-snap` snappe aux bords
des clips adjacents. Raccourcis (espace, suppr, J/K/L) déjà gérés par
`timeline.tsx`.

## Section 5 — Tests

**Prérequis** : le projet n'a **aucun runner de tests** — pas de script `test`
dans `package.json`, pas de `vitest.config` ni `jest.config`, contrairement à ce
qu'affirme `CLAUDE.md`. Il faut ajouter Vitest. `adapter.ts` étant pur, aucune
dépendance jsdom n'est nécessaire.

Cibles :

- `deriveTimeline` : gaps simples, plusieurs annotations consécutives sans
  gap, durée totale.
- **Non-régression (test clé)** : `scene-premium-bag.ts` passé par
  `normalizeGaps` puis `deriveTimeline` doit reproduire exactement les `startMs`
  d'origine — 300, 2000, 5500, 7600, 9200 — et une durée totale de 11700 ms.
  C'est la preuve que la migration ne change rien au rendu.
- `applyEditorEdit` : un resize ripple bien les suivantes ; un drag horizontal
  ne produit jamais de chevauchement ; un `start` absolu du NLE n'est jamais
  stocké.

## Section 6 — Plan d'implémentation

Ordre pensé pour que chaque étape soit testable et *mergeable* seule, sans
jamais laisser le timeline vidéo existant ou le rendu whiteboard dans un état
cassé. Rien n'est branché dans l'UI avant que la logique pure (adapter) soit
validée par les tests. Chaque étape ci-dessous correspond à une PR distincte.

### Étape 0 — Outillage de test (préalable bloquant)

- Ajouter Vitest (`vitest`, `@vitest/coverage-v8` si besoin) + script `test`
  dans `package.json`. Pas de jsdom à ce stade.
- Corriger la mention erronée dans `CLAUDE.md` qui affirme qu'un runner existe
  déjà.
- **Critère de sortie** : `pnpm test` (ou équivalent) tourne en CI sur un test
  trivial.

### Étape 1 — Modèle de données

- Ajouter `gapBeforeMs?: number` à `Annotation.reveal`.
- Écrire `normalizeGaps(annotations) → annotations` : détecte les trous
  implicites dans les données existantes et les convertit en `gapBeforeMs`
  explicites.
- Ne touche à **aucun** fichier de rendu (`AnimationFactory`,
  `use-whiteboard-renderer`) : ils continuent de lire `startMs`/`from`/`to`
  comme avant, ces champs n'étant pas encore recalculés à ce stade.
- **Critère de sortie** : les types compilent, `normalizeGaps` a ses propres
  tests unitaires (cas : aucun trou, trou simple, plusieurs annotations
  consécutives sans trou).

### Étape 2 — `adapter.ts` (cœur pur, sans UI)

D�veloppé et mergé **avant** tout câblage React, dans cet ordre interne :

1. `deriveTimeline(annotations)` — implémenter et faire passer le test de
   non-régression sur `scene-premium-bag.ts` (300, 2000, 5500, 7600, 9200 ;
   total 11700 ms) avant d'écrire le reste. C'est le test qui prouve que le
   modèle dérivé est correct ; tout ce qui suit en dépend.
2. `toEditorTimeline(derived)` — conversions ms→s, construction de
   `tracks` (une seule), `clips`, `mediaMap`.
3. `applyEditorEdit(edit, annotations)` — un cas de callback à la fois (resize
   droite, resize gauche, drag horizontal, delete, ripple delete, split),
   chacun avec son test dédié à l'invariant : *le `start` absolu du NLE n'est
   jamais stocké*.
- **Critère de sortie** : `adapter.ts` a une couverture de test complète sur
  les trois fonctions, zéro dépendance à React ou au store. C'est la porte de
  confiance avant de brancher quoi que ce soit de visuel.

### Étape 3 — Branchement du rendu sur les champs dérivés

- Avant de toucher à l'UI, réinjecter les résultats de `deriveTimeline` dans
  `startMs`/`from`/`to` au moment où `AnimationFactory` /
  `use-whiteboard-renderer` les consomment (ou à la lecture depuis le store,
  selon où c'est le plus confiné).
- **Critère de sortie** : le rendu whiteboard produit exactement le même
  résultat visuel qu'avant sur `scene-premium-bag.ts` et `demo-annotations.ts`
  (vérification manuelle + le test de non-régression de l'étape 2 sert de
  garde-fou permanent).

### Étape 4 — `use-annotation-timeline.ts`

- Câble `useUnifiedEngine` → `deriveTimeline` → `toEditorTimeline` (mémoïsés).
- Construit les ~8 props branchées au store, en passant chaque callback par
  `applyEditorEdit` puis par les actions du store.
- Ajoute les ~6 props locales au composant (zoom, tool, etc.).
- Pas de test dédié lourd ici (c'est du câblage) — validé indirectement via
  l'étape 6 (QA manuelle) et par le fait que `adapter.ts` est déjà couvert.

### Étape 5 — Modification additive de `lib/editor`

- Ajouter `variant?: "video" | "annotation"` à `timeline-toolbar.tsx`, filtrage
  des outils sans objet (dont ceux liés aux pistes multiples) quand
  `variant === "annotation"`.
- **Une seule modification**, purement additive : `variant` par défaut
  `"video"`, comportement du timeline vidéo existant inchangé.
- **Critère de sortie** : le timeline vidéo existant (s'il a des tests ou un
  usage ailleurs dans le repo) n'est pas affecté ; vérification par inspection
  du seul autre call site connu, s'il existe.

### Étape 6 — `annotation-timeline.tsx` + bascule

- Monte `<Timeline {...view} variant="annotation" />` avec le `mediaMap`
  synthétique (Section 3, friction 1).
- Dans `inkplainer-canvas-area.tsx:107`, remplacer `<InkplainerTimeline />` par
  `<AnnotationTimeline />`.
- Supprimer `inkplainer-timeline.tsx` (placeholder, 39 lignes) dans la même PR
  — pas de code mort laissé derrière.
- **Critère de sortie** : QA manuelle sur les interactions listées en
  Section 4 — scrub, resize (ripple), drag horizontal (réordonnancement),
  split, delete/ripple delete, undo/redo, zoom, snapping aux bords de clips.
  Chaque interaction vérifiée visuellement contre le rendu whiteboard réel (pas
  seulement l'état du timeline).

### Étape 7 — Nettoyage

- Mettre à jour `CLAUDE.md` si d'autres affirmations sont devenues obsolètes
  du fait de ce chantier.
- Vérifier qu'aucun import résiduel vers `inkplainer-timeline.tsx` ne subsiste.

### Risques identifiés et mitigation

| Risque | Mitigation |
|---|---|
| Dérive entre le `start` absolu du NLE et le modèle dérivé | Test d'invariant dédié dans `adapter.ts` (étape 2), pas de contournement possible tant qu'il reste vert. |
| Régression visuelle silencieuse sur les animations existantes | Test de non-régression sur `scene-premium-bag.ts` gardé en CI en continu, pas seulement à l'étape 2. |
| `variant` sur la toolbar casse discrètement le timeline vidéo | Défaut `"video"` explicite, changement additif uniquement, revu à l'étape 5 avant tout branchement annotation. |
| `mediaMap` synthétique mal formé fait planter `timeline-clip.tsx` | Couvert par la QA manuelle de l'étape 6 avant bascule. |
| Scope v1 dépassé (audio/transitions/groupement) | Explicitement hors périmètre — toute demande de regroupement futur repart d'un nouveau design, pas une extension silencieuse de celui-ci. |

## Hors périmètre v1

- Tout niveau de regroupement au-dessus de l'annotation (chapitres, scènes).
- Piste de narration audio.
- Transitions entre annotations.
- Extraction de primitives partagées entre le timeline vidéo et le timeline
  d'annotations. À reconsidérer une fois les deux en production, quand les vraies
  frontières seront observables plutôt que devinées.