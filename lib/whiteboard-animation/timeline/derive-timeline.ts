import type { Annotation } from "@/lib/unified-engine/types";

export interface DerivedTimeline {
  /** Same order as the input, with startMs/from/to recomputed. */
  annotations: Annotation[];
  totalDurationMs: number;
}

/**
 * The single place in the system that turns the sequence into absolute time.
 *
 * The array order is the source of truth: each annotation starts where the
 * previous one ended, plus its own `gapBeforeMs`. The resulting `startMs`,
 * `from` and `to` are written back so AnimationFactory and the renderer keep
 * reading the fields they already read.
 */
export function deriveTimeline(annotations: Annotation[]): DerivedTimeline {
  let cursor = 0;

  const derived = annotations.map((annotation) => {
    const { durationMs, gapBeforeMs = 0 } = annotation.reveal;
    const startMs = cursor + gapBeforeMs;
    cursor = startMs + durationMs;

    return {
      ...annotation,
      reveal: {
        ...annotation.reveal,
        startMs,
        from: startMs,
        to: cursor,
      },
    };
  });

  return { annotations: derived, totalDurationMs: cursor };
}
