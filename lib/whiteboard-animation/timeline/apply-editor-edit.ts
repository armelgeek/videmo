import type { Annotation } from "@/lib/unified-engine/types";
import { deriveTimeline } from "./derive-timeline";

export const MIN_DURATION_MS = 100;

export type TimelineEdit =
  | { kind: "resize-duration"; id: string; durationSeconds: number }
  | { kind: "resize-gap"; id: string; gapSeconds: number }
  | { kind: "reorder"; id: string; startSeconds: number }
  | { kind: "delete"; ids: string[] }
  | { kind: "duplicate"; ids: string[] }
  | { kind: "split"; id: string; atSeconds: number };

const toMs = (seconds: number) => Math.round(seconds * 1000);

function withReveal(
  annotation: Annotation,
  reveal: Partial<Annotation["reveal"]>,
): Annotation {
  return { ...annotation, reveal: { ...annotation.reveal, ...reveal } };
}

/**
 * Translates one NLE interaction into the derived model.
 *
 * Invariant: the absolute `start` the NLE hands us is never stored. For a
 * reorder it only decides an insertion index; every position the user sees is
 * recomputed by deriveTimeline from order, durations and gaps.
 */
export function applyEditorEdit(
  edit: TimelineEdit,
  annotations: Annotation[],
  /**
   * Hard end of the video, when something other than the drawing sets it —
   * a narration track. An annotation may then not be stretched past it.
   *
   * Left undefined when the annotations themselves define the length: the
   * video would simply grow with them, and capping would make the clip
   * impossible to lengthen at all.
   */
  maxEndMs?: number,
): Annotation[] {
  switch (edit.kind) {
    case "resize-duration": {
      const requested = Math.max(MIN_DURATION_MS, toMs(edit.durationSeconds));
      let durationMs = requested;

      if (maxEndMs !== undefined) {
        // Positions are derived, never stored, so the room left is measured
        // on the recomputed start rather than on anything the clip carries.
        const entry = deriveTimeline(annotations).annotations.find(
          (a) => a.id === edit.id,
        );
        if (entry) {
          const room = maxEndMs - (entry.reveal.startMs ?? 0);
          durationMs = Math.max(MIN_DURATION_MS, Math.min(requested, room));
        }
      }

      return annotations.map((annotation) =>
        annotation.id === edit.id
          ? withReveal(annotation, { durationMs })
          : annotation,
      );
    }

    case "resize-gap":
      return annotations.map((annotation) =>
        annotation.id === edit.id
          ? withReveal(annotation, {
              gapBeforeMs: Math.max(0, toMs(edit.gapSeconds)),
            })
          : annotation,
      );

    case "reorder":
      return reorder(annotations, edit.id, toMs(edit.startSeconds));

    case "delete":
      return annotations.filter(
        (annotation) => !edit.ids.includes(annotation.id),
      );

    case "duplicate":
      return duplicate(annotations, edit.ids);

    case "split":
      return split(annotations, edit.id, toMs(edit.atSeconds));
  }
}

/**
 * The dragged clip lands wherever its proposed start falls among the others.
 * We compare against the midpoint of each remaining annotation so a clip
 * dropped past the halfway mark of its neighbour takes that neighbour's place.
 */
function reorder(
  annotations: Annotation[],
  id: string,
  proposedStartMs: number,
): Annotation[] {
  const from = annotations.findIndex((annotation) => annotation.id === id);
  if (from === -1) return annotations;

  const remaining = annotations.filter((annotation) => annotation.id !== id);
  const derived = deriveTimeline(remaining).annotations;

  let to = derived.findIndex(
    (annotation) =>
      proposedStartMs < annotation.reveal.startMs + annotation.reveal.durationMs / 2,
  );
  if (to === -1) to = remaining.length;

  remaining.splice(to, 0, annotations[from]);
  return remaining;
}

function duplicate(annotations: Annotation[], ids: string[]): Annotation[] {
  const result: Annotation[] = [];

  for (const annotation of annotations) {
    result.push(annotation);
    if (ids.includes(annotation.id)) {
      result.push({
        ...annotation,
        id: `${annotation.id}-copy-${Math.random().toString(36).slice(2, 8)}`,
        reveal: { ...annotation.reveal, gapBeforeMs: 0 },
      });
    }
  }

  return result;
}

function split(
  annotations: Annotation[],
  id: string,
  atMs: number,
): Annotation[] {
  const derived = deriveTimeline(annotations).annotations;
  const index = derived.findIndex((annotation) => annotation.id === id);
  if (index === -1) return annotations;

  const target = derived[index];
  const head = atMs - target.reveal.startMs;
  const tail = target.reveal.durationMs - head;

  if (head < MIN_DURATION_MS || tail < MIN_DURATION_MS) return annotations;

  const original = annotations[index];
  const result = [...annotations];
  result.splice(
    index,
    1,
    withReveal(original, { durationMs: head }),
    {
      ...original,
      id: `${original.id}-split-${Math.random().toString(36).slice(2, 8)}`,
      reveal: { ...original.reveal, durationMs: tail, gapBeforeMs: 0 },
    },
  );

  return result;
}
