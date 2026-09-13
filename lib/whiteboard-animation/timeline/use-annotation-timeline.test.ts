import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnnotationTimeline } from "./use-annotation-timeline";
import { useUnifiedEngineStore } from "@/lib/unified-engine/context";
import { useStoryboardStore } from "@/lib/storyboard/store";
import type { Annotation } from "@/lib/unified-engine/types";
import type { Annotation as StoredAnnotation } from "@/lib/whiteboard-animation/schema";
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
type StyleComplet = { strokeColor: string; strokeWidth: number; opacity: number };
const chaineGlobale = (): (Omit<Annotation, "style"> & { style: StyleComplet })[] => [
  { id: "p0-a", text: "A", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: rev(1000), style: { strokeColor: "#000", strokeWidth: 1, opacity: 1 } },
  { id: "p0-b", text: "B", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: rev(1000), style: { strokeColor: "#000", strokeWidth: 1, opacity: 1 } },
  { id: "p1-a", text: "C", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: rev(1000), style: { strokeColor: "#000", strokeWidth: 1, opacity: 1 } },
  { id: "p1-b", text: "D", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: rev(1000), style: { strokeColor: "#000", strokeWidth: 1, opacity: 1 } },
];

/**
 * Un panneau reel ne stocke jamais l'id GLOBAL (prefixe pN-) : celui-ci n'est
 * cree qu'a la construction de la chaine dans whiteboard-editor-step.tsx. On
 * retire donc le prefixe ici, exactement comme le fait `panneauDe` en sens
 * inverse cote implementation.
 */
const idLocal = (id: string) => id.replace(/^p\d+-/, "");

const panneau = (
  id: string,
  annotations: (Omit<Annotation, "style"> & { style: StyleComplet })[],
): StoryboardPanel => ({
  id,
  imageUrl: "/x.png",
  prompt: "x",
  duration: 5,
  isGenerating: false,
  annotations: annotations.map((a): StoredAnnotation => ({
    id: idLocal(a.id),
    text: a.text,
    region: a.region,
    reveal: { durationMs: a.reveal.durationMs, gapBeforeMs: a.reveal.gapBeforeMs ?? 0 },
    style: a.style ?? { strokeColor: "#000", strokeWidth: 1, opacity: 1 },
  })),
});

describe("useAnnotationTimeline — routage d'ecriture multi-panneaux", () => {
  beforeEach(() => {
    const glob = chaineGlobale();
    // Le store moteur porte TOUTES les scenes a plat, chacune taguee de son
    // panelId — comme le fait whiteboard-editor-step.tsx au chargement.
    useUnifiedEngineStore.setState((s) => ({
      animation: {
        ...s.animation,
        annotations: [
          ...glob.slice(0, 2).map((a) => ({ ...a, panelId: "panel-0" })),
          ...glob.slice(2, 4).map((a) => ({ ...a, panelId: "panel-1" })),
        ],
      },
      ui: { ...s.ui, activeScenePanelId: "panel-0" },
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

  it("une edition sur le panneau NON actif ne touche que sa propre tranche du store moteur", () => {
    const glob = chaineGlobale();
    const { result } = renderHook(() => useAnnotationTimeline(glob));

    const avant = useUnifiedEngineStore.getState().animation.annotations;
    const trancheAvant0 = avant.filter((a) => a.panelId === "panel-0");

    act(() => {
      result.current.onClipUpdate("p1-a", { start: 2.8, duration: 1, offset: 0 });
    });

    const apres = useUnifiedEngineStore.getState().animation.annotations;
    // Le tableau porte toutes les scenes : la tranche du panneau ACTIF (0)
    // reste inchangee, seule celle du panneau edite (1) bouge.
    expect(apres.filter((a) => a.panelId === "panel-0")).toEqual(trancheAvant0);
    // Le tableau plat garde les ids LOCAUX au panneau (pas le prefixe pN-,
    // propre a la chaine globale d'affichage) : "a" correspond a "p1-a".
    expect(
      apres.find((a) => a.panelId === "panel-1" && a.id === "a")?.reveal.gapBeforeMs,
    ).toBeGreaterThan(0);
  });

  it("materialise le clip de repli d'une image sans annotation", () => {
    const glob = chaineGlobale();
    // Le panneau 1 perd ses annotations : la timeline n'y montre plus que le
    // clip pleine image, construit par whiteboard-editor-step.tsx.
    useStoryboardStore.setState({
      storyboardPanels: [
        panneau("panel-0", glob.slice(0, 2)),
        { ...panneau("panel-1", []), duration: 4 },
      ],
    });

    const repli: Annotation = {
      id: "p1-pleine-image",
      text: "",
      region: { x: 0, y: 0, width: 1280, height: 720 },
      reveal: rev(4000),
    };
    const { result } = renderHook(() =>
      useAnnotationTimeline([...glob.slice(0, 2), repli]),
    );

    act(() => {
      result.current.onClipUpdate("p1-pleine-image", { duration: 1.5 });
    });

    const panel1 = useStoryboardStore.getState().storyboardPanels[1];
    expect(panel1.annotations).toHaveLength(1);
    expect(panel1.annotations?.[0].id).toBe("pleine-image");
    expect(panel1.annotations?.[0].reveal.durationMs).toBe(1500);
    expect(panel1.annotations?.[0].region).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
  });

  it("une edition sur le panneau ACTIF met a jour le store moteur ET le panneau", () => {
    const glob = chaineGlobale();
    const { result } = renderHook(() => useAnnotationTimeline(glob));

    act(() => {
      // resize-duration sur "p0-b", 2e annotation du panneau ACTIF (0).
      result.current.onClipUpdate("p0-b", { duration: 1.5 });
    });

    // Le store moteur porte des ids LOCAUX : c'est deja ce que
    // whiteboard-editor-step.tsx y ecrit par ailleurs (activePanelAnnotations
    // vient de toEngineAnnotations(panel.annotations), sans prefixe pN-).
    const store = useUnifiedEngineStore.getState().animation.annotations;
    expect(store.find((a) => a.id === "b")?.reveal.durationMs).toBe(1500);

    const panel0 = useStoryboardStore.getState().storyboardPanels[0];
    expect(panel0.annotations?.find((a) => a.id === "b")?.reveal.durationMs).toBe(1500);
  });
});
