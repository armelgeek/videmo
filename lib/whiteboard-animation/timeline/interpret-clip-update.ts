import type { TimelineClip } from "@/lib/editor/types";
import type { TimelineEdit } from "./apply-editor-edit";

export interface ClipUpdateContext {
  clip: TimelineClip;
  /** Where the previous clip ends, in seconds; 0 for the first clip. */
  previousEndSeconds: number;
}

/**
 * Reads a clip change coming from the NLE and decides which gesture it was.
 *
 * The gesture is identified by the SHAPE of the payload, not by comparing with
 * current state: use-timeline-drag computes every value from the state captured
 * at mousedown, so a repeated mousemove can re-send a value the store already
 * holds. Diffing against current state would then mistake a left-handle drag
 * for a right-handle one and overwrite the duration.
 *
 *   trim-start -> { start, duration, offset }
 *   trim-end   -> { duration }
 *   move       -> { start }
 */
export function interpretClipUpdate(
  changes: Partial<TimelineClip>,
  { clip, previousEndSeconds }: ClipUpdateContext,
): TimelineEdit | null {
  const { start, duration, offset } = changes;

  const isTrimStart =
    start !== undefined && duration !== undefined && offset !== undefined;

  if (isTrimStart) {
    // Derived from the proposed absolute start, so repeated identical events
    // converge on the same gap instead of accumulating.
    return {
      kind: "resize-gap",
      id: clip.id,
      gapSeconds: Math.max(0, start - previousEndSeconds),
    };
  }

  if (duration !== undefined && start === undefined) {
    return { kind: "resize-duration", id: clip.id, durationSeconds: duration };
  }

  if (start !== undefined && duration === undefined) {
    return { kind: "reorder", id: clip.id, startSeconds: start };
  }

  return null;
}
