import { describe, expect, it } from "vitest";
import {
  annotationPlanSchema,
  buildVisionPrompt,
  clampRegion,
  planAnnotations,
  snapRegionsToSubjects,
  snapToSubject,
  wholeImageRegion,
} from "./annotation-planning";
import type { ScriptScene } from "./script-generation";

const SIZE = { width: 1536, height: 1024 };

const scene: ScriptScene = {
  index: 0,
  clipType: "intro",
  title: "Le levain",
  imagePrompt: "a starter jar and a loaf",
  beats: [
    { narration: "Le levain est une culture vivante.", durationSec: 6 },
    { narration: "Il donne au pain son gout acidule.", durationSec: 4 },
  ],
  visualDescription: "",
  keyElements: [],
};

describe("clampRegion", () => {
  it("leaves a rectangle already inside the image untouched", () => {
    const r = clampRegion({ beatIndex: 0, x: 100, y: 200, width: 300, height: 400 }, SIZE);

    expect(r).toEqual({ beatIndex: 0, x: 100, y: 200, width: 300, height: 400 });
  });

  it("trims an overflowing rectangle", () => {
    // An out-of-frame region would make the pen draw in the void.
    const r = clampRegion({ beatIndex: 0, x: 1400, y: 900, width: 800, height: 800 }, SIZE);

    expect(r.x + r.width).toBeLessThanOrEqual(SIZE.width);
    expect(r.y + r.height).toBeLessThanOrEqual(SIZE.height);
  });

  it("brings negative coordinates back into the image", () => {
    const r = clampRegion({ beatIndex: 0, x: -50, y: -20, width: 200, height: 100 }, SIZE);

    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it("interprets a fractional answer as pixels", () => {
    // Vision models sometimes answer in image proportions.
    const r = clampRegion({ beatIndex: 1, x: 0.5, y: 0.25, width: 0.25, height: 0.5 }, SIZE);

    expect(r.x).toBe(768);
    expect(r.y).toBe(256);
    expect(r.width).toBe(384);
    expect(r.height).toBe(512);
  });

  it("never returns a zero width", () => {
    const r = clampRegion({ beatIndex: 0, x: 10, y: 10, width: -5, height: -5 }, SIZE);

    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});

describe("planAnnotations", () => {
  const regions = [
    { beatIndex: 0, x: 0, y: 0, width: 700, height: 1024 },
    { beatIndex: 1, x: 800, y: 0, width: 700, height: 1024 },
  ];

  it("starts each annotation after the previous ones", () => {
    // The entry time needs no model: it follows from the beats.
    const plan = planAnnotations({ scene, regions, size: SIZE });

    expect(plan[0].reveal).toEqual({ startMs: 0, durationMs: 6000 });
    expect(plan[1].reveal).toEqual({ startMs: 6000, durationMs: 4000 });
  });

  it("carries the text spoken while drawing", () => {
    const plan = planAnnotations({ scene, regions, size: SIZE });

    expect(plan[0].text).toBe("Le levain est une culture vivante.");
    expect(plan[1].text).toBe("Il donne au pain son gout acidule.");
  });

  it("covers the whole image when the scene has no beat", () => {
    const plan = planAnnotations({
      scene: { ...scene, beats: [] },
      regions: [],
      size: SIZE,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].region).toEqual({
      x: 0,
      y: 0,
      width: SIZE.width,
      height: SIZE.height,
    });
    expect(plan[0].reveal.startMs).toBe(0);
    expect(plan[0].reveal.durationMs).toBeGreaterThan(0);
  });

  it("syncs the beatless image to the measured voice", () => {
    const plan = planAnnotations({
      scene: { ...scene, beats: [] },
      regions: [],
      size: SIZE,
      beatDurationsMs: [3000, 2500],
    });

    expect(plan[0].reveal.durationMs).toBe(5500);
  });

  it("places each annotation on its zone", () => {
    const plan = planAnnotations({ scene, regions, size: SIZE });

    expect(plan[0].region.x).toBe(0);
    expect(plan[1].region.x).toBe(800);
  });

  it("keeps the whole image for a beat with no read region", () => {
    // A zone too wide beats a scene where nothing gets drawn.
    const plan = planAnnotations({ scene, regions: [regions[0]], size: SIZE });

    expect(plan[1].region).toEqual({ x: 0, y: 0, width: 1536, height: 1024 });
    expect(plan[1].reveal.startMs).toBe(6000);
  });

  it("trims an overflowing region coming from vision", () => {
    const plan = planAnnotations({
      scene,
      regions: [{ beatIndex: 0, x: 1500, y: 1000, width: 900, height: 900 }],
      size: SIZE,
    });

    expect(plan[0].region.x + plan[0].region.width).toBeLessThanOrEqual(1536);
  });

  it("syncs drawing to the actually measured duration", () => {
    // The breakdown estimated 6s then 5s; the produced audio lasts otherwise,
    // and it is what rules.
    const plan = planAnnotations({
      scene,
      regions,
      size: SIZE,
      beatDurationsMs: [5200, 3800],
    });

    expect(plan[0].reveal).toEqual({ startMs: 0, durationMs: 5200 });
    expect(plan[1].reveal).toEqual({ startMs: 5200, durationMs: 3800 });
  });

  it("falls back on the estimate when the measurement is missing", () => {
    const plan = planAnnotations({
      scene,
      regions,
      size: SIZE,
      beatDurationsMs: [5200],
    });

    expect(plan[0].reveal.durationMs).toBe(5200);
    expect(plan[1].reveal.durationMs).toBe(4000);
    expect(plan[1].reveal.startMs).toBe(5200);
  });

  it("ignores an aberrant measurement", () => {
    const plan = planAnnotations({
      scene,
      regions,
      size: SIZE,
      beatDurationsMs: [0, -1],
    });

    expect(plan[0].reveal.durationMs).toBe(6000);
    expect(plan[1].reveal.durationMs).toBe(4000);
  });

  it("returns one annotation per beat when each has a single zone", () => {
    expect(planAnnotations({ scene, regions: [], size: SIZE })).toHaveLength(2);
  });

  it("returns SEVERAL annotations for a beat naming several subjects", () => {
    // A narration often describes several drawn things. The old Map keyed by
    // beatIndex kept only one: the scene only ever got one rectangle per
    // sentence, framed so wide it covered the rest.
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, label: "Grain", x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 0, label: "Table", x: 400, y: 0, width: 300, height: 300 },
        { beatIndex: 1, label: "Tasse", x: 800, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
    });

    expect(plan).toHaveLength(3);
    expect(plan.map((a) => a.beatIndex)).toEqual([0, 0, 1]);
    expect(plan.map((a) => a.text)).toEqual(["Grain", "Table", "Tasse"]);
  });

  it("splits the beat time among its zones without losing a millisecond", () => {
    // The sum must equal the measured duration EXACTLY: a lost rounding would
    // carry over to all following beats.
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 0, x: 300, y: 0, width: 300, height: 300 },
        { beatIndex: 0, x: 600, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
      beatDurationsMs: [5000, 4000],
    });

    const beat0Annotations = plan.filter((a) => a.beatIndex === 0);
    expect(beat0Annotations.map((a) => a.reveal.durationMs)).toEqual([1666, 1666, 1668]);
    expect(
      beat0Annotations.reduce((total, a) => total + a.reveal.durationMs, 0),
    ).toBe(5000);
  });

  it("chains zones of the same beat without gaps", () => {
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 0, x: 300, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
      beatDurationsMs: [5000, 4000],
    });

    expect(plan.map((a) => a.reveal.startMs)).toEqual([0, 2500, 5000]);
  });

  it("does not repeat the sentence on each subject of the same beat", () => {
    // Without a label, only the first zone carries it: repeating it would fill
    // the list and transcript with the same line.
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 0, x: 300, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
    });

    expect(plan[0].text).toBe(scene.beats[0].narration);
    expect(plan[1].text).toBe("");
  });

  it("attaches a zone to the last beat if its index overflows, to lose nothing", () => {
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, label: "Un", x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 99, label: "Hors borne", x: 300, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
    });

    expect(plan).toHaveLength(2);
    expect(plan[1].beatIndex).toBe(1);
    expect(plan[1].text).toBe("Hors borne");
  });

  it("merges zones into a single enclosing one when total duration is too short (< 800ms)", () => {
    // A short 600ms beat with two 300ms zones each (< 400ms)
    // is merged into a single 600ms enclosing zone
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, label: "A", x: 100, y: 100, width: 100, height: 100 },
        { beatIndex: 0, label: "B", x: 300, y: 100, width: 100, height: 100 },
      ],
      size: SIZE,
      beatDurationsMs: [600, 4000],
    });

    const beat0 = plan.filter((a) => a.beatIndex === 0);
    expect(beat0).toHaveLength(1);
    expect(beat0[0].reveal.durationMs).toBe(600);
    // Enclosing zone spanning x=100 to x=400 (width 300)
    expect(beat0[0].region.x).toBe(100);
    expect(beat0[0].region.width).toBe(300);
  });
});

