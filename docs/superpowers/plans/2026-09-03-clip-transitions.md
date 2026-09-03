# Transitions entre clips — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adoucir le passage d'un clip whiteboard au suivant en fondant le clip sortant vers le fond, dans le blanc qui les sépare déjà.

**Architecture:** Une fonction pure décide, à partir des frontières de clips et de l'horloge globale, s'il y a une transition en cours et où elle en est. Le renderer ne fait qu'appliquer par-dessus le dessin composé la primitive de `transitions.js` correspondante. La durée est plafonnée au blanc disponible, donc la vidéo n'est jamais allongée.

**Tech Stack:** TypeScript strict, React, Zustand, Zod, Vitest, canvas 2D.

**Spec:** `docs/superpowers/specs/2026-09-03-clip-transitions-design.md`

## Global Constraints

- La durée totale de la vidéo ne change JAMAIS. Durée effective d'une transition : `min(durationMs configuré, B.startMs − A.endMs)`.
- Un seul moteur d'animation actif à tout instant. Jamais deux illustrations en mémoire.
- Le côté « entrant » du fondu est le FOND (`paintBackground`), jamais le clip suivant.
- Importer les modules moteur depuis `../lib/` (ex. `require('../lib/transitions')`). Ne PAS toucher au duplicat `lib/whiteboard-animation/*.js`.
- Transition absente ou `type: 'none'` ⇒ coupe franche. Les projets existants ne changent pas de comportement.
- Tests colocalisés : `foo.ts` à côté de `foo.test.ts`, avec `import { describe, expect, it } from "vitest"`.
- Commandes : `npx vitest run <chemin>` pour les tests, `npx tsc --noEmit` pour les types.

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `lib/whiteboard-animation/timeline/clip-transitions.ts` (créé) | Types publics + décision pure : y a-t-il une transition à cet instant, et où en est-elle |
| `lib/whiteboard-animation/timeline/clip-transitions.test.ts` (créé) | Plafonnement, bornes, cas nuls |
| `lib/storyboard/schema.ts` (modifié) | Champ `transition` sur le panneau, validé par Zod |
| `lib/storyboard/schema.test.ts` (créé) | Un projet sans `transition` reste valide |
| `lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts` (modifié) | Prop `clips`, instantané, post-composition en lecture et au scrub |
| `lib/whiteboard-animation/components/clip-transition-picker.tsx` (créé) | Choix de la transition du clip actif |
| `lib/whiteboard-animation/components/whiteboard-editor-step.tsx` (modifié) | Fournit `clips` au renderer, monte le sélecteur |

---

### Task 1: Décision pure — `clip-transitions.ts`

**Files:**
- Create: `lib/whiteboard-animation/timeline/clip-transitions.ts`
- Test: `lib/whiteboard-animation/timeline/clip-transitions.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `type TransitionName`, `interface Transition { type: TransitionName; durationMs: number }`, `interface ClipWindow { startMs: number; endMs: number; transition?: Transition }`, `interface ActiveTransition { name: TransitionName; t: number }`, `function transitionAt(clips: ClipWindow[], globalMs: number): ActiveTransition | null`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/whiteboard-animation/timeline/clip-transitions.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { transitionAt, type ClipWindow } from "./clip-transitions";

/** A finit a 1000, B commence a 1300 : le blanc disponible vaut 300 ms. */
const paire = (): ClipWindow[] => [
  { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 2300 } },
  { startMs: 1300, endMs: 2000 },
];

describe("transitionAt", () => {
  it("plafonne la duree au blanc disponible", () => {
    // 2300 ms demandes, 300 ms disponibles. A mi-blanc (1150), t doit valoir
    // 0.5 ; si la duree demandee etait honoree, t vaudrait ~0.065.
    expect(transitionAt(paire(), 1150)).toEqual({ name: "fade", t: 0.5 });
  });

  it("demarre a 0 des la fin du clip sortant", () => {
    expect(transitionAt(paire(), 1000)).toEqual({ name: "fade", t: 0 });
  });

  it("s'arrete avant le debut du clip entrant", () => {
    expect(transitionAt(paire(), 1299)).not.toBeNull();
    expect(transitionAt(paire(), 1300)).toBeNull();
  });

  it("ne rend rien a l'interieur d'un clip", () => {
    expect(transitionAt(paire(), 500)).toBeNull();
  });

  it("ignore un clip marque none", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "none", durationMs: 300 } },
      { startMs: 1300, endMs: 2000 },
    ];
    expect(transitionAt(clips, 1150)).toBeNull();
  });

  it("ignore deux clips jointifs, faute de blanc", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 300 } },
      { startMs: 1000, endMs: 2000 },
    ];
    expect(transitionAt(clips, 1000)).toBeNull();
  });

  it("ne rend rien apres le dernier clip", () => {
    expect(transitionAt(paire(), 2500)).toBeNull();
  });

  it("honore une duree plus courte que le blanc", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "slideup", durationMs: 100 } },
      { startMs: 1300, endMs: 2000 },
    ];
    expect(transitionAt(clips, 1050)).toEqual({ name: "slideup", t: 0.5 });
    expect(transitionAt(clips, 1200)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/whiteboard-animation/timeline/clip-transitions.test.ts`
