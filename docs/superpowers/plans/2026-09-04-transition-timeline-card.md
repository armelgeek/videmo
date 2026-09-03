# Carte de transition sur la timeline — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre visible et réglable, directement sur la timeline whiteboard, la transition entre deux clips — après avoir réparé le chemin d'écriture qui casserait aujourd'hui n'importe quelle édition faite depuis cette timeline chaînée.

**Architecture:** `useAnnotationTimeline` décode le panneau propriétaire d'une édition depuis le préfixe `pN-` de son id et écrit dans ce seul panneau via `updatePanel`, au lieu d'écraser le store du panneau actif avec la chaîne globale. Une fonction pure calcule la géométrie des cartes de transition à partir des mêmes frontières que `transitionAt` ; un composant superposé, calé sur le viewport partagé de la timeline (même patron que `TimelinePlayhead`), les dessine et porte une poignée de redimensionnement.

**Tech Stack:** TypeScript strict, React, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-transition-timeline-card-design.md`

## Global Constraints

- Une édition ne doit jamais lire ni écrire les annotations de plus d'un panneau à la fois.
- `gapBeforeMs` (créé par un trim de bord gauche) et `transition.durationMs` (réglé par la poignée) sont deux champs distincts, jamais confondus par un même geste.
- La poignée plafonne `durationMs` à `[0, blanc disponible]` — même règle que `transitionAt` (`docs/superpowers/specs/2026-09-03-clip-transitions-design.md`).
- Tests colocalisés : `foo.ts` à côté de `foo.test.ts`, `import { describe, expect, it } from "vitest"`.
- Commandes : `npx vitest run <chemin>` pour les tests, `npx tsc --noEmit` pour les types.

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `lib/whiteboard-animation/timeline/use-annotation-timeline.ts` (modifié) | Décodage de panneau + routage d'écriture |
| `lib/whiteboard-animation/timeline/use-annotation-timeline.test.ts` (créé) | Un trim sur le panneau 2 ne touche pas le panneau 1 |
| `lib/whiteboard-animation/timeline/transition-marker-geometry.ts` (créé) | Position/largeur pixel de chaque carte de transition |
| `lib/whiteboard-animation/timeline/transition-marker-geometry.test.ts` (créé) | Plafonnement, blanc nul, `'none'`, ordre |
| `lib/whiteboard-animation/components/clip-transition-markers.tsx` (créé) | Rendu superposé + poignée de redimensionnement |
| `lib/whiteboard-animation/components/whiteboard-editor-step.tsx` (modifié) | Montage du composant à côté de `TimelinePlayhead` |

---

### Task 1: Réparer le routage d'écriture de `useAnnotationTimeline`

**Files:**
- Modify: `lib/whiteboard-animation/timeline/use-annotation-timeline.ts:55-71` (`edit`)
- Test: `lib/whiteboard-animation/timeline/use-annotation-timeline.test.ts`

**Interfaces:**
- Consumes: `TimelineEdit` de `./apply-editor-edit` — six variantes, `id: string` sur quatre d'entre elles (`resize-duration`, `resize-gap`, `reorder`, `split`), `ids: string[]` sur les deux autres (`delete`, `duplicate`). `applyEditorEdit(change, annotations, capMs?): Annotation[]`. `useStoryboardStore.getState().updatePanel(id, updates)`, déjà importé dans ce fichier (ligne 7). `toEngineAnnotations`/`toStoredAnnotations` de `./annotation-interop`.
- Produces: `edit()` garde sa signature `(change: TimelineEdit) => void`, appelée par `onClipUpdate`, `onDeleteClip`, `onRippleDeleteClip`, `onDuplicateClip`, `onSplitClip` (lignes 133-139) — aucun de ces appelants ne change.

Ce hook n'a aucun test aujourd'hui ; ce fichier est le premier. Il exerce `useAnnotationTimeline` en le rendant avec `renderHook` de `@testing-library/react`, en lui passant une chaîne globale à deux panneaux, comme le fait réellement `whiteboard-editor-step.tsx`.

- [ ] **Step 1: Vérifier la dépendance de test disponible**

Run: `grep -r "@testing-library/react" package.json`
Expected: la ligne existe (le projet l'utilise déjà ailleurs). Si absente, l'installer : `npm install -D @testing-library/react`.

- [ ] **Step 2: Écrire le test qui échoue**

Créer `lib/whiteboard-animation/timeline/use-annotation-timeline.test.ts` :

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnnotationTimeline } from "./use-annotation-timeline";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { useStoryboardStore } from "@/lib/storyboard/store";
import type { Annotation } from "@/lib/unified-engine/types";
import type { StoryboardPanel } from "@/lib/storyboard/schema";

const rev = (durationMs: number, gapBeforeMs = 0) => ({
  durationMs,
  gapBeforeMs,
  from: 0,
  to: 0,
  startMs: 0,
});

// Deux panneaux, deux annotations chacun, prefixes comme le fait
// whiteboard-editor-step.tsx (`p${panelIdx}-${id}`).
const chaineGlobale = (): Annotation[] => [
  { id: "p0-a", text: "A", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: rev(1000), style: { strokeColor: "#000", strokeWidth: 1, opacity: 1 } },
  { id: "p0-b", text: "B", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: rev(1000), style: { strokeColor: "#000", strokeWidth: 1, opacity: 1 } },
  { id: "p1-a", text: "C", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: rev(1000), style: { strokeColor: "#000", strokeWidth: 1, opacity: 1 } },
  { id: "p1-b", text: "D", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: rev(1000), style: { strokeColor: "#000", strokeWidth: 1, opacity: 1 } },
];

const panneau = (id: string, annotations: Annotation[]): StoryboardPanel => ({
  id,
  imageUrl: "/x.png",
  prompt: "x",
  annotations: annotations.map((a) => ({
    id: a.id,
    text: a.text,
    region: a.region,
    reveal: { durationMs: a.reveal.durationMs, gapBeforeMs: a.reveal.gapBeforeMs ?? 0 },
    style: a.style,
  })),
});

describe("useAnnotationTimeline — routage d'ecriture multi-panneaux", () => {
  beforeEach(() => {
    const glob = chaineGlobale();
    useUnifiedEngineStore.setState((s) => ({
      animation: { ...s.animation, annotations: glob.slice(0, 2) }, // panneau actif = panneau 0
    }));
    useStoryboardStore.setState({
      storyboardPanels: [
        panneau("panel-0", glob.slice(0, 2)),
        panneau("panel-1", glob.slice(2, 4)),
      ],
      activeClipIndex: 0,
    });
  });

  it("un trim sur le panneau 2 laisse le panneau 1 intact", () => {
    const glob = chaineGlobale();
    const { result } = renderHook(() => useAnnotationTimeline(glob));

    act(() => {
      // Bord gauche de "p1-a" (2e panneau) tire vers l'avant : cree un blanc.
      result.current.onClipUpdate("p1-a", { start: 2.8, duration: 1, offset: 0 });
    });

    const panels = useStoryboardStore.getState().storyboardPanels;
    expect(panels[0].annotations).toEqual(panneau("panel-0", glob.slice(0, 2)).annotations);
    expect(panels[1].annotations?.[0].reveal.gapBeforeMs).toBeGreaterThan(0);
  });

  it("une edition sur le panneau NON actif ne touche pas le store moteur", () => {
    const glob = chaineGlobale();
    const { result } = renderHook(() => useAnnotationTimeline(glob));

    act(() => {
      result.current.onClipUpdate("p1-a", { start: 2.8, duration: 1, offset: 0 });
    });

    // Le store moteur represente le panneau ACTIF (0) : il doit etre inchange.
    expect(useUnifiedEngineStore.getState().animation.annotations).toEqual(glob.slice(0, 2));
  });

  it("une edition sur le panneau ACTIF met a jour le store moteur ET le panneau", () => {
    const glob = chaineGlobale();
    const { result } = renderHook(() => useAnnotationTimeline(glob));

    act(() => {
      // resize-duration sur "p0-b", 2e annotation du panneau ACTIF (0).
      result.current.onClipUpdate("p0-b", { duration: 1.5 });
    });

    const store = useUnifiedEngineStore.getState().animation.annotations;
    expect(store.find((a) => a.id === "p0-b")?.reveal.durationMs).toBe(1500);

    const panel0 = useStoryboardStore.getState().storyboardPanels[0];
    expect(panel0.annotations?.find((a) => a.id === "p0-b")?.reveal.durationMs).toBe(1500);
  });
});
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/whiteboard-animation/timeline/use-annotation-timeline.test.ts`
Expected: FAIL — le premier test échoue car `edit()` écrase aujourd'hui `storyboardPanels[0]` (l'actif) avec la chaîne des 4 annotations des deux panneaux, au lieu de laisser `panel-0` intact.

