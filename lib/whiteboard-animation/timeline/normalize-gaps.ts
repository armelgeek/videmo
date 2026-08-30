import type { Annotation } from "@/lib/unified-engine/types";

/**
 * Converts legacy annotations — which carry absolute `startMs` values with
 * implicit holes between them — into the derived model, where the array order
 * is the sequence and each annotation stores only the pause preceding it.
 *
 * Applied at load time; the source data files are left untouched.
 */
export function normalizeGaps(annotations: Annotation[]): Annotation[] {
  const ordered = [...annotations].sort(
    (a, b) => a.reveal.startMs - b.reveal.startMs,
  );

  let previousEnd = 0;

  return ordered.map((annotation) => {
    const { startMs, durationMs } = annotation.reveal;
    const gapBeforeMs = Math.max(0, startMs - previousEnd);
    previousEnd = startMs + durationMs;

    return {
      ...annotation,
      reveal: { ...annotation.reveal, gapBeforeMs },
    };
  });
}