Expected: FAIL — `Failed to resolve import "./clip-transitions"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/whiteboard-animation/timeline/clip-transitions.ts` :

```ts
/**
 * Decide s'il y a une transition en cours a un instant donne, et ou elle en est.
 *
 * La transition se loge dans le BLANC qui separe deja deux clips, plafonnee a
 * sa largeur : la duree totale de la video ne change donc jamais, et la
 * narration ne derive pas. Une transition plus longue s'obtient en allongeant
 * ce blanc a l'ecriture, pas en debordant sur les clips.
 */

export type TransitionName =
  | "none"
  | "cut"
  | "fade"
  | "slideup"
  | "slidedown"
  | "slideleft"
  | "slideright";

export interface Transition {
  type: TransitionName;
  /** Duree souhaitee. Plafonnee au blanc reellement disponible. */
  durationMs: number;
}

/** Fenetre d'un clip sur l'horloge globale, avec sa transition de SORTIE. */
export interface ClipWindow {
  startMs: number;
  endMs: number;
  transition?: Transition;
}

export interface ActiveTransition {
  name: TransitionName;
  /** 0 au debut de la fenetre, tend vers 1 a sa fin. */
  t: number;
}

export function transitionAt(
  clips: ClipWindow[],
  globalMs: number,
): ActiveTransition | null {
  for (let i = 0; i < clips.length - 1; i++) {
    const sortant = clips[i];
    const entrant = clips[i + 1];

    const transition = sortant.transition;
    if (!transition || transition.type === "none") continue;

    const blanc = entrant.startMs - sortant.endMs;
    if (blanc <= 0) continue;

    const duree = Math.min(transition.durationMs, blanc);
    if (duree <= 0) continue;

    const ecoule = globalMs - sortant.endMs;
    if (ecoule < 0 || ecoule >= duree) continue;

    return { name: transition.type, t: ecoule / duree };
  }

  return null;
}
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run lib/whiteboard-animation/timeline/clip-transitions.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/timeline/clip-transitions.ts lib/whiteboard-animation/timeline/clip-transitions.test.ts
git commit -m "feat: decide when a clip transition is playing and how far along"
```

---

### Task 2: Champ `transition` sur le panneau storyboard

**Files:**
- Modify: `lib/storyboard/schema.ts:23-40` (`storyboardPanelSchema`)
- Test: `lib/storyboard/schema.test.ts`

**Interfaces:**
- Consumes: `TransitionName` de la Task 1.
- Produces: `transitionSchema` (Zod), et le champ optionnel `transition` sur `StoryboardPanel`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `lib/storyboard/schema.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { storyboardPanelSchema } from "./schema";

const panneau = {
  id: "p1",
  imageUrl: "/a.png",
  prompt: "un sac",
};

describe("storyboardPanelSchema", () => {
  it("accepte un panneau sans transition — les projets existants restent valides", () => {
    const parsed = storyboardPanelSchema.parse(panneau);
    expect(parsed.transition).toBeUndefined();
  });

  it("accepte une transition complete", () => {
    const parsed = storyboardPanelSchema.parse({
      ...panneau,
      transition: { type: "slideup", durationMs: 300 },
    });
    expect(parsed.transition).toEqual({ type: "slideup", durationMs: 300 });
  });

  it("refuse un nom de transition inconnu", () => {
    expect(() =>
      storyboardPanelSchema.parse({
        ...panneau,
        transition: { type: "explode", durationMs: 300 },
      }),
    ).toThrow();
  });

  it("refuse une duree negative", () => {
    expect(() =>
      storyboardPanelSchema.parse({
        ...panneau,
        transition: { type: "fade", durationMs: -1 },
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run lib/storyboard/schema.test.ts`
Expected: FAIL — le 2e test échoue (`transition` est retiré par Zod, `toEqual` reçoit `undefined`), et les 3e/4e ne lèvent pas.

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `lib/storyboard/schema.ts`, ajouter après l'import existant de `AnnotationSchema` :

