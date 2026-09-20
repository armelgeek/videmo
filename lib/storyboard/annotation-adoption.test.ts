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
  it("maps an image region into the preview canvas", () => {
    const [annotation] = adoptPlannedAnnotations({
      panelId: "p0",
      planned: [planned()],
      imageSize: image,
      canvas: canvas16x9,
    });

    // 1536x1024 fits as 1080x720 in a 1280x720 canvas, centered.
    expect(annotation.region).toEqual({ x: 100, y: 0, width: 1080, height: 720 });
  });

  it("keeps the text and measured duration of the narration beat", () => {
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

  it("gives a stable id, to replace instead of duplicate", () => {
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

  it("tells apart zones of the SAME beat without breaking earlier ids", () => {
    // The rank only appears from the second one: the first keeps the id it
    // had when a beat had a single zone, so it is replaced instead of
    // duplicated.
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

  it("keeps customized animation style and color on replanning", () => {
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

  it("keeps what the user drew by hand", () => {
    const handDrawn = {
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
      existing: [handDrawn],
    });

    // After the beats: order carries timing, placing it before would shift
    // the voice of all the following ones.
    expect(result.map((a) => a.id)).toEqual(["p0-beat-0", "mienne"]);
  });

  it("respects a ratio different from the image's", () => {
    const [annotation] = adoptPlannedAnnotations({
      panelId: "p0",
      planned: [planned()],
      imageSize: image,
      canvas: { width: 720, height: 1280 },
    });

    // The drawing fits the width and is centered vertically: never distorted.
    expect(annotation.region).toEqual({ x: 0, y: 400, width: 720, height: 480 });
  });
});

const panel = (over: Partial<StoryboardPanel> = {}): StoryboardPanel =>
  ({ id: "p", imageUrl: "", prompt: "p", duration: 5, isGenerating: false, ...over }) as StoryboardPanel;

describe("transcriptFromPanels", () => {
  it("chains beats on the project clock, across scenes", () => {
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

  it("lets a silent annotation take its time without producing a cue", () => {
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

  it("accounts for the silence requested before an annotation", () => {
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
