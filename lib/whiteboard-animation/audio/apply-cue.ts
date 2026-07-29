import type { Annotation } from "../schema";
import type { TranscriptCue } from "./types";

export function applyCueToAnnotation(
  cue: TranscriptCue,
  annotation: Annotation
): Annotation {
  if (cue.endMs <= cue.startMs) {
    throw new Error(
      `Cannot apply inverted cue (startMs=${cue.startMs}, endMs=${cue.endMs}) to annotation`
    );
  }

  return {
    ...annotation,
    reveal: {
      ...annotation.reveal,
      from: cue.startMs,
      to: cue.endMs,
      durationMs: cue.endMs - cue.startMs,
    },
  };
}

export function linkCueToAnnotation(
  cue: TranscriptCue,
  annotationId: string
): TranscriptCue {
  return { ...cue, annotationId };
}
