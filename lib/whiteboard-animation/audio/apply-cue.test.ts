import { describe, expect, it } from "vitest";
import { applyCueToAnnotation, linkCueToAnnotation } from "./apply-cue";
import type { TranscriptCue } from "./types";
import type { Annotation } from "../schema";

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "ann-1",
    text: "",
    region: { x: 0, y: 0, width: 100, height: 100 },
    reveal: { durationMs: 1000 },
    style: { strokeColor: "#000000", strokeWidth: 2, opacity: 1 },
    ...overrides,
  };
}

function makeCue(overrides: Partial<TranscriptCue> = {}): TranscriptCue {
  return { id: "cue-1", startMs: 500, endMs: 2500, text: "narration", ...overrides };
}

describe("applyCueToAnnotation", () => {
  it("sets reveal.from and reveal.to from the cue bounds", () => {
    const result = applyCueToAnnotation(makeCue(), makeAnnotation());
    expect(result.reveal.from).toBe(500);
    expect(result.reveal.to).toBe(2500);
  });

  it("derives durationMs from the cue span", () => {
    const result = applyCueToAnnotation(makeCue({ startMs: 1000, endMs: 4000 }), makeAnnotation());
    expect(result.reveal.durationMs).toBe(3000);
  });

  it("does not mutate the input annotation", () => {
    const annotation = makeAnnotation();
    const originalReveal = annotation.reveal;
    applyCueToAnnotation(makeCue(), annotation);
    expect(annotation.reveal).toBe(originalReveal);
  });

  it("preserves other annotation fields", () => {
    const annotation = makeAnnotation({ text: "keep me" });
    const result = applyCueToAnnotation(makeCue(), annotation);
    expect(result.text).toBe("keep me");
    expect(result.id).toBe("ann-1");
  });

  it("throws if the cue is inverted (endMs <= startMs)", () => {
    const inverted = makeCue({ startMs: 3000, endMs: 1000 });
    expect(() => applyCueToAnnotation(inverted, makeAnnotation())).toThrow();
  });
});

describe("linkCueToAnnotation", () => {
  it("sets annotationId on the cue", () => {
    const result = linkCueToAnnotation(makeCue(), "ann-42");
    expect(result.annotationId).toBe("ann-42");
  });

  it("does not mutate the input cue", () => {
    const cue = makeCue();
    linkCueToAnnotation(cue, "ann-42");
    expect(cue.annotationId).toBeUndefined();
  });
});
