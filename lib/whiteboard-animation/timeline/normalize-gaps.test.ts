import { describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/unified-engine/types";
import { normalizeGaps } from "./normalize-gaps";

function annotation(id: string, startMs: number, durationMs: number): Annotation {
  return {
    id,
    text: id,
    region: { x: 0, y: 0, width: 10, height: 10 },
    reveal: { from: startMs, to: startMs + durationMs, startMs, durationMs },
  };
}

describe("normalizeGaps", () => {
  it("gives the first annotation its startMs as gap", () => {
    const [first] = normalizeGaps([annotation("a", 300, 1600)]);
    expect(first.reveal.gapBeforeMs).toBe(300);
  });

  it("turns an implicit hole into an explicit gap", () => {
    const result = normalizeGaps([
      annotation("a", 300, 1600), // ends at 1900
      annotation("b", 2000, 3400),
    ]);
    expect(result[1].reveal.gapBeforeMs).toBe(100);
  });

  it("assigns a zero gap to back-to-back annotations", () => {
    const result = normalizeGaps([
      annotation("a", 0, 1000), // ends at 1000
      annotation("b", 1000, 500),
    ]);
    expect(result[1].reveal.gapBeforeMs).toBe(0);
  });

  it("sorts by startMs before deriving gaps", () => {
    const result = normalizeGaps([
      annotation("b", 2000, 1000),
      annotation("a", 0, 1000),
    ]);
    expect(result.map((a) => a.id)).toEqual(["a", "b"]);
    expect(result[1].reveal.gapBeforeMs).toBe(1000);
  });

  it("clamps overlapping annotations to a zero gap", () => {
    const result = normalizeGaps([
      annotation("a", 0, 1000), // ends at 1000
      annotation("b", 500, 1000),
    ]);
    expect(result[1].reveal.gapBeforeMs).toBe(0);
  });

  it("returns an empty array untouched", () => {
    expect(normalizeGaps([])).toEqual([]);
  });

  it("does not mutate the input annotations", () => {
    const input = [annotation("a", 300, 1600)];
    normalizeGaps(input);
    expect(input[0].reveal.gapBeforeMs).toBeUndefined();
  });
});