describe("wholeImageRegion", () => {
  it("covers the whole image", () => {
    expect(wholeImageRegion(3, SIZE)).toEqual({
      beatIndex: 3,
      x: 0,
      y: 0,
      width: 1536,
      height: 1024,
    });
  });
});

describe("snapToSubject", () => {
  // The two subjects of a real illustration: the bean, and the flame.
  const bean = { x: 309, y: 201, width: 426, height: 574 };
  const flame = { x: 1011, y: 361, width: 210, height: 330 };

  it("snaps a guessed rectangle onto the subject it overlaps", () => {
    // What gpt-4o returned for the flame beat: 200 px off.
    const guessed = { beatIndex: 1, x: 800, y: 300, width: 300, height: 500 };

    expect(snapToSubject(guessed, [bean, flame])).toEqual({
      beatIndex: 1,
      ...flame,
    });
  });

  it("picks the most overlapped subject when two are touched", () => {
    const guessed = { beatIndex: 0, x: 320, y: 210, width: 900, height: 400 };

    expect(snapToSubject(guessed, [bean, flame])).toMatchObject({ x: bean.x });
  });

  it("keeps the beat number, which carries the matching", () => {
    const guessed = { beatIndex: 3, x: 1020, y: 370, width: 10, height: 10 };

    expect(snapToSubject(guessed, [bean, flame]).beatIndex).toBe(3);
  });

  it("takes the closest subject when the model aimed at blank paper", () => {
    const guessed = { beatIndex: 0, x: 1300, y: 400, width: 40, height: 40 };

    expect(snapToSubject(guessed, [bean, flame])).toMatchObject({ x: flame.x });
  });

  it("resizes a subject where two things fused", () => {
    // The coffee bean touches the table lines: the measurement returned all
    // three as one wide flat object.
    const beanAndTable = { x: 118, y: 393, width: 1165, height: 378 };
    const guessed = { beatIndex: 0, x: 480, y: 380, width: 420, height: 340 };

    expect(snapToSubject(guessed, [beanAndTable])).toEqual({
      beatIndex: 0,
      x: 480,
      y: 393,
      width: 420,
      height: 327,
    });
  });

  it("keeps the measured subject when it is the same object", () => {
    // The cup: measured 669x760, guessed 640x475. Same object, so the
    // measurement wins — only it knows the exact edges.
    const cup = { x: 449, y: 100, width: 669, height: 760 };
    const guessed = { beatIndex: 0, x: 460, y: 275, width: 640, height: 475 };

    expect(snapToSubject(guessed, [cup])).toEqual({ beatIndex: 0, ...cup });
  });

  it("passes the guessed rectangle through when the image yielded no subject", () => {
    const guessed = { beatIndex: 0, x: 10, y: 20, width: 30, height: 40 };

    expect(snapToSubject(guessed, [])).toEqual(guessed);
  });
});

