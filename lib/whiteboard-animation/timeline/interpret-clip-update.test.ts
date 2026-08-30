import { describe, expect, it } from "vitest";
import type { TimelineClip } from "@/lib/editor/types";
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

// Previous clip ends at 1.5s, so this clip carries a 0.5s gap.
const context = { clip, previousEndSeconds: 1.5 };

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

  it("reads a start+duration+offset payload as a left-handle gap resize", () => {
    // Left handle dragged 0.5s later: start 2 -> 2.5.
    expect(
      interpretClipUpdate(
        { start: 2.5, duration: 2.5, offset: 0.5 },
        context,
      ),
    ).toEqual({ kind: "resize-gap", id: "b", gapSeconds: 1 });
  });

  it("never reports a negative gap", () => {
    expect(
      interpretClipUpdate({ start: 1, duration: 4, offset: -1 }, context),
    ).toEqual({ kind: "resize-gap", id: "b", gapSeconds: 0 });
  });

  it("gives the first clip a gap equal to its start", () => {
    expect(
      interpretClipUpdate(
        { start: 0.3, duration: 4.7, offset: 0.3 },
        { clip, previousEndSeconds: 0 },
      ),
    ).toEqual({ kind: "resize-gap", id: "b", gapSeconds: 0.3 });
  });

  it("stays a gap resize when a repeated mousemove re-sends the same start", () => {
    // use-timeline-drag computes from the state captured at mousedown, so it
    // re-emits a start the store already applied. Diffing against current
    // state would misread this as a right-handle resize and eat the duration.
    const applied: TimelineClip = { ...clip, start: 2.5 };

    expect(
      interpretClipUpdate(
        { start: 2.5, duration: 2.5, offset: 0.5 },
        { clip: applied, previousEndSeconds: 1.5 },
      ),
    ).toEqual({ kind: "resize-gap", id: "b", gapSeconds: 1 });
  });

  it("is idempotent across repeated identical events", () => {
    const payload = { start: 2.5, duration: 2.5, offset: 0.5 };
    const first = interpretClipUpdate(payload, context);
    const second = interpretClipUpdate(payload, {
      clip: { ...clip, start: 2.5 },
      previousEndSeconds: 1.5,
    });
    expect(second).toEqual(first);
  });

  it("ignores changes to fields the annotation model has no use for", () => {
    expect(interpretClipUpdate({ volume: 0.5 }, context)).toBeNull();
  });

  it("ignores an empty payload", () => {
    expect(interpretClipUpdate({}, context)).toBeNull();
  });
});
