import type { TimelineClip } from "@/lib/editor/types";
import type { TimelineEdit } from "./apply-editor-edit";

export interface ClipUpdateContext {
  clip: TimelineClip;
  /** Current gap before this annotation, in seconds. */
  gapSeconds: number;
}

/**
 * Reads a clip change coming from the NLE and decides which of the three
 * gestures it was.
 *
 * The NLE has no notion of gaps: dragging a clip's left handle moves `start`
 * and shrinks `duration` together. That pair is what identifies the gesture —
 * a duration change alone is the right handle, a start change alone is a drag.
 */
export function interpretClipUpdate(
  changes: Partial<TimelineClip>,
  { clip, gapSeconds }: ClipUpdateContext,
): TimelineEdit | null {
  const nextStart = changes.start;
  const nextDuration = changes.duration;

  const movedStart = nextStart !== undefined && nextStart !== clip.start;
  const changedDuration =
    nextDuration !== undefined && nextDuration !== clip.duration;

  if (movedStart && changedDuration) {
    return {
      kind: "resize-gap",
      id: clip.id,
      gapSeconds: gapSeconds + (nextStart - clip.start),
    };
  }

  if (changedDuration) {
    return {
      kind: "resize-duration",
      id: clip.id,
      durationSeconds: nextDuration,
    };
  }

  if (movedStart) {
    return { kind: "reorder", id: clip.id, startSeconds: nextStart };
  }

  return null;
}