describe("snapRegionsToSubjects", () => {
  it("preserves two distinct vision regions against a fused candidate", () => {
    // Two distinct subjects: e.g. a bean on the left and a flame on the right.
    const regions = [
      { beatIndex: 0, label: "Grain", x: 100, y: 100, width: 150, height: 150 },
      { beatIndex: 0, label: "Flamme", x: 300, y: 100, width: 150, height: 150 },
    ];
    // The measurement fused both into one large connected blob
    const candidates = [{ x: 90, y: 90, width: 380, height: 180 }];

    const snapped = snapRegionsToSubjects(regions, candidates);

    // Anti-collision detects the snap would have collapsed them and keeps the
    // two separate vision rectangles
    expect(snapped[0].x).toBe(100);
    expect(snapped[1].x).toBe(300);
  });
});

describe("buildVisionPrompt", () => {
  const prompt = buildVisionPrompt({ scene, size: SIZE });

  it("numbers beats so they can be matched", () => {
    expect(prompt).toContain("0. Le levain est une culture vivante.");
    expect(prompt).toContain("1. Il donne au pain son gout acidule.");
  });

  it("restates this image's dimensions", () => {
    expect(prompt).toContain("1536 wide");
    expect(prompt).toContain("1024 tall");
  });

  it("asks for one zone per drawn SUBJECT, not one per beat", () => {
    // A sentence naming three things drew only one, framed so wide it
    // covered the rest.
    expect(prompt).toContain("ONE REGION PER DRAWN SUBJECT");
    expect(prompt).toContain("gets several regions");
  });

  it("asks for a short label for each zone", () => {
    expect(prompt).toContain("three words at most");
  });

  it("requires enclosing the whole subject, not a point on it", () => {
    // Without these two rules, vision returned squares of 2 to 5% of the
    // image in the middle of the subject: the pen drew almost nothing.
    expect(prompt).toContain("ENCLOSE THE WHOLE SUBJECT");
    expect(prompt).toContain("never a point on the subject");
  });

  it("requires enclosing adjacent hand-lettered labels and connectors", () => {
    expect(prompt).toContain("INCLUDE ADJACENT LABELS AND CONNECTORS");
    expect(prompt).toContain("Never cut between a subject and its label");
  });

  it("orders regions by narration chronology", () => {
    expect(prompt).toContain("Order regions in the chronological order");
  });
});

describe("annotationPlanSchema", () => {
  it("accepts a vision answer", () => {
    expect(() =>
      annotationPlanSchema.parse({
        regions: [{ beatIndex: 0, x: 1, y: 2, width: 3, height: 4 }],
      }),
    ).not.toThrow();
  });

  it("rejects an empty answer", () => {
    expect(() => annotationPlanSchema.parse({ regions: [] })).toThrow();
  });
});
