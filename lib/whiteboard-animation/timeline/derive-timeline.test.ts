import { describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/unified-engine/types";
import { SCENE_PREMIUM_BAG_ANNOTATIONS } from "@/lib/whiteboard-animation/data/scene-premium-bag";
import { deriveTimeline } from "./derive-timeline";
import { normalizeGaps } from "./normalize-gaps";

function annotation(
  id: string,
  durationMs: number,
  gapBeforeMs?: number,
): Annotation {
  return {
    id,
    text: id,
    region: { x: 0, y: 0, width: 10, height: 10 },
    reveal: { from: 0, to: 0, startMs: 0, durationMs, gapBeforeMs },
  };
}

describe("deriveTimeline", () => {
  it("chains annotations back to back", () => {
    const { annotations } = deriveTimeline([
      annotation("a", 1000),
      annotation("b", 500),
    ]);
    expect(annotations.map((a) => a.reveal.startMs)).toEqual([0, 1000]);
  });

  it("inserts gaps before annotations", () => {
    const { annotations } = deriveTimeline([
      annotation("a", 1000, 300),
      annotation("b", 500, 200),
    ]);
    expect(annotations.map((a) => a.reveal.startMs)).toEqual([300, 1500]);
  });

  it("treats a missing gap as zero", () => {
    const { annotations } = deriveTimeline([annotation("a", 1000)]);
    expect(annotations[0].reveal.startMs).toBe(0);
  });

  it("keeps from/to consistent with startMs and duration", () => {
    const { annotations } = deriveTimeline([annotation("a", 1000, 300)]);
    expect(annotations[0].reveal.from).toBe(300);
    expect(annotations[0].reveal.to).toBe(1300);
  });

  it("reports the total duration as the end of the last annotation", () => {
    const { totalDurationMs } = deriveTimeline([
      annotation("a", 1000, 300),
      annotation("b", 500, 200),
    ]);
    expect(totalDurationMs).toBe(2000);
  });

  it("handles an empty sequence", () => {
    expect(deriveTimeline([])).toEqual({ annotations: [], totalDurationMs: 0 });
  });

  it("does not mutate the input annotations", () => {
    const input = [annotation("a", 1000, 300)];
    deriveTimeline(input);
    expect(input[0].reveal.startMs).toBe(0);
  });

  it("is idempotent", () => {
    const once = deriveTimeline([annotation("a", 1000, 300), annotation("b", 500)]);
    const twice = deriveTimeline(once.annotations);
    expect(twice).toEqual(once);
  });
});

describe("deriveTimeline — non-regression on scene-premium-bag", () => {
  it("reproduces the original absolute startMs exactly", () => {
    const { annotations } = deriveTimeline(
      normalizeGaps(SCENE_PREMIUM_BAG_ANNOTATIONS),
    );

    expect(annotations.map((a) => a.id)).toEqual([
      "title",
      "bag",
      "tag",
      "question",
      "region_5",
    ]);
    expect(annotations.map((a) => a.reveal.startMs)).toEqual([
      300, 2000, 5500, 7600, 9200,
    ]);
  });

  it("reproduces the original from/to bounds exactly", () => {
    const { annotations } = deriveTimeline(
      normalizeGaps(SCENE_PREMIUM_BAG_ANNOTATIONS),
    );

    for (const [i, derived] of annotations.entries()) {
      const original = SCENE_PREMIUM_BAG_ANNOTATIONS[i];
      expect(derived.reveal.from).toBe(original.reveal.from);
      expect(derived.reveal.to).toBe(original.reveal.to);
    }
  });

  it("ends where the last annotation ends", () => {
    const { totalDurationMs } = deriveTimeline(
      normalizeGaps(SCENE_PREMIUM_BAG_ANNOTATIONS),
    );
    // The exported SCENE_PREMIUM_BAG_DURATION_MS is 11700: it carries a 500ms
    // tail past the last annotation that the annotations themselves never held.
    expect(totalDurationMs).toBe(11200);
  });
});