```ts
import type { TransitionName } from "@/lib/whiteboard-animation/timeline/clip-transitions";

/**
 * `satisfies` verrouille cette liste sur le type de la Task 1 : ajouter ici un
 * nom que TransitionName ne connait pas casse la compilation, plutot que de
 * laisser les deux definitions diverger en silence.
 */
const TRANSITION_NAMES = [
  "none",
  "cut",
  "fade",
  "slideup",
  "slidedown",
  "slideleft",
  "slideright",
] as const satisfies readonly TransitionName[];

export const transitionSchema = z.object({
  type: z.enum(TRANSITION_NAMES),
  durationMs: z.number().nonnegative(),
});
```

Puis, dans `storyboardPanelSchema`, ajouter à la suite de `annotations` :

```ts
  transition: transitionSchema.optional(),
```

- [ ] **Step 4: Lancer les tests et la vérification de types**

Run: `npx vitest run lib/storyboard/schema.test.ts && npx tsc --noEmit`
Expected: PASS — 4 tests, et `tsc` sans sortie.

- [ ] **Step 5: Commit**

```bash
git add lib/storyboard/schema.ts lib/storyboard/schema.test.ts
git commit -m "feat: carry an optional exit transition on each storyboard panel"
```

---

### Task 3: Post-composition pendant la lecture

**Files:**
- Modify: `lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts` (props, helpers, boucle rAF ligne 862-870)
- Modify: `lib/whiteboard-animation/components/whiteboard-editor-step.tsx` (fournir `clips`)

**Interfaces:**
- Consumes: `transitionAt`, `ClipWindow`, `ActiveTransition` de la Task 1 ; le champ `transition` de la Task 2.
- Produces: la prop `clips?: ClipWindow[]` sur `useWhiteboardRenderer`.

Non couvert par des tests : c'est du dessin canvas, comme tout le rendu de ce projet. Vérification à l'œil.

- [ ] **Step 1: Déclarer la prop et les tampons**

Dans `use-whiteboard-renderer.ts`, ajouter en tête du fichier, près des autres `require` moteur :

```ts
const { resoudreTransition } = require('../lib/transitions');
```

et l'import de la Task 1 :

```ts
import { transitionAt, type ClipWindow } from '../timeline/clip-transitions';
```

Dans `UseWhiteboardRendererProps`, après `clipOffsetMs` :

```ts
  /**
   * Sequence complete, pour savoir ou tombent les blancs entre clips.
   * clipOffsetMs reste par ailleurs inchange : il designe le clip ACTIF et sert
   * a passer de l'horloge globale a l'horloge locale du moteur.
   */
  clips?: ClipWindow[];
```

Dans la signature déstructurée, après `clipOffsetMs = 0,` :

```ts
  clips = [],
```

- [ ] **Step 2: Ajouter les tampons et le helper d'application**

Après la définition de `paintBackground` (ligne 374), ajouter :

```ts
  // Lue depuis la closure rAF, qui ne se reconstruit pas a chaque rendu.
  const clipsRef = useRef<ClipWindow[]>(clips);
  clipsRef.current = clips;

  const snapshotRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotValideRef = useRef(false);
  const fondRef = useRef<HTMLCanvasElement | null>(null);

  const canvasTampon = (
    ref: React.MutableRefObject<HTMLCanvasElement | null>,
    w: number,
    h: number,
  ) => {
    let c = ref.current;
    if (!c) {
      c = document.createElement('canvas');
      ref.current = c;
    }
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    return c;
  };

  /**
   * Applique la transition PAR-DESSUS le dessin deja compose.
   *
   * Le cote entrant est le FOND, pas le clip suivant : pendant le blanc, le
   * sortant a fini de tracer et l'entrant n'a rien a montrer. La transition lit
   * donc « le sortant s'en va ».
   */
  const appliquerTransition = (
    active: { name: string; t: number },
    ctx: CanvasRenderingContext2D,
    sortante: HTMLCanvasElement,
    w: number,
    h: number,
  ) => {
    const fn = resoudreTransition(active.name);
    if (!fn) return;

    const fond = canvasTampon(fondRef, w, h);
    const fctx = fond.getContext('2d');
    if (!fctx) return;
    fctx.clearRect(0, 0, w, h);
    paintBackground(fctx, w, h);

    ctx.clearRect(0, 0, w, h);
    fn(ctx, sortante, fond, active.t, w, h);
  };
```