- [ ] **Step 4: Écrire l'implémentation**

Dans `use-annotation-timeline.ts`, ajouter en tête de fichier, après les imports existants :

```ts
import { toEngineAnnotations, toStoredAnnotations } from "./annotation-interop";

/**
 * Retrouve le panneau proprietaire d'un id d'annotation de la chaine globale,
 * et l'id LOCAL a ce panneau — inverse exact du prefixage fait dans
 * whiteboard-editor-step.tsx (`p${panelIdx}-${id}`).
 */
function panneauDe(id: string): { panelIdx: number; localId: string } | null {
  const m = id.match(/^p(\d+)-(.+)$/);
  return m ? { panelIdx: Number(m[1]), localId: m[2] } : null;
}
```

Puis remplacer entièrement le corps de `edit` :

```ts
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);
  const storyboardPanels = useStoryboardStore((s) => s.storyboardPanels);

  const edit = useCallback(
    (change: TimelineEdit) => {
      const capMs = narrationMs > 0 ? narrationMs : undefined;

      // Les ids touches par ce changement : `id` sur 4 variantes, `ids` sur
      // delete/duplicate. Sans prefixe pN- (chaine locale a un seul panneau,
      // globalAnnotations absent), on retombe sur le comportement d'origine :
      // ecriture directe dans le store, aucun panneau a router.
      const idsBruts = "id" in change ? [change.id] : change.ids;
      const decodes = idsBruts.map(panneauDe);

      if (!globalAnnotations || decodes.some((d) => d === null)) {
        setAnnotations(applyEditorEdit(change, annotations, capMs));
        return;
      }

      // Regroupe par panneau : delete/duplicate peuvent viser plusieurs
      // panneaux a la fois, mais applyEditorEdit ne doit jamais voir plus
      // d'un panneau a la fois.
      const parPanneau = new Map<number, string[]>();
      decodes.forEach((d) => {
        if (!d) return;
        const liste = parPanneau.get(d.panelIdx) ?? [];
        liste.push(d.localId);
        parPanneau.set(d.panelIdx, liste);
      });

      parPanneau.forEach((localIds, panelIdx) => {
        const panel = storyboardPanels[panelIdx];
        if (!panel) return;

        const locales = toEngineAnnotations(panel.annotations ?? []);

        // Reconstruit un TimelineEdit purement LOCAL a ce panneau : les ids
        // globaux (pN-xxx) redeviennent les ids locaux que ce panneau connait.
        const changeLocal: TimelineEdit =
          "id" in change
            ? { ...change, id: localIds[0] }
            : { ...change, ids: localIds };

        const misesAJour = applyEditorEdit(changeLocal, locales, capMs);
        const stockees = toStoredAnnotations(misesAJour);

        useStoryboardStore.getState().updatePanel(panel.id, { annotations: stockees });

        // Le store moteur ne represente que le panneau ACTIF : une edition
        // ailleurs ne doit ni le lire ni l'ecraser.
        if (panelIdx === activeClipIndex) {
          setAnnotations(misesAJour);
        }
      });
    },
    [annotations, globalAnnotations, storyboardPanels, activeClipIndex, setAnnotations, narrationMs],
  );
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run lib/whiteboard-animation/timeline/use-annotation-timeline.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Vérifier les types et la suite existante**

Run: `npx tsc --noEmit && npx vitest run lib/whiteboard-animation lib/storyboard`
Expected: `tsc` sans sortie ; tous les tests existants toujours au vert (aucun appelant de `edit` n'a changé de signature).

- [ ] **Step 7: Commit**

```bash
git add lib/whiteboard-animation/timeline/use-annotation-timeline.ts lib/whiteboard-animation/timeline/use-annotation-timeline.test.ts
git commit -m "fix: route timeline edits to the panel that owns them, not the whole chain"
```

---

### Task 2: Géométrie pure des cartes de transition

**Files:**
- Create: `lib/whiteboard-animation/timeline/transition-marker-geometry.ts`
- Test: `lib/whiteboard-animation/timeline/transition-marker-geometry.test.ts`

**Interfaces:**
- Consumes: `ClipWindow`, `Transition` de `./clip-transitions` (déjà écrits, spec du 2026-09-03).
- Produces: `interface TransitionMarker { panelIdx: number; x: number; width: number }`, `function markerGeometry(clips: ClipWindow[], pxParMs: number): TransitionMarker[]`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/whiteboard-animation/timeline/transition-marker-geometry.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { markerGeometry } from "./transition-marker-geometry";
import type { ClipWindow } from "./clip-transitions";

describe("markerGeometry", () => {
  it("place un marqueur dans le blanc, plafonne a sa largeur", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 2300 } },
      { startMs: 1300, endMs: 2000 }, // blanc de 300 ms
    ];
    // 1 px/ms pour des chiffres lisibles.
    expect(markerGeometry(clips, 1)).toEqual([{ panelIdx: 0, x: 1000, width: 300 }]);
  });

  it("ne plafonne pas si la duree demandee est plus courte que le blanc", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 100 } },
      { startMs: 1300, endMs: 2000 },
    ];
    expect(markerGeometry(clips, 1)).toEqual([{ panelIdx: 0, x: 1000, width: 100 }]);
  });

  it("ignore une frontiere sans transition ou marquee none", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000 },
      { startMs: 1300, endMs: 2000, transition: { type: "none", durationMs: 300 } },
      { startMs: 2300, endMs: 3000 },
    ];
    expect(markerGeometry(clips, 1)).toEqual([]);
  });

  it("ignore une frontiere sans blanc (clips jointifs)", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 300 } },
      { startMs: 1000, endMs: 2000 },
    ];
    expect(markerGeometry(clips, 1)).toEqual([]);
  });

  it("rend un marqueur par frontiere transitionnee, dans l'ordre", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 300 } },
      { startMs: 1300, endMs: 2300, transition: { type: "slideup", durationMs: 200 } },
      { startMs: 2500, endMs: 3500 },
    ];
    expect(markerGeometry(clips, 1)).toEqual([
      { panelIdx: 0, x: 1000, width: 300 },
      { panelIdx: 1, x: 2300, width: 200 },
    ]);
  });

  it("respecte l'echelle px/ms passee", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 300 } },
      { startMs: 1300, endMs: 2000 },
    ];
    expect(markerGeometry(clips, 0.5)).toEqual([{ panelIdx: 0, x: 500, width: 150 }]);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/whiteboard-animation/timeline/transition-marker-geometry.test.ts`
