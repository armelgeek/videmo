import type { Annotation } from "@/lib/whiteboard-animation/schema";
import { annotationColors } from "@/lib/whiteboard-animation/schema";
import type { TranscriptCue } from "@/lib/whiteboard-animation/audio/types";
import {
  type TailleCanvas,
  rectContenu,
  reprojeterRegion,
} from "@/lib/whiteboard-animation/canvas-size";
import type { ImageSize, PlannedAnnotation } from "./annotation-planning";
import type { StoryboardPanel } from "./schema";

/**
 * The marker of annotations placed by planning.
 *
 * It separates what the machine placed from what the user drew: a second pass
 * replaces its own and keeps the user's.
 */
export const PLANNED_SOURCE = "plan";

/**
 * The id of a planned annotation: stable, hence replaceable.
 *
 * The rank only appears from the second zone of a same beat onwards: ids
 * already saved, from when each beat had only one, stay unchanged and get
 * replaced instead of duplicated.
 */
export function plannedAnnotationId(
  panelId: string,
  beatIndex: number,
  rank = 0,
): string {
  const base = `${panelId}-beat-${beatIndex}`;
  return rank === 0 ? base : `${base}-${rank}`;
}

function isPlanned(annotation: Annotation): boolean {
  return annotation.metadata?.source === PLANNED_SOURCE;
}

/**
 * Translates planned annotations into the coordinate space the editor writes.
 *
 * Vision answers in image pixels; saved annotations are in preview canvas
 * pixels, where the drawing sits centered without distortion (`rectContenu`).
 * Writing one for the other would put the pen beside the subject as soon as
 * the project ratio differs from the image's.
 *
 * Array order carries timing — `deriveTimeline` recomputes `startMs` from
 * it — so narration beats come first, in order. A hand-drawn annotation is
 * kept, after them: it extends the scene rather than shifting the voice of
 * the beats before it.
 */
export function adoptPlannedAnnotations(input: {
  panelId: string;
  planned: PlannedAnnotation[];
  imageSize: ImageSize;
  canvas: TailleCanvas;
  existing?: Annotation[];
}): Annotation[] {
  const source = { x: 0, y: 0, w: input.imageSize.width, h: input.imageSize.height };
  const target = rectContenu(
    input.canvas.width,
    input.canvas.height,
    input.imageSize.width,
    input.imageSize.height,
  );

  // Index existing annotations to keep their customizations (stroke color,
  // animation style) on replanning.
  const existingById = new Map<string, Annotation>();
  for (const a of input.existing ?? []) {
    existingById.set(a.id, a);
  }

  // A beat can carry several zones: the rank tells them apart. The array
  // index no longer suffices, it only identified the beat while there was
  // one per beat.
  const ranks = new Map<number, number>();
  const planned: Annotation[] = input.planned.map((annotation, index) => {
    const beatIndex = annotation.beatIndex;
    const rank = ranks.get(beatIndex) ?? 0;
    ranks.set(beatIndex, rank + 1);

    const id = plannedAnnotationId(input.panelId, beatIndex, rank);
    const prev = existingById.get(id);

    return {
      id,
      text: annotation.text,
      region: reprojeterRegion(annotation.region, source, target),
      reveal: {
        durationMs: Math.max(1, Math.round(annotation.reveal.durationMs)),
        startMs: annotation.reveal.startMs,
        gapBeforeMs: 0,
      },
      style: prev?.style ?? {
        strokeColor: annotationColors({}, index).stroke,
        fillColor: annotationColors({}, index).fill,
        strokeWidth: 2,
        opacity: 1,
      },
      ...(prev?.animStyle ? { animStyle: prev.animStyle } : {}),
      metadata: { source: PLANNED_SOURCE, beatIndex },
    };
  });

  const handMade = (input.existing ?? []).filter(
    (annotation) => !isPlanned(annotation),
  );

  return [...planned, ...handMade];
}

/**
 * The project transcript, derived from planned annotations.
 *
 * Each cue already carries `annotationId`: the link between a narration beat
 * and what is drawn while it is spoken used to be filled by hand in the
 * editor, whereas planning knows it by construction.
 *
 * Bounds are absolute on the project clock, as the renderer expects: each
 * scene starts where the previous one ended.
 */
export function transcriptFromPanels(panels: StoryboardPanel[]): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  let cursor = 0;

  for (const panel of panels) {
    for (const annotation of panel.annotations ?? []) {
      const durationMs = annotation.reveal?.durationMs ?? 0;
      const startMs = cursor + (annotation.reveal?.gapBeforeMs ?? 0);
      cursor = startMs + durationMs;

      // An annotation without text is not a narration beat: it takes up
      // scene time but has nothing to read.
      if (annotation.text) {
        cues.push({
          id: `cue-${annotation.id}`,
          startMs,
          endMs: cursor,
          text: annotation.text,
          annotationId: annotation.id,
        });
      }
    }
  }

  return cues;
}