- [ ] **Step 3: Appliquer la transition dans la boucle rAF**

Dans `use-whiteboard-renderer.ts`, juste APRÈS le bloc `if (drawingDoneRef.current) { … } else { … }` qui se termine ligne 870, insérer :

```ts
      // Post-composition. Pendant un blanc le moteur ne dessine plus — le bloc
      // ci-dessus a pris la branche « image tenue » — donc le canvas porte
      // encore la derniere image du clip sortant. On la fige au premier passage,
      // puis on repeint depuis elle a chaque frame : sans instantane, la frame
      // suivante fondrait le resultat du fondu precedent.
      const enTransition = transitionAt(
        clipsRef.current,
        useUnifiedEngineStore.getState().timeline.currentTime,
      );
      if (enTransition) {
        const snap = canvasTampon(snapshotRef, canvas.width, canvas.height);
        if (!snapshotValideRef.current) {
          const sctx = snap.getContext('2d');
          if (sctx) {
            sctx.clearRect(0, 0, snap.width, snap.height);
            sctx.drawImage(canvas, 0, 0);
          }
          snapshotValideRef.current = true;
        }
        appliquerTransition(enTransition, ctx, snap, canvas.width, canvas.height);
        hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      } else {
        snapshotValideRef.current = false;
      }
```

- [ ] **Step 4: Fournir `clips` depuis le composant**

Dans `whiteboard-editor-step.tsx`, `panelBoundaries` produit déjà `{ panelIdx, startMs, endMs }`. Ajouter juste après ce `useMemo` :

```tsx
  // Les frontieres, enrichies de la transition de sortie de chaque panneau.
  const clipWindows = useMemo(
    () =>
      panelBoundaries.map((b) => ({
        startMs: b.startMs,
        endMs: b.endMs,
        transition: storyboardPanels[b.panelIdx]?.transition,
      })),
    [panelBoundaries, storyboardPanels],
  );
```

Puis, dans l'appel à `useWhiteboardRenderer`, après la ligne `clipOffsetMs: …` :

```tsx
    clips: clipWindows,
```

- [ ] **Step 5: Vérifier les types et la suite existante**

Run: `npx tsc --noEmit && npx vitest run lib/whiteboard-animation`
Expected: `tsc` sans sortie ; tous les tests existants passent (aucun ne couvre le canvas, donc aucune régression attendue).

- [ ] **Step 6: Vérifier à l'œil**

Donner une transition à un clip, par exemple via la console du navigateur ou en éditant les données de départ, puis lire la séquence. Attendu : à la fin du clip, son dessin s'estompe vers le fond pendant ~300 ms, puis le clip suivant se trace. Sans transition configurée : coupe franche, comme avant.

- [ ] **Step 7: Commit**

```bash
git add lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts lib/whiteboard-animation/components/whiteboard-editor-step.tsx
git commit -m "feat: fade the outgoing clip away during playback"
```

---

### Task 4: Post-composition au scrub

**Files:**
- Modify: `lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts` (fin de `repositionTo`, ligne 712-719)

**Interfaces:**
- Consumes: `transitionAt` (Task 1), `appliquerTransition` et `clipsRef` (Task 3).
- Produces: rien de nouveau.

- [ ] **Step 1: Appliquer la transition après le blit**

Dans `repositionTo`, juste APRÈS `hctx.drawImage(handBuffer, 0, 0);` et AVANT `engineTimeRef.current = targetMs;`, insérer :

```ts
    // Au scrub, pas besoin d'instantane : le rejeu vient de composer le clip
    // sortant jusqu'a la fin de son trace dans `buffer`, ce qui EST l'image
    // recherchee. Sans ce bloc, traverser une frontiere au curseur ne montrerait
    // aucune transition.
    const enTransition = transitionAt(clipsRef.current, targetMs);
    if (enTransition) {
      appliquerTransition(enTransition, ctx, buffer, canvas.width, canvas.height);
      hctx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    }
```

- [ ] **Step 2: Vérifier les types et la suite existante**