Expected: FAIL — `Failed to resolve import "./transition-marker-geometry"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/whiteboard-animation/timeline/transition-marker-geometry.ts` :

```ts
import type { ClipWindow } from "./clip-transitions";

/** Position et largeur PIXEL d'une carte de transition, a la frontiere d'un clip. */
export interface TransitionMarker {
  /** Index dans `clips` du panneau SORTANT — celui qui porte `transition`. */
  panelIdx: number;
  x: number;
  width: number;
}

/**
 * Traduit chaque frontiere de clip portant une transition en une carte
 * positionnee en pixels, plafonnee au blanc disponible.
 *
 * Meme regle de plafonnement que transitionAt (docs/superpowers/specs/
 * 2026-09-03-clip-transitions-design.md), dupliquee ici volontairement : le
 * composant qui consomme ce module n'a pas besoin de connaitre le renderer
 * canvas pour savoir ou dessiner une carte.
 */
export function markerGeometry(
  clips: ClipWindow[],
  pxParMs: number,
): TransitionMarker[] {
  const marqueurs: TransitionMarker[] = [];

  for (let i = 0; i < clips.length - 1; i++) {
    const sortant = clips[i];
    const entrant = clips[i + 1];

    const transition = sortant.transition;
    if (!transition || transition.type === "none") continue;

    const blanc = entrant.startMs - sortant.endMs;
    if (blanc <= 0) continue;

    const duree = Math.min(transition.durationMs, blanc);
    if (duree <= 0) continue;

    marqueurs.push({
      panelIdx: i,
      x: sortant.endMs * pxParMs,
      width: duree * pxParMs,
    });
  }

  return marqueurs;
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run lib/whiteboard-animation/timeline/transition-marker-geometry.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/timeline/transition-marker-geometry.ts lib/whiteboard-animation/timeline/transition-marker-geometry.test.ts
git commit -m "feat: compute pixel geometry for clip-transition markers"
```

