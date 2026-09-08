import { describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/whiteboard-animation/schema";
import {
  PLANNED_SOURCE,
  adoptPlannedAnnotations,
  transcriptFromPanels,
} from "./annotation-adoption";
import type { PlannedAnnotation } from "./annotation-planning";
import type { StoryboardPanel } from "./schema";

const planned = (over: Partial<PlannedAnnotation> = {}): PlannedAnnotation => ({
  text: "Le grain de cafe.",
  beatIndex: 0,
  region: { x: 0, y: 0, width: 1536, height: 1024 },
  reveal: { startMs: 0, durationMs: 6552 },
  ...over,
});

const image = { width: 1536, height: 1024 };
const canvas16x9 = { width: 1280, height: 720 };

describe("adoptPlannedAnnotations", () => {
  it("ramene une region de l'image dans le canvas d'apercu", () => {
    const [annotation] = adoptPlannedAnnotations({
      panelId: "p0",
      planned: [planned()],
      imageSize: image,
      canvas: canvas16x9,
    });

    // 1536x1024 tient en 1080x720 dans un canvas 1280x720, centre.
    expect(annotation.region).toEqual({ x: 100, y: 0, width: 1080, height: 720 });
  });

  it("garde le texte et la duree mesuree du temps de narration", () => {
    const [annotation] = adoptPlannedAnnotations({
      panelId: "p0",
      planned: [planned()],
      imageSize: image,
      canvas: canvas16x9,
    });

    expect(annotation.text).toBe("Le grain de cafe.");
    expect(annotation.reveal.durationMs).toBe(6552);
    expect(annotation.metadata).toEqual({ source: PLANNED_SOURCE, beatIndex: 0 });
  });

  it("donne un identifiant stable, pour remplacer au lieu de dupliquer", () => {
    const args = {
      panelId: "p0",
      planned: [planned(), planned({ text: "Deux.", beatIndex: 1 })],
      imageSize: image,
      canvas: canvas16x9,
    };

    const first = adoptPlannedAnnotations(args);
    const second = adoptPlannedAnnotations({ ...args, existing: first });

    expect(second).toHaveLength(2);
    expect(second.map((a) => a.id)).toEqual(["p0-beat-0", "p0-beat-1"]);
  });

  it("distingue les zones d'un MEME temps sans casser les identifiants d'avant", () => {
    // Le rang n'apparait qu'a partir de la seconde : la premiere garde
    // l'identifiant qu'elle avait quand un temps n'avait qu'une zone, donc
    // elle se remplace au lieu de se dupliquer.
    const args = {
      panelId: "p0",
      planned: [
        planned({ text: "Grain", beatIndex: 0 }),
        planned({ text: "Table", beatIndex: 0 }),
        planned({ text: "Tasse", beatIndex: 1 }),
      ],
      imageSize: image,
      canvas: canvas16x9,
    };

    const first = adoptPlannedAnnotations(args);
    const second = adoptPlannedAnnotations({ ...args, existing: first });

    expect(second.map((a) => a.id)).toEqual([
      "p0-beat-0",
      "p0-beat-0-1",
      "p0-beat-1",
    ]);
    expect(second).toHaveLength(3);
  });

  it("conserve le style d'animation et la couleur personnalises lors d'une replanification", () => {
    const args = {
      panelId: "p0",
      planned: [planned({ text: "Grain", beatIndex: 0 })],
      imageSize: image,
      canvas: canvas16x9,
      existing: [
        {
          id: "p0-beat-0",
          text: "Grain ancien",
          region: { x: 0, y: 0, width: 100, height: 100 },
          reveal: { durationMs: 1000, startMs: 0, gapBeforeMs: 0 },
          style: { strokeColor: "#0066FF", strokeWidth: 4, opacity: 0.8 },
          animStyle: "scribble",
          metadata: { source: "plan", beatIndex: 0 },
        },
      ],
    };

    const result = adoptPlannedAnnotations(args);

    expect(result[0].animStyle).toBe("scribble");
    expect(result[0].style.strokeColor).toBe("#0066FF");
    expect(result[0].style.strokeWidth).toBe(4);
  });

  it("conserve ce que l'utilisateur a dessine a la main", () => {
    const aLaMain = {
      id: "mienne",
      text: "Ma fleche",
      region: { x: 10, y: 10, width: 50, height: 50 },
      reveal: { durationMs: 800 },
      style: { strokeColor: "#f00", strokeWidth: 3, opacity: 1 },
    } as Annotation;

    const result = adoptPlannedAnnotations({
      panelId: "p0",
      planned: [planned()],
      imageSize: image,
      canvas: canvas16x9,
      existing: [aLaMain],
    });

    // Apres les temps : l'ordre porte le temps, la placer avant decalerait la
    // voix de tous ceux qui suivent.
    expect(result.map((a) => a.id)).toEqual(["p0-beat-0", "mienne"]);
  });

  it("respecte un ratio different de celui de l'image", () => {
    const [annotation] = adoptPlannedAnnotations({
      panelId: "p0",
      planned: [planned()],
      imageSize: image,
      canvas: { width: 720, height: 1280 },
    });

    // Le dessin tient en largeur et se centre verticalement : jamais deforme.
    expect(annotation.region).toEqual({ x: 0, y: 400, width: 720, height: 480 });
  });
});

const panel = (over: Partial<StoryboardPanel> = {}): StoryboardPanel =>
  ({ id: "p", imageUrl: "", prompt: "p", duration: 5, isGenerating: false, ...over }) as StoryboardPanel;

describe("transcriptFromPanels", () => {
  it("chaine les temps sur l'horloge du projet, scenes comprises", () => {
    const cues = transcriptFromPanels([
      panel({
        id: "a",
        annotations: [
          { id: "a0", text: "Un.", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: { durationMs: 1000 } },
          { id: "a1", text: "Deux.", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: { durationMs: 2000 } },
        ] as Annotation[],
      }),
      panel({
        id: "b",
        annotations: [
          { id: "b0", text: "Trois.", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: { durationMs: 500 } },
        ] as Annotation[],
      }),
    ]);

    expect(cues).toEqual([
      { id: "cue-a0", startMs: 0, endMs: 1000, text: "Un.", annotationId: "a0" },
      { id: "cue-a1", startMs: 1000, endMs: 3000, text: "Deux.", annotationId: "a1" },
      { id: "cue-b0", startMs: 3000, endMs: 3500, text: "Trois.", annotationId: "b0" },
    ]);
  });

  it("laisse une annotation muette occuper son temps sans produire de cue", () => {
    const cues = transcriptFromPanels([
      panel({
        annotations: [
          { id: "x", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: { durationMs: 1000 } },
          { id: "y", text: "Apres.", region: { x: 0, y: 0, width: 1, height: 1 }, reveal: { durationMs: 500 } },
        ] as Annotation[],
      }),
    ]);

    expect(cues).toEqual([
      { id: "cue-y", startMs: 1000, endMs: 1500, text: "Apres.", annotationId: "y" },
    ]);
  });

  it("tient compte du silence demande avant une annotation", () => {
    const cues = transcriptFromPanels([
      panel({
        annotations: [
          {
            id: "z",
            text: "Plus tard.",
            region: { x: 0, y: 0, width: 1, height: 1 },
            reveal: { durationMs: 1000, gapBeforeMs: 250 },
          },
        ] as Annotation[],
      }),
    ]);

    expect(cues[0]).toMatchObject({ startMs: 250, endMs: 1250 });
  });
});
