import { describe, expect, it } from "vitest";
import type { TimelineClip } from "@/lib/editor/types";
import { applyEditorEdit, type TimelineEdit } from "./apply-editor-edit";
import { interpretClipUpdate } from "./interpret-clip-update";

const clip: TimelineClip = {
  id: "b",
  mediaId: "b",
  trackId: "annotations",
  start: 2,
  duration: 3,
  offset: 0,
  speed: 1,
};

const context = { clip, gapSeconds: 0.5 };

describe("interpretClipUpdate", () => {
  it("reads a duration-only change as a right-handle resize", () => {
    expect(interpretClipUpdate({ duration: 4 }, context)).toEqual({
      kind: "resize-duration",
      id: "b",
      durationSeconds: 4,
    });
  });

  it("reads a start-only change as a reorder drag", () => {
    expect(interpretClipUpdate({ start: 6 }, context)).toEqual({
      kind: "reorder",
      id: "b",
      startSeconds: 6,
    });
  });

  it("reads a paired start+duration change as a left-handle gap resize", () => {
    // Left handle dragged 0.5s later: start 2 -> 2.5, duration 3 -> 2.5.
    expect(
      interpretClipUpdate({ start: 2.5, duration: 2.5 }, context),
    ).toEqual({ kind: "resize-gap", id: "b", gapSeconds: 1 });
  });

  it("shrinks the gap when the left handle is dragged earlier", () => {
    const edit = interpretClipUpdate({ start: 1.8, duration: 3.2 }, context);

    expect(edit?.kind).toBe("resize-gap");
    // Seconds are only an intermediate unit: applyEditorEdit rounds to ms, so
    // float noise here never reaches the store.
    expect((edit as { gapSeconds: number }).gapSeconds).toBeCloseTo(0.3, 9);
  });

  it("survives float noise once rounded to milliseconds", () => {
    const edit = interpretClipUpdate({ start: 1.8, duration: 3.2 }, context);
    const result = applyEditorEdit(
      edit as TimelineEdit,
      [
        {
          id: "b",
          text: "b",
          region: { x: 0, y: 0, width: 1, height: 1 },
          reveal: { from: 0, to: 0, startMs: 0, durationMs: 3000, gapBeforeMs: 500 },
        },
      ],
    );

    expect(result[0].reveal.gapBeforeMs).toBe(300);
  });

  it("ignores a change that moves nothing", () => {
    expect(interpretClipUpdate({ start: 2, duration: 3 }, context)).toBeNull();
  });

  it("ignores changes to fields the annotation model has no use for", () => {
    expect(interpretClipUpdate({ volume: 0.5, offset: 2 }, context)).toBeNull();
  });
});
