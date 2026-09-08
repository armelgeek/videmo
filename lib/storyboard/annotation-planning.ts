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
  /**
   * Ce que la zone entoure, en quelques mots. Une narration decrit souvent
   * plusieurs sujets dessines : sans etiquette, chacun porterait la phrase
   * entiere et l'editeur afficherait la meme ligne autant de fois.
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
  // Des dimensions strictement positives et inferieures ou egales a 1 sont des
  // fractions, pas des pixels. x et y ne sont PAS testes : ils valent
  // legitimement 0 dans les deux systemes (coin haut-gauche), ce qui causait
  // une fausse detection et multipliait des coordonnees pixels par la taille
  // image. Les valeurs negatives ne sont pas des fractions : elles seront
  // corrigees par le clamp qui suit.
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
 * Le rapport de surface au-dela duquel un sujet mesure est tenu pour deux
 * choses soudees. En dessous, le modele et la mesure parlent du meme objet et
 * la mesure gagne : elle seule connait les bords exacts.
 */
const FUSION_SUSPECTE = 2.5;

export interface SubjectCandidate {
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
 * milieu d'une tasse. Les bornes exactes, elles, sont dans l'image — ce qui se
 * detache du fond les porte. On ne demande donc plus au modele que de DESIGNER
 * un sujet, et le rectangle vient de la mesure.
 *
 * L'appariement se fait sur la surface commune. Sans recouvrement — le modele
 * a vise le papier vide — on prend le sujet dont le centre est le plus proche :
 * il s'est trompe de cadre, rarement de direction.
 *
 * Sans candidat (image illisible, page blanche), le rectangle devine passe tel
 * quel : mieux vaut une zone approximative que pas d'annotation.
 */
export function snapToSubject(
  region: PlannedRegion,
  candidates: SubjectCandidate[],
): PlannedRegion {
  if (candidates.length === 0) return region;

  let meilleur: SubjectCandidate | null = null;
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

  const cible = meilleur as SubjectCandidate;

  // Un sujet bien plus grand que ce que le modele visait n'en est pas un : des
  // traits voisins ont fusionne. Verifie sur une illustration ou le grain de
  // cafe touche les lignes de la table — la mesure rendait les trois comme un
  // seul objet, large et plat. On garde alors la part que le modele designait,
  // bornee par le sujet mesure : ses bords a lui, son cadrage a elle.
  const surfaceCible = cible.width * cible.height;
  const surfaceVisee = region.width * region.height;
  if (surfaceVisee > 0 && surfaceCible > surfaceVisee * FUSION_SUSPECTE) {
    const x = Math.max(region.x, cible.x);
    const y = Math.max(region.y, cible.y);
    const width =
      Math.min(region.x + region.width, cible.x + cible.width) - x;
    const height =
      Math.min(region.y + region.height, cible.y + cible.height) - y;
    if (width > 0 && height > 0) {
      return { beatIndex: region.beatIndex, label: region.label, x, y, width, height };
    }
  }

  return {
    beatIndex: region.beatIndex,
    label: region.label,
    x: cible.x,
    y: cible.y,
    width: cible.width,
    height: cible.height,
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
 * Recadre les régions lues sur les sujets mesurés tout en empêchant deux
 * régions distinctes de s'écraser sur le même sujet fusionné.
 */
export function snapRegionsToSubjects(
  regions: PlannedRegion[],
  candidates: SubjectCandidate[],
): PlannedRegion[] {
  if (candidates.length === 0 || regions.length === 0) return regions;

  const snapped = regions.map((r) => snapToSubject(r, candidates));

  // Anti-collision : si deux régions visaient des sujets différents dans la
  // vision (< 60% chevauchement d'origine) mais que la mesure les a ramenées
  // sur le même candidat (> 80% chevauchement après snap), elles conservent
  // leurs rectangles distincts de la vision pour ne pas se dupliquer.
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

/** L'image entiere : le repli quand la vision n'a rien rendu d'exploitable. */
export function wholeImageRegion(
  beatIndex: number,
  size: ImageSize,
): PlannedRegion {
  return { beatIndex, x: 0, y: 0, width: size.width, height: size.height };
}

export interface PlannedAnnotation {
  text: string;
  /** Le temps de narration dit pendant que cette zone se trace. */
  beatIndex: number;
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
  // Plusieurs zones peuvent viser le MEME temps : une narration nomme souvent
  // plusieurs sujets dessines. Elles se rangent donc par temps, dans l'ordre
  // rendu — une Map indexee par beatIndex n'en gardait qu'une, et la scene
  const byBeat = new Map<number, PlannedRegion[]>();
  const numBeats = input.scene.beats.length;
  for (const region of input.regions) {
    const clamped = clampRegion(region, input.size);
    const beatIndex =
      numBeats > 0
        ? Math.max(0, Math.min(clamped.beatIndex, numBeats - 1))
        : clamped.beatIndex;
    const liste = byBeat.get(beatIndex) ?? [];
    liste.push({ ...clamped, beatIndex });
    byBeat.set(beatIndex, liste);
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
    const regions = regrouperZonesTropBreves(rawRegions, durationMs, index);

    // Le temps du beat se partage entre ses zones : la voix dit une phrase
    // pendant que plusieurs sujets se tracent. Leur somme doit valoir
    // EXACTEMENT sa duree, sinon l'ecart s'accumule d'un temps au suivant —
    // c'est pourquoi la derniere absorbe le reste de la division.
    const part = Math.floor(durationMs / regions.length);

    regions.forEach((region, rang) => {
      const derniere = rang === regions.length - 1;
      const partDurationMs = derniere
        ? durationMs - part * (regions.length - 1)
        : part;

      annotations.push({
        text: texteDeZone(region, beat.narration, rang),
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
 * Une image sans aucun temps de narration reste une image a dessiner.
 *
 * Sans ce repli elle sortait avec zero annotation, donc une scene ou rien ne
 * se trace : le film s'arretait sur un cadre vide. Toute l'image devient donc
 * une seule zone, revelee sur la duree de la scene.
 */
function wholeImageAnnotation(
  size: ImageSize,
  beatDurationsMs?: number[],
): PlannedAnnotation {
  const mesure = (beatDurationsMs ?? []).reduce(
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
      durationMs: mesure > 0 ? mesure : DUREE_IMAGE_SANS_TEMPS_MS,
    },
  };
}

/** La duree d'une image muette, alignee sur le defaut du decoupage. */
const DUREE_IMAGE_SANS_TEMPS_MS = 5000;

/**
 * Ce qu'une zone affiche.
 *
 * Son etiquette si elle en a une. Sinon la phrase dite, mais sur la PREMIERE
 * zone seulement : la repeter sur chaque sujet remplirait la liste et le
 * transcript de la meme ligne, et les suivantes se tracent en silence.
 */
function texteDeZone(
  region: PlannedRegion,
  narration: string,
  rang: number,
): string {
  const etiquette = region.label?.trim();
  if (etiquette) return etiquette;
  return rang === 0 ? narration : "";
}

/**
 * Durée minimale pour un tracé whiteboard compréhensible.
 * En dessous, le stylo « cligne » sans laisser au spectateur le temps de voir.
 */
export const DUREE_MIN_ZONE_MS = 400;

/**
 * Si un beat court nomme plusieurs sujets mais que son temps total ne permet
 * pas d'allouer au moins DUREE_MIN_ZONE_MS par sujet, on fusionne ou limite
 * les zones pour préserver la lisibilité de l'animation.
 */
export function regrouperZonesTropBreves(
  regions: PlannedRegion[],
  durationMs: number,
  beatIndex: number,
): PlannedRegion[] {
  if (regions.length <= 1) return regions;
  const maxZones = Math.max(1, Math.floor(durationMs / DUREE_MIN_ZONE_MS));
  if (regions.length <= maxZones) return regions;

  // Si le temps total est si court qu'une seule zone est viable, on englobe
  // l'ensemble des sujets pour qu'aucun ne soit omis.
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
 * Ce qu'on demande au modele de vision.
 *
 * Les temps sont numerotes pour qu'il rattache chaque zone a celui qu'on dit
 * pendant qu'elle se trace, et les dimensions rappelees pour qu'il reponde en
 * pixels de CETTE image.
 *
 * On lui demandait UNE zone par temps : une phrase qui nomme trois choses n'en
 * faisait donc dessiner qu'une, cadree si large qu'elle couvrait le reste.
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
