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
 * La marque des annotations posees par la planification.
 *
 * Elle distingue ce que la machine a place de ce que l'utilisateur a dessine :
 * une seconde passe remplace les siennes et garde celles de l'utilisateur.
 */
export const PLANNED_SOURCE = "plan";

/**
 * L'identifiant d'une annotation planifiee : stable, donc remplacable.
 *
 * Le rang n'apparait qu'a partir de la seconde zone d'un meme temps : les
 * identifiants deja enregistres, du temps ou chaque temps n'en avait qu'une,
 * restent inchanges et se remplacent au lieu de se dupliquer.
 */
export function plannedAnnotationId(
  panelId: string,
  beatIndex: number,
  rang = 0,
): string {
  const base = `${panelId}-beat-${beatIndex}`;
  return rang === 0 ? base : `${base}-${rang}`;
}

function isPlanned(annotation: Annotation): boolean {
  return annotation.metadata?.source === PLANNED_SOURCE;
}

/**
 * Traduit les annotations planifiees dans le repere ou l'editeur les ecrit.
 *
 * La vision repond en pixels de l'image ; les annotations enregistrees, elles,
 * sont en pixels du canvas d'apercu, ou le dessin tient centre sans
 * deformation (`rectContenu`). Ecrire les unes pour les autres placerait le
 * stylo a cote du sujet des que le ratio du projet ne suit pas celui de
 * l'image.
 *
 * L'ordre du tableau porte le temps — `deriveTimeline` recalcule `startMs`
 * depuis lui — donc les temps de narration viennent d'abord, dans leur ordre.
 * Une annotation dessinee a la main est conservee, a la suite : elle rallonge
 * la scene plutot que de decaler la voix des temps qui la precedent.
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

  // Indexer les annotations existantes pour conserver leurs personnalisations
  // (couleur de trait, style d'animation) lors d'une replanification.
  const existingById = new Map<string, Annotation>();
  for (const a of input.existing ?? []) {
    existingById.set(a.id, a);
  }

  // Un temps peut porter plusieurs zones : le rang les distingue. L'index du
  // tableau ne suffit plus, il ne designait le temps que tant qu'il n'y en
  // avait qu'une par temps.
  const rangs = new Map<number, number>();
  const planned: Annotation[] = input.planned.map((annotation, index) => {
    const beatIndex = annotation.beatIndex;
    const rang = rangs.get(beatIndex) ?? 0;
    rangs.set(beatIndex, rang + 1);

    const id = plannedAnnotationId(input.panelId, beatIndex, rang);
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
 * Le transcript du projet, deduit des annotations planifiees.
 *
 * Chaque cue porte deja `annotationId` : le lien entre un temps de narration et
 * ce qui se dessine pendant qu'il est dit se remplissait a la main dans
 * l'editeur, alors que la planification le connait par construction.
 *
 * Les bornes sont absolues sur l'horloge du projet, comme le rendu les attend :
 * chaque scene commence ou la precedente s'est terminee.
 */
export function transcriptFromPanels(panels: StoryboardPanel[]): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  let cursor = 0;

  for (const panel of panels) {
    for (const annotation of panel.annotations ?? []) {
      const durationMs = annotation.reveal?.durationMs ?? 0;
      const startMs = cursor + (annotation.reveal?.gapBeforeMs ?? 0);
      cursor = startMs + durationMs;

      // Une annotation sans texte n'est pas un temps de narration : elle
      // occupe le temps de la scene, mais n'a rien a lire.
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
