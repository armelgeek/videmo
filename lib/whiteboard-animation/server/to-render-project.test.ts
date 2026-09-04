import { describe, expect, it } from "vitest";
import { toRenderProject } from "./to-render-project";

const config: any = {
  animStyle: "contour",
  handStyle: "custom1",
  canvasBg: "white",
  annotations: [],
  annotationConfig: {},
  audio: {
    url: "blob:x",
    persistUrl: "data:audio/mp3;base64,AAA",
    volume: 1, muted: false, durationMs: 5000,
  },
  transcript: [],
};

const panel = (id: string, from: number, to: number): any => ({
  id,
  imageUrl: `/img/${id}.png`,
  annotations: [
    {
      id: `${id}-a`,
      region: { x: 0, y: 0, width: 10, height: 10 },
      reveal: { from, to, durationMs: to - from },
    },
  ],
});

describe("toRenderProject", () => {
  it("fait une scene par panneau, dans l'ordre", () => {
    const p = toRenderProject({ panels: [panel("p1", 0, 400), panel("p2", 400, 900)], config });
    expect(p.scenes.map((s) => s.id)).toEqual(["p1", "p2"]);
    expect(p.scenes[0].canvasImage).toBe("/img/p1.png");
  });

  it("reprend le style, la main et la cadence depuis la config", () => {
    const p = toRenderProject({ panels: [panel("p1", 0, 400)], config });
    expect(p).toMatchObject({ animStyle: "contour", hand: "custom1", speed: 40 });
  });

  it("prend l'audio persistable et non l'URL blob, illisible hors de l'onglet", () => {
    const p = toRenderProject({ panels: [panel("p1", 0, 400)], config });
    expect(p.narration?.audioUrl).toBe("data:audio/mp3;base64,AAA");
  });

  it("accepte l'absence d'audio", () => {
    const p = toRenderProject({ panels: [panel("p1", 0, 400)], config: { ...config, audio: null } });
    expect(p.narration).toBeNull();
  });

  it("retombe sur les annotations globales si un panneau n'en a pas", () => {
    const sans: any = { id: "p1", imageUrl: "/img/p1.png", annotations: [] };
    const cfg = {
      ...config,
      annotations: [
        { id: "g", region: { x: 0, y: 0, width: 5, height: 5 }, reveal: { from: 0, to: 100, durationMs: 100 } },
      ],
    };
    const p = toRenderProject({ panels: [sans], config: cfg });
    expect(p.scenes[0].annotations).toHaveLength(1);
  });

  it("chaine les bornes absolues d'une scene a l'autre", () => {
    // toEngineAnnotations met from/to/startMs a ZERO : ce sont des remplacants,
    // deriveTimeline est cense les recalculer. Sans cela le moteur lit une
    // fenetre de 1 ms par annotation (bornes() force to = from + 1), chaque
    // scene ne recoit qu'UNE image — son etat initial — et la video sort
    // blanche et vide.
    const p = toRenderProject({
      panels: [panel("p1", 0, 400), panel("p2", 0, 500)],
      config,
    });
    const bornes = p.scenes.map((s) =>
      (s.annotations as any[]).map((a) => [a.reveal.from, a.reveal.to]),
    );
    expect(bornes).toEqual([[[0, 400]], [[400, 900]]]);
  });

  it("honore le silence demande avant une annotation", () => {
    const avecGap: any = {
      id: "p2",
      imageUrl: "/img/p2.png",
      annotations: [
        {
          id: "p2-a",
          region: { x: 0, y: 0, width: 10, height: 10 },
          reveal: { durationMs: 500, gapBeforeMs: 200 },
        },
      ],
    };
    const p = toRenderProject({ panels: [panel("p1", 0, 400), avecGap], config });
    const s2 = (p.scenes[1].annotations as any[])[0];
    expect([s2.reveal.from, s2.reveal.to]).toEqual([600, 1100]);
  });

  it("rend un projet sans scene si aucun panneau", () => {
    expect(toRenderProject({ panels: [], config }).scenes).toEqual([]);
  });
});