---

### Task 3: Rendu des cartes, sans redimensionnement

**Files:**
- Create: `lib/whiteboard-animation/components/clip-transition-markers.tsx`
- Modify: `lib/whiteboard-animation/components/whiteboard-editor-step.tsx:351-353`

**Interfaces:**
- Consumes: `markerGeometry`, `TransitionMarker` (Task 2) ; `ClipWindow` (Task 1 de la spec du 2026-09-03, déjà présent comme `clipWindows` dans `whiteboard-editor-step.tsx:151`) ; `TRACK_HEADER_PX` de `../timeline/annotation-timeline` (patron `TimelinePlayhead`).
- Produces: composant `<ClipTransitionMarkers clips={...} viewport={...} onResize={...} />`, `onResize` non branché à ce stade (Task 4).

Non couvert par des tests : positionnement DOM, comme `TimelinePlayhead`. Vérification à l'œil.

- [ ] **Step 1: Écrire le composant**

Créer `lib/whiteboard-animation/components/clip-transition-markers.tsx` :

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { markerGeometry, type TransitionMarker } from "../timeline/transition-marker-geometry";
import type { ClipWindow } from "../timeline/clip-transitions";
import { TRACK_HEADER_PX } from "../timeline/annotation-timeline";

/** Une couleur distincte par type, pour reconnaitre la transition d'un coup d'oeil. */
const COULEUR_PAR_TYPE: Record<string, string> = {
  fade: "#a855f7",
  slideup: "#38bdf8",
  slidedown: "#38bdf8",
  slideleft: "#38bdf8",
  slideright: "#38bdf8",
};

