import { z } from "zod";
import type { ScriptScene } from "./script-generation";

/**
 * La zone d'une image qu'un temps de narration revele, en pixels de l'image.
 *
 * Le modele qui ecrit le decoupage ne voit pas l'illustration : ces rectangles
 * ne peuvent venir que d'une lecture de l'image elle-meme.
 */
export const plannedRegionSchema = z.object({
  beatIndex: z.number().int().nonnegative(),
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
 * Ramene un rectangle a l'interieur de l'image.
 *
 * Un modele de vision situe correctement mais chiffre approximativement : il
 * deborde, rend des largeurs negatives, ou repond en pourcentages. Une region
 * hors cadre ferait dessiner le stylo dans le vide, alors qu'une region
 * rabotee reste utilisable.
 */
export function clampRegion(
  region: PlannedRegion,
  size: ImageSize,
): PlannedRegion {
  // Des valeurs toutes inferieures a 1 sont des fractions, pas des pixels.
  const fractional =
    region.x <= 1 && region.y <= 1 && region.width <= 1 && region.height <= 1;
  const scaleX = fractional ? size.width : 1;
  const scaleY = fractional ? size.height : 1;

  const x = Math.min(Math.max(region.x * scaleX, 0), size.width);
  const y = Math.min(Math.max(region.y * scaleY, 0), size.height);
  const width = Math.min(Math.max(region.width * scaleX, 1), size.width - x);
  const height = Math.min(Math.max(region.height * scaleY, 1), size.height - y);

  return {
    beatIndex: region.beatIndex,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** L'image entiere : le repli quand la vision n'a rien rendu d'exploitable. */
export function wholeImageRegion(
  beatIndex: number,
  size: ImageSize,
): PlannedRegion {
  return { beatIndex, x: 0, y: 0, width: size.width, height: size.height };
}

export interface PlannedAnnotation {
  text: string;
  region: { x: number; y: number; width: number; height: number };
  reveal: { startMs: number; durationMs: number };
}

/**
 * Assemble les annotations d'une image : ou dessiner, et quand.
 *
 * Le moment d'entree ne demande aucun modele — il se deduit des temps qui
 * precedent. Chaque annotation est tracee pendant que son texte est dit, si
 * bien que le dessin suit la voix sans calage manuel.
 *
 * Un temps sans region lue garde l'image entiere : mieux vaut une zone trop
 * large qu'une scene ou rien ne se dessine.
 */
export function planAnnotations(input: {
  scene: ScriptScene;
  regions: PlannedRegion[];
  size: ImageSize;
  /**
   * La duree mesuree de chaque temps, dans l'ordre. Elle prime toujours sur
   * l'estimation du decoupage : le trace se cale sur la voix reellement
   * produite, sinon l'ecart s'accumule d'un temps au suivant.
   */
  beatDurationsMs?: number[];
}): PlannedAnnotation[] {
  const byBeat = new Map(
    input.regions.map((region) => [region.beatIndex, clampRegion(region, input.size)]),
  );

  let startMs = 0;
  return input.scene.beats.map((beat, index) => {
    const measured = input.beatDurationsMs?.[index];
    const durationMs =
      measured && measured > 0
        ? measured
        : Math.round(beat.durationSec * 1000);
    const region = byBeat.get(index) ?? wholeImageRegion(index, input.size);
    const annotation: PlannedAnnotation = {
      text: beat.narration,
      region: {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      },
      reveal: { startMs, durationMs },
    };
    startMs += durationMs;
    return annotation;
  });
}

/**
 * Ce qu'on demande au modele de vision.
 *
 * Les temps sont numerotes pour qu'il rende un rectangle par temps, et les
 * dimensions rappelees pour qu'il reponde en pixels de CETTE image.
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

For EACH beat, give the rectangle of the drawing that illustrates it, so the
pen can draw that area while the beat is spoken.

Rules:
- Coordinates in pixels of this image, which is ${input.size.width} wide and ${input.size.height} tall
- x and y are the top-left corner of the rectangle
- Return exactly one region per beat, with beatIndex matching the numbers above
- Cover the drawn subject for that beat, not the empty paper around it
- Regions may overlap slightly, but each should centre on a different subject`;
}
