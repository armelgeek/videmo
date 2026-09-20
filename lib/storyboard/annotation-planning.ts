import { z } from "zod";
import type { ScriptScene } from "./script-generation";

/**
 * The area of an image that a narration beat reveals, in image pixels.
 *
 * The model writing the breakdown does not see the illustration: these
 * rectangles can only come from reading the image itself.
 */
export const plannedRegionSchema = z.object({
  beatIndex: z.number().int().nonnegative(),
  /**
   * What the zone encloses, in a few words. A narration often describes
   * several drawn subjects: without a label, each would carry the whole
   * sentence and the editor would show the same line that many times.
   */
  label: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type PlannedRegion = z.infer<typeof plannedRegionSchema>;

export const annotationPlanSchema = z.object({
  regions: z.array(plannedRegionSchema).min(1),
});
export type AnnotationPlan = z.infer<typeof annotationPlanSchema>;

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * Brings a rectangle back inside the image.
 *
 * A vision model locates correctly but measures loosely: it overflows,
 * returns negative widths, or answers in percentages. An out-of-frame region
 * would make the pen draw in the void, whereas a trimmed region stays usable.
 */
export function clampRegion(
  region: PlannedRegion,
  size: ImageSize,
): PlannedRegion {
  // Strictly positive dimensions at most 1 are fractions, not pixels. x and y
  // are NOT tested: they are legitimately 0 in both systems (top-left corner),
  // which caused false detection and multiplied pixel coordinates by the
  // image size. Negative values are not fractions: the clamp below fixes them.
  const fractional = region.width > 0 && region.width <= 1 && region.height > 0 && region.height <= 1;
  const scaleX = fractional ? size.width : 1;
  const scaleY = fractional ? size.height : 1;

  const x = Math.min(Math.max(region.x * scaleX, 0), size.width);
  const y = Math.min(Math.max(region.y * scaleY, 0), size.height);
  const width = Math.min(Math.max(region.width * scaleX, 1), size.width - x);
  const height = Math.min(Math.max(region.height * scaleY, 1), size.height - y);

  return {
    beatIndex: region.beatIndex,
    label: region.label,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * The area ratio beyond which a measured subject is taken as two things fused
 * together. Below it, the model and the measurement talk about the same object
 * and the measurement wins: only it knows the exact edges.
 */
const SUSPECTED_FUSION_RATIO = 2.5;

export interface SubjectCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Snaps a guessed rectangle onto the subject actually drawn.
 *
 * Vision locates well but measures badly: checked on real illustrations, it
 * returned the flame two hundred pixels off, or a 50x50 square in the middle
 * of a cup. The exact bounds are in the image — whatever stands out from the
 * background carries them. So the model is now only asked to POINT AT a
 * subject, and the rectangle comes from the measurement.
 *
 * Matching uses the shared area. Without overlap — the model aimed at blank
 * paper — take the subject with the closest center: it got the frame wrong,
 * rarely the direction.
 *
 * Without candidates (unreadable image, blank page), the guessed rectangle
 * passes as is: an approximate zone beats no annotation.
 */
export function snapToSubject(
  region: PlannedRegion,
  candidates: SubjectCandidate[],
): PlannedRegion {
  if (candidates.length === 0) return region;

  let best: SubjectCandidate | null = null;
  let bestArea = 0;

  for (const candidate of candidates) {
    const overlapW =
      Math.min(region.x + region.width, candidate.x + candidate.width) -
      Math.max(region.x, candidate.x);
    const overlapH =
      Math.min(region.y + region.height, candidate.y + candidate.height) -
      Math.max(region.y, candidate.y);
    const area = Math.max(0, overlapW) * Math.max(0, overlapH);

    if (area > bestArea) {
      bestArea = area;
      best = candidate;
    }
  }

  if (!best) {
    let closest = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const dx =
        region.x + region.width / 2 - (candidate.x + candidate.width / 2);
      const dy =
        region.y + region.height / 2 - (candidate.y + candidate.height / 2);
      const distance = dx * dx + dy * dy;
      if (distance < closest) {
        closest = distance;
        best = candidate;
      }
    }
  }

  const target = best as SubjectCandidate;

  // A subject much larger than what the model aimed at is not one: nearby
  // strokes fused. Checked on an illustration where the coffee bean touches
  // the table lines — the measurement returned all three as one wide flat
  // object. Keep the part the model pointed at, bounded by the measured
  // subject: the subject's edges, the model's framing.
  const targetArea = target.width * target.height;
  const aimedArea = region.width * region.height;
  if (aimedArea > 0 && targetArea > aimedArea * SUSPECTED_FUSION_RATIO) {
    const x = Math.max(region.x, target.x);
    const y = Math.max(region.y, target.y);
    const width =
      Math.min(region.x + region.width, target.x + target.width) - x;
    const height =
      Math.min(region.y + region.height, target.y + target.height) - y;
    if (width > 0 && height > 0) {
      return { beatIndex: region.beatIndex, label: region.label, x, y, width, height };
    }
  }

  return {
    beatIndex: region.beatIndex,
    label: region.label,
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
  };
}

function overlapRatio(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.width, b.x + b.width) - x;
  const h = Math.min(a.y + a.height, b.y + b.height) - y;
  if (w <= 0 || h <= 0) return 0;
  const intersection = w * h;
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 ? intersection / minArea : 0;
}

/**
 * Reframes read regions onto measured subjects while preventing two distinct
 * regions from collapsing onto the same fused subject.
 */
export function snapRegionsToSubjects(
  regions: PlannedRegion[],
  candidates: SubjectCandidate[],
): PlannedRegion[] {
  if (candidates.length === 0 || regions.length === 0) return regions;

  const snapped = regions.map((r) => snapToSubject(r, candidates));

  // Anti-collision: if two regions aimed at different subjects in vision
  // (< 60% original overlap) but the measurement snapped them onto the same
  // candidate (> 80% overlap after snap), they keep their distinct vision
  // rectangles so they don't duplicate.
  for (let i = 0; i < snapped.length; i++) {
    for (let j = i + 1; j < snapped.length; j++) {
      if (overlapRatio(snapped[i], snapped[j]) > 0.8) {
        if (overlapRatio(regions[i], regions[j]) < 0.6) {
          snapped[i] = { ...regions[i] };
          snapped[j] = { ...regions[j] };
        }
      }
    }
  }

  return snapped;
}

/** The whole image: the fallback when vision returned nothing usable. */
export function wholeImageRegion(
  beatIndex: number,
  size: ImageSize,
): PlannedRegion {
  return { beatIndex, x: 0, y: 0, width: size.width, height: size.height };
}

export interface PlannedAnnotation {
  text: string;
  /** The narration beat spoken while this zone is drawn. */
  beatIndex: number;
  region: { x: number; y: number; width: number; height: number };
  reveal: { startMs: number; durationMs: number };
}

/**
 * Assembles an image's annotations: where to draw, and when.
 *
 * The entry time needs no model — it follows from the preceding beats. Each
 * annotation is drawn while its text is spoken, so the drawing follows the
 * voice without manual syncing.
 *
 * A beat with no read region keeps the whole image: a zone too wide beats a
 * scene where nothing gets drawn.
 */
export function planAnnotations(input: {
  scene: ScriptScene;
  regions: PlannedRegion[];
  size: ImageSize;
  /**
   * The measured duration of each beat, in order. It always wins over the
   * breakdown's estimate: drawing syncs to the voice actually produced,
   * otherwise the drift accumulates from one beat to the next.
   */
  beatDurationsMs?: number[];
}): PlannedAnnotation[] {
  // Several zones can target the SAME beat: a narration often names several
  // drawn subjects. So they are grouped per beat, in returned order — a Map
  // keyed by beatIndex kept only one, and the scene
  const byBeat = new Map<number, PlannedRegion[]>();
  const numBeats = input.scene.beats.length;
  for (const region of input.regions) {
    const clamped = clampRegion(region, input.size);
    const beatIndex =
      numBeats > 0
        ? Math.max(0, Math.min(clamped.beatIndex, numBeats - 1))
        : clamped.beatIndex;
    const list = byBeat.get(beatIndex) ?? [];
    list.push({ ...clamped, beatIndex });
    byBeat.set(beatIndex, list);
  }

  const annotations: PlannedAnnotation[] = [];
  let startMs = 0;

  input.scene.beats.forEach((beat, index) => {
    const measured = input.beatDurationsMs?.[index];
    const durationMs =
      measured && measured > 0
        ? measured
        : Math.round(beat.durationSec * 1000);

    const rawRegions = byBeat.get(index) ?? [wholeImageRegion(index, input.size)];
    const regions = mergeTooShortZones(rawRegions, durationMs, index);

    // The beat's time is shared among its zones: the voice says one sentence
    // while several subjects are drawn. Their sum must equal its duration
    // EXACTLY, otherwise drift accumulates from beat to beat — which is why
    // the last one absorbs the division remainder.
    const part = Math.floor(durationMs / regions.length);

    regions.forEach((region, rank) => {
      const isLast = rank === regions.length - 1;
      const partDurationMs = isLast
        ? durationMs - part * (regions.length - 1)
        : part;

      annotations.push({
        text: zoneText(region, beat.narration, rank),
        beatIndex: index,
        region: {
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        },
        reveal: { startMs, durationMs: partDurationMs },
      });
      startMs += partDurationMs;
    });
  });

  if (annotations.length === 0) {
    return [wholeImageAnnotation(input.size, input.beatDurationsMs)];
  }

  return annotations;
}

/**
 * An image with no narration beat is still an image to draw.
 *
 * Without this fallback it came out with zero annotations, so a scene where
 * nothing is drawn: the film froze on an empty frame. The whole image thus
 * becomes a single zone, revealed over the scene's duration.
 */
function wholeImageAnnotation(
  size: ImageSize,
  beatDurationsMs?: number[],
): PlannedAnnotation {
  const measured = (beatDurationsMs ?? []).reduce(
    (total, ms) => total + Math.max(0, ms),
    0,
  );
  const region = wholeImageRegion(0, size);
  return {
    text: "",
    beatIndex: 0,
    region: {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    },
    reveal: {
      startMs: 0,
      durationMs: measured > 0 ? measured : BEATLESS_IMAGE_DURATION_MS,
    },
  };
}

/** The duration of a silent image, aligned on the breakdown default. */
const BEATLESS_IMAGE_DURATION_MS = 5000;

/**
 * What a zone displays.
 *
 * Its label if it has one. Otherwise the spoken sentence, but on the FIRST
 * zone only: repeating it on each subject would fill the list and transcript
 * with the same line, and the following ones are drawn silently.
 */
function zoneText(
  region: PlannedRegion,
  narration: string,
  rank: number,
): string {
  const label = region.label?.trim();
  if (label) return label;
  return rank === 0 ? narration : "";
}

/**
 * Minimum duration for a readable whiteboard stroke.
 * Below it, the pen "blinks" without giving the viewer time to see.
 */
export const MIN_ZONE_DURATION_MS = 400;

/**
 * If a short beat names several subjects but its total time cannot allot at
 * least MIN_ZONE_DURATION_MS per subject, zones are merged or capped to keep
 * the animation readable.
 */
export function mergeTooShortZones(
  regions: PlannedRegion[],
  durationMs: number,
  beatIndex: number,
): PlannedRegion[] {
  if (regions.length <= 1) return regions;
  const maxZones = Math.max(1, Math.floor(durationMs / MIN_ZONE_DURATION_MS));
  if (regions.length <= maxZones) return regions;

  // If the total time is so short that only one zone is viable, enclose all
  // subjects so none is left out.
  if (maxZones === 1) {
    const x = Math.min(...regions.map((r) => r.x));
    const y = Math.min(...regions.map((r) => r.y));
    const maxX = Math.max(...regions.map((r) => r.x + r.width));
    const maxY = Math.max(...regions.map((r) => r.y + r.height));
    const label = regions.map((r) => r.label).filter(Boolean).join(", ");
    return [
      {
        beatIndex,
        label: label || undefined,
        x,
        y,
        width: maxX - x,
        height: maxY - y,
      },
    ];
  }

  return regions.slice(0, maxZones);
}

/**
 * What the vision model is asked.
 *
 * Beats are numbered so it ties each zone to the one spoken while it is drawn,
 * and dimensions are restated so it answers in pixels of THIS image.
 *
 * It used to be asked ONE zone per beat: a sentence naming three things thus
 * drew only one, framed so wide it covered the rest.
 *
 * The last three rules come from checking real images: the instruction "cover
 * the subject" returned points placed on it — a 50x50 square in the middle of
 * a cup spanning 900, i.e. 2% of the image. The pen then drew almost nothing.
 * Saying to enclose the WHOLE subject, with a margin, and giving a minimum size
 * moved those same rectangles to 21% and 35% of the image, now around the
 * subject.
 */
export function buildVisionPrompt(input: {
  scene: ScriptScene;
  size: ImageSize;
}): string {
  const beats = input.scene.beats
    .map((beat, index) => `${index}. ${beat.narration}`)
    .join("\n");

  return `This drawing is revealed piece by piece while a narrator speaks.

Narration beats, in order:
${beats}

For EACH beat, give the rectangle a pen would need to sweep to draw the part
of the illustration that illustrates it.

Rules:
- Coordinates in pixels of this image, which is ${input.size.width} wide and ${input.size.height} tall
- x and y are the top-left corner of the rectangle
- Give ONE REGION PER DRAWN SUBJECT the beat talks about, not one per beat. A
  beat that names several things gets several regions, all carrying that beat's
  beatIndex. Only a beat about a single subject gets a single region.
- Label every region with what it encloses, three words at most, in the
  language of the narration
- ENCLOSE THE WHOLE SUBJECT: the rectangle must contain every stroke of that
  subject from edge to edge, plus about 5% margin. A box that cuts through the
  drawing is wrong.
- INCLUDE ADJACENT LABELS AND CONNECTORS: if a drawn subject has a hand-lettered
  keyword label or an arrow attached to it, the rectangle MUST include both the
  drawing and its label/arrow. Never cut between a subject and its label.
- A region is never a point on the subject: each one is normally 15% to 60% of
  the image. Anything under 5% is almost certainly a mistake.
- If a beat describes the whole drawing, return the bounding box of all the ink.
- Regions may overlap, but each must centre on a DIFFERENT subject: never
  return the same subject twice, for one beat or across beats
- Order regions in the chronological order they are mentioned in the narration`;
}