export interface ClipTransitionMarkersProps {
  clips: ClipWindow[];
  /** Meme forme que TimelinePlayhead : viewport partage de la timeline. */
  viewport?: {
    scrollEl: HTMLElement | null;
    contentWidth: number;
    zoomLevel: number;
  };
  /** Branche en Task 4. Duree en ms proposee pour le panneau `panelIdx`. */
  onResize?: (panelIdx: number, durationMs: number) => void;
}

/**
 * Une carte par frontiere de clip transitionnee, superposee a la timeline —
 * meme patron que TimelinePlayhead : positionnee par pixels-par-seconde et
 * scroll offset venus du viewport partage, pas par une Timeline qui ne
 * connait pas ce concept.
 */
export function ClipTransitionMarkers({ clips, viewport, onResize }: ClipTransitionMarkersProps) {
  const scrollEl = viewport?.scrollEl ?? null;
  const zoomLevel = viewport?.zoomLevel ?? 0;
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    if (!scrollEl) return;
    const onScroll = () => setScrollLeft(scrollEl.scrollLeft);
    onScroll();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollEl]);

  if (!viewport || zoomLevel <= 0) return null;

  const pxParMs = zoomLevel / 1000;
  const marqueurs = markerGeometry(clips, pxParMs);

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {marqueurs.map((m) => (
        <TransitionCard
          key={m.panelIdx}
          marqueur={m}
          type={clips[m.panelIdx].transition?.type ?? "fade"}
          scrollLeft={scrollLeft}
        />
      ))}
    </div>
  );
}

