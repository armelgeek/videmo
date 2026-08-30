import { describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/unified-engine/types";
import { MIN_DURATION_MS, applyEditorEdit } from "./apply-editor-edit";
import { deriveTimeline } from "./derive-timeline";

function annotation(
  id: string,
  durationMs: number,
  gapBeforeMs = 0,
): Annotation {
  return {
    id,
    text: `Label ${id}`,
    region: { x: 1, y: 2, width: 10, height: 20 },
    reveal: { from: 0, to: 0, startMs: 0, durationMs, gapBeforeMs },
    style: { strokeColor: "#000", strokeWidth: 2 },
  };
}

const sequence = [
  annotation("a", 1000, 300),
  annotation("b", 2000),
  annotation("c", 500),
];

const ids = (annotations: Annotation[]) => annotations.map((a) => a.id);
const starts = (annotations: Annotation[]) =>
  deriveTimeline(annotations).annotations.map((a) => a.reveal.startMs);

describe("applyEditorEdit — resize duration", () => {
  it("changes the duration of the targeted annotation", () => {
    const result = applyEditorEdit(
      { kind: "resize-duration", id: "b", durationSeconds: 3 },
      sequence,
    );
    expect(result[1].reveal.durationMs).toBe(3000);
  });

  it("ripples the following annotations", () => {
    const result = applyEditorEdit(
      { kind: "resize-duration", id: "b", durationSeconds: 3 },
      sequence,
    );
    expect(starts(sequence)).toEqual([300, 1300, 3300]);
    expect(starts(result)).toEqual([300, 1300, 4300]);
  });

  it("refuses to shrink below the minimum duration", () => {
    const result = applyEditorEdit(
      { kind: "resize-duration", id: "b", durationSeconds: 0 },
      sequence,
    );
    expect(result[1].reveal.durationMs).toBe(MIN_DURATION_MS);
  });
});

describe("applyEditorEdit — resize gap", () => {
  it("changes the gap before the targeted annotation", () => {
    const result = applyEditorEdit(
      { kind: "resize-gap", id: "b", gapSeconds: 0.5 },
      sequence,
    );
    expect(result[1].reveal.gapBeforeMs).toBe(500);
    expect(starts(result)).toEqual([300, 1800, 3800]);
  });

  it("clamps a negative gap to zero", () => {
    const result = applyEditorEdit(
      { kind: "resize-gap", id: "a", gapSeconds: -2 },
      sequence,
    );
    expect(result[0].reveal.gapBeforeMs).toBe(0);
  });
});

describe("applyEditorEdit — reorder", () => {
  it("moves an annotation later in the sequence", () => {
    // "a" dragged past "b" and "c" (which together end at 3800ms).
    const result = applyEditorEdit(
      { kind: "reorder", id: "a", startSeconds: 3.5 },
      sequence,
    );
    expect(ids(result)).toEqual(["b", "c", "a"]);
  });

  it("moves an annotation earlier in the sequence", () => {
    const result = applyEditorEdit(
      { kind: "reorder", id: "c", startSeconds: 0 },
      sequence,
    );
    expect(ids(result)).toEqual(["c", "a", "b"]);
  });

  it("never stores the absolute start coming from the NLE", () => {
    const result = applyEditorEdit(
      { kind: "reorder", id: "c", startSeconds: 7.77 },
      sequence,
    );
    // 7770ms appears nowhere: only order changed, and it did not even move.
    expect(ids(result)).toEqual(["a", "b", "c"]);
    expect(starts(result)).toEqual([300, 1300, 3300]);
    for (const a of result) {
      expect(a.reveal.startMs).not.toBe(7770);
    }
  });

  it("never produces overlapping annotations", () => {
    const result = applyEditorEdit(
      { kind: "reorder", id: "a", startSeconds: 1.2 },
      sequence,
    );
    const derived = deriveTimeline(result).annotations;
    for (let i = 1; i < derived.length; i++) {
      expect(derived[i].reveal.startMs).toBeGreaterThanOrEqual(
        derived[i - 1].reveal.to,
      );
    }
  });

  it("keeps the sequence length unchanged", () => {
    const result = applyEditorEdit(
      { kind: "reorder", id: "b", startSeconds: 99 },
      sequence,
    );
    expect(result).toHaveLength(3);
  });
});

describe("applyEditorEdit — delete", () => {
  it("removes the targeted annotations and ripples the rest", () => {
    const result = applyEditorEdit({ kind: "delete", ids: ["b"] }, sequence);
    expect(ids(result)).toEqual(["a", "c"]);
    expect(starts(result)).toEqual([300, 1300]);
  });

  it("removes several annotations at once", () => {
    const result = applyEditorEdit(
      { kind: "delete", ids: ["a", "c"] },
      sequence,
    );
    expect(ids(result)).toEqual(["b"]);
  });
});

describe("applyEditorEdit — duplicate", () => {
  it("inserts a copy right after the original with a fresh id", () => {
    const result = applyEditorEdit({ kind: "duplicate", ids: ["b"] }, sequence);
    expect(result).toHaveLength(4);
    expect(result[2].id).not.toBe("b");
    expect(result[2].reveal.durationMs).toBe(2000);
    expect(result[2].region).toEqual(result[1].region);
  });
});

describe("applyEditorEdit — split", () => {
  it("splits one annotation into two adjacent halves", () => {
    // "b" runs 1300 -> 3300; splitting at 2300ms cuts it in the middle.
    const result = applyEditorEdit(
      { kind: "split", id: "b", atSeconds: 2.3 },
      sequence,
    );
    expect(result).toHaveLength(4);
    expect(result[1].reveal.durationMs).toBe(1000);
    expect(result[2].reveal.durationMs).toBe(1000);
    expect(result[2].reveal.gapBeforeMs).toBe(0);
  });

  it("preserves the total duration of the sequence", () => {
    const before = deriveTimeline(sequence).totalDurationMs;
    const after = deriveTimeline(
      applyEditorEdit({ kind: "split", id: "b", atSeconds: 2.3 }, sequence),
    ).totalDurationMs;
    expect(after).toBe(before);
  });

  it("ignores a split point outside the annotation", () => {
    const result = applyEditorEdit(
      { kind: "split", id: "b", atSeconds: 9 },
      sequence,
    );
    expect(result).toEqual(sequence);
  });

  it("ignores a split that would create a sliver below the minimum", () => {
    const result = applyEditorEdit(
      { kind: "split", id: "b", atSeconds: 1.31 },
      sequence,
    );
    expect(result).toEqual(sequence);
  });
});

describe("applyEditorEdit — general", () => {
  it("does not mutate the input sequence", () => {
    applyEditorEdit(
      { kind: "resize-duration", id: "b", durationSeconds: 9 },
      sequence,
    );
    expect(sequence[1].reveal.durationMs).toBe(2000);
  });

  it("leaves the sequence untouched for an unknown id", () => {
    const result = applyEditorEdit(
      { kind: "resize-duration", id: "nope", durationSeconds: 9 },
      sequence,
    );
    expect(result).toEqual(sequence);
  });
});