Run: `npx tsc --noEmit && npx vitest run lib/whiteboard-animation`
Expected: `tsc` sans sortie ; tests existants au vert.

- [ ] **Step 3: Vérifier à l'œil**

Déplacer le curseur lentement à travers une frontière de clip portant une transition. Attendu : le dessin du clip sortant s'efface progressivement à mesure qu'on avance dans le blanc, et réapparaît si on recule.

- [ ] **Step 4: Commit**

```bash
git add lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts
git commit -m "feat: show the transition while scrubbing across a clip boundary"
```

---

### Task 5: Choix de la transition dans l'interface

**Files:**
- Create: `lib/whiteboard-animation/components/clip-transition-picker.tsx`
- Modify: `lib/whiteboard-animation/components/whiteboard-editor-step.tsx` (colonne de droite)

**Interfaces:**
- Consumes: `TransitionName` (Task 1), le champ `transition` (Task 2).
- Produces: le composant `<ClipTransitionPicker />`, sans props.

- [ ] **Step 1: Écrire le composant**

Créer `lib/whiteboard-animation/components/clip-transition-picker.tsx` :

```tsx
"use client";

import { useStoryboardStore } from "@/lib/storyboard/store";
import type { TransitionName } from "../timeline/clip-transitions";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Transition de SORTIE du clip actif : ce qui se passe apres lui. */
const NOMS: { value: TransitionName; label: string }[] = [
  { value: "none", label: "Coupe franche" },
  { value: "fade", label: "Fondu" },
  { value: "slideup", label: "Glisse vers le haut" },
  { value: "slidedown", label: "Glisse vers le bas" },
  { value: "slideleft", label: "Glisse vers la gauche" },
  { value: "slideright", label: "Glisse vers la droite" },
];

const DUREE_PAR_DEFAUT_MS = 300;

export function ClipTransitionPicker() {
  const panels = useStoryboardStore((s) => s.storyboardPanels);
  const activeClipIndex = useStoryboardStore((s) => s.activeClipIndex);
  const updatePanel = useStoryboardStore((s) => s.updatePanel);

  const panel = panels[activeClipIndex];
  if (!panel) return null;

  const courant: TransitionName = panel.transition?.type ?? "none";

  return (
    <div className="space-y-2 border-t pt-3">
      <Label htmlFor="clip-transition" className="text-xs">
        Transition après ce clip
      </Label>
      <Select
        value={courant}
        onValueChange={(type) =>
          updatePanel(panel.id, {
            transition: {
              type: type as TransitionName,
              durationMs: panel.transition?.durationMs ?? DUREE_PAR_DEFAUT_MS,
            },
          })
        }
      >
        <SelectTrigger id="clip-transition">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NOMS.map((n) => (
            <SelectItem key={n.value} value={n.value}>
              {n.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Sa durée est plafonnée au silence disponible avant le clip suivant.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Monter le sélecteur**

Dans `whiteboard-editor-step.tsx`, ajouter l'import :

```tsx
import { ClipTransitionPicker } from "./clip-transition-picker";
```

Puis, dans la colonne de droite, entre `<WhiteboardConfigPanel … />` et `<AnnotationListPanel … />` :

```tsx
        <ClipTransitionPicker />
```

- [ ] **Step 3: Vérifier les types et la suite existante**

Run: `npx tsc --noEmit && npx vitest run lib/whiteboard-animation`
Expected: `tsc` sans sortie ; tests au vert.

- [ ] **Step 4: Vérifier à l'œil**

Sélectionner un clip, choisir « Fondu », puis lire. Attendu : le clip s'estompe à sa fin. Repasser à « Coupe franche » rétablit le comportement d'origine.

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/components/clip-transition-picker.tsx lib/whiteboard-animation/components/whiteboard-editor-step.tsx
git commit -m "feat: pick a clip's exit transition from the editor"
```

---

## Vérification finale

- [ ] `npx tsc --noEmit` — sans sortie
- [ ] `npx vitest run` — suite complète au vert
- [ ] Un projet enregistré AVANT ce travail s'ouvre et se lit à l'identique (aucune transition configurée ⇒ coupe franche)

## Point laissé ouvert par la spec

Au repos dans un blanc, en mode Édition, les cadres d'annotation du clip sortant restent affichés par-dessus un dessin à moitié effacé. C'est le comportement le plus simple et il est volontairement conservé ici ; à trancher à l'usage si cela gêne.