function TransitionCard({
  marqueur,
  type,
  scrollLeft,
}: {
  marqueur: TransitionMarker;
  type: string;
  scrollLeft: number;
}) {
  const left = TRACK_HEADER_PX + marqueur.x - scrollLeft;
  const couleur = COULEUR_PAR_TYPE[type] ?? COULEUR_PAR_TYPE.fade;

  return (
    <div
      className="absolute top-0 bottom-0 rounded-sm pointer-events-auto"
      style={{
        left,
        width: Math.max(4, marqueur.width),
        backgroundColor: couleur,
        opacity: 0.55,
      }}
      title={`Transition : ${type}`}
    />
  );
}
```

- [ ] **Step 2: Monter le composant**

Dans `whiteboard-editor-step.tsx`, ajouter l'import après `TimelinePlayhead` :

```tsx
import { ClipTransitionMarkers } from "./clip-transition-markers";
```

Puis, juste après `<AudioTrackRow viewport={timelineViewport} />` et avant `<TimelinePlayhead ... />` :

```tsx
          <ClipTransitionMarkers clips={clipWindows} viewport={timelineViewport} />
```

- [ ] **Step 3: Vérifier les types et la suite existante**

Run: `npx tsc --noEmit && npx vitest run lib/whiteboard-animation`
Expected: `tsc` sans sortie ; tests existants au vert.

- [ ] **Step 4: Vérifier à l'œil**

Donner à un clip une transition avec un blanc non nul avant le suivant (via le sélecteur + un trim de bord gauche créant un `gapBeforeMs`, comme validé à la Task 1). Attendu : un petit bloc coloré apparaît dans ce blanc sur la timeline, à l'endroit exact où le fondu se joue.

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/components/clip-transition-markers.tsx lib/whiteboard-animation/components/whiteboard-editor-step.tsx
git commit -m "feat: render clip-transition cards on the timeline"
```

---

### Task 4: Poignée de redimensionnement

**Files:**
- Modify: `lib/whiteboard-animation/components/clip-transition-markers.tsx` (`TransitionCard`)
- Modify: `lib/whiteboard-animation/components/whiteboard-editor-step.tsx` (brancher `onResize`)

**Interfaces:**
- Consumes: `useStoryboardStore.getState().updatePanel` (même API que Task 1) ; `storyboardPanels`, `clipWindows` déjà présents dans `whiteboard-editor-step.tsx`.
- Produces: rien de nouveau exposé — `onResize` de la Task 3 est enfin appelé.

Non couvert par des tests : geste souris, comme `TimelinePlayhead.startDrag`. Vérification à l'œil.

- [ ] **Step 1: Ajouter la poignée et le geste de drag**

Dans `clip-transition-markers.tsx`, remplacer la fonction `TransitionCard` :

```tsx
function TransitionCard({
  marqueur,
  type,
  scrollLeft,
  pxParMs,
  blancMs,
  onResize,
}: {
  marqueur: TransitionMarker;
  type: string;
  scrollLeft: number;
  pxParMs: number;
  /** Largeur du blanc disponible a cette frontiere, en ms — plafond du drag. */
  blancMs: number;
  onResize?: (panelIdx: number, durationMs: number) => void;
}) {
  const left = TRACK_HEADER_PX + marqueur.x - scrollLeft;
  const couleur = COULEUR_PAR_TYPE[type] ?? COULEUR_PAR_TYPE.fade;

  // Meme protocole que TimelinePlayhead.startDrag : mousedown local,
  // mousemove/mouseup sur document pour suivre le curseur hors de la carte.
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pxParMs <= 0 || !onResize) return;

    const x0 = e.clientX;
    const largeurInitialeMs = marqueur.width / pxParMs;

    const onMove = (ev: MouseEvent) => {
      const deltaMs = (ev.clientX - x0) / pxParMs;
      const dureeMs = Math.round(
        Math.min(blancMs, Math.max(0, largeurInitialeMs + deltaMs)),
      );
      onResize(marqueur.panelIdx, dureeMs);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="absolute top-0 bottom-0 rounded-sm pointer-events-auto"
      style={{
        left,
        width: Math.max(4, marqueur.width),
        backgroundColor: couleur,
        opacity: 0.55,
      }}
      title={`Transition : ${type}`}
    >
      {/* Poignee : bord droit, zone de prise elargie pour rester saisissable
          meme quand la carte est etroite. */}
      <div
        className="absolute -right-1 top-0 bottom-0 w-3 cursor-ew-resize"
        onMouseDown={startDrag}
      />
    </div>
  );
}
```

