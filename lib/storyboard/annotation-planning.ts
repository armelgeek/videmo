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

export interface InkCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Aimante un rectangle devine sur le sujet reellement dessine.
 *
 * La vision situe bien mais chiffre mal : verifie sur de vraies illustrations,
 * elle rendait la flamme decalee de deux cents pixels, ou un carre de 50x50 au
 * milieu d'une tasse. Les bornes exactes, elles, sont dans l'image — l'encre
 * les porte. On ne demande donc plus au modele que de DESIGNER un sujet, et le
 * rectangle vient de la mesure.
 *
 * L'appariement se fait sur la surface commune. Sans recouvrement — le modele
 * a vise le papier vide — on prend le sujet dont le centre est le plus proche :
 * il s'est trompe de cadre, rarement de direction.
 *
 * Sans candidat (image illisible, page blanche), le rectangle devine passe tel
 * quel : mieux vaut une zone approximative que pas d'annotation.
 */
export function snapToInk(
  region: PlannedRegion,
  candidates: InkCandidate[],
): PlannedRegion {
  if (candidates.length === 0) return region;

  let meilleur: InkCandidate | null = null;
  let meilleureSurface = 0;

  for (const candidate of candidates) {
    const largeur =
      Math.min(region.x + region.width, candidate.x + candidate.width) -
      Math.max(region.x, candidate.x);
    const hauteur =
      Math.min(region.y + region.height, candidate.y + candidate.height) -
      Math.max(region.y, candidate.y);
    const surface = Math.max(0, largeur) * Math.max(0, hauteur);

    if (surface > meilleureSurface) {
      meilleureSurface = surface;
      meilleur = candidate;
    }
  }

  if (!meilleur) {
    let plusProche = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const dx =
        region.x + region.width / 2 - (candidate.x + candidate.width / 2);
      const dy =
        region.y + region.height / 2 - (candidate.y + candidate.height / 2);
      const distance = dx * dx + dy * dy;
      if (distance < plusProche) {
        plusProche = distance;
        meilleur = candidate;
      }
    }
  }

  const cible = meilleur as InkCandidate;
  return {
    beatIndex: region.beatIndex,
    x: cible.x,
    y: cible.y,
    width: cible.width,
    height: cible.height,
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
 *
 * Les trois dernieres regles viennent d'une verification sur de vraies images :
 * la consigne « couvre le sujet » rendait des points poses dessus — un carre de
 * 50x50 au milieu d'une tasse qui en occupe 900, soit 2 % de l'image. Le stylo
 * ne dessinait alors presque rien. Dire d'englober le sujet ENTIER, avec une
 * marge, et donner une taille plancher a fait passer ces memes rectangles a
 * 21 % et 35 % de l'image, cette fois autour du sujet.
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
- Return exactly one region per beat, with beatIndex matching the numbers above
- ENCLOSE THE WHOLE SUBJECT: the rectangle must contain every stroke of that
  subject from edge to edge, plus about 5% margin. A box that cuts through the
  drawing is wrong.
- A region is never a point on the subject: each one is normally 15% to 60% of
  the image. Anything under 5% is almost certainly a mistake.
- If a beat describes the whole drawing, return the bounding box of all the ink.
- Regions may overlap, but each should centre on a different subject`;
}