Et dans `ClipTransitionMarkers`, passer les props supplémentaires :

```tsx
      {marqueurs.map((m) => (
        <TransitionCard
          key={m.panelIdx}
          marqueur={m}
          type={clips[m.panelIdx].transition?.type ?? "fade"}
          scrollLeft={scrollLeft}
          pxParMs={pxParMs}
          blancMs={clips[m.panelIdx + 1].startMs - clips[m.panelIdx].endMs}
          onResize={onResize}
        />
      ))}
```

- [ ] **Step 2: Brancher `onResize` dans le composant parent**

Dans `whiteboard-editor-step.tsx`, `clipWindows` (ligne ~151) donne `panelIdx` implicitement via son index dans le tableau — mais ce tableau est trié par position temporelle, pas par index de panneau : `panelBoundaries` porte déjà `panelIdx` explicite (ligne 99-115). Ajouter ce champ à `clipWindows` :

```tsx
  const clipWindows = useMemo(
    () =>
      panelBoundaries.map((b) => ({
        startMs: b.startMs,
        endMs: b.endMs,
        transition: storyboardPanels[b.panelIdx]?.transition,
        panelId: storyboardPanels[b.panelIdx]?.id,
      })),
    [panelBoundaries, storyboardPanels],
  );
```

Puis mettre à jour l'appel du composant pour fournir `onResize` :

```tsx
          <ClipTransitionMarkers
            clips={clipWindows}
            viewport={timelineViewport}
            onResize={(panelIdx, durationMs) => {
              const panelId = clipWindows[panelIdx]?.panelId;
              const panel = storyboardPanels.find((p) => p.id === panelId);
              if (!panel?.transition) return;
              useStoryboardStore
                .getState()
                .updatePanel(panel.id, {
                  transition: { ...panel.transition, durationMs },
                });
            }}
          />
```

Ajouter `panelId?: string;` à l'interface `ClipWindow` importée n'est pas nécessaire — `clipWindows` est un littéral local, TypeScript infère le champ supplémentaire sans modifier `clip-transitions.ts`.

- [ ] **Step 3: Vérifier les types et la suite existante**

Run: `npx tsc --noEmit && npx vitest run lib/whiteboard-animation lib/storyboard`
Expected: `tsc` sans sortie ; tests au vert.

- [ ] **Step 4: Vérifier à l'œil**

Sur une frontière avec transition et blanc non nul : glisser le bord droit de la carte l'élargit jusqu'à la largeur du blanc, pas au-delà ; relâcher et rouvrir le sélecteur de transition confirme que `durationMs` a changé.

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/components/clip-transition-markers.tsx lib/whiteboard-animation/components/whiteboard-editor-step.tsx
git commit -m "feat: resize a clip transition by dragging its card's edge"
```

---

## Vérification finale

- [ ] `npx tsc --noEmit` — sans sortie
- [ ] `npx vitest run` — suite complète au vert
- [ ] Un projet enregistré AVANT ce travail s'ouvre et s'édite sans régression (trim, delete, split, reorder sur un clip quelconque de la timeline chaînée)

## Points laissés ouverts par la spec

- Aucune UI pour créer une transition depuis la timeline elle-même : elle reste réglée via le sélecteur (`clip-transition-picker.tsx`), la carte n'apparaît qu'ensuite.
- Aucun geste dédié pour régler `gapBeforeMs` depuis la carte de transition — seul le trim de bord gauche d'annotation (Task 1) le fait.
