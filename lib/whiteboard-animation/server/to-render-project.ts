import { DEFAULT_ANIM_STYLE } from "../schema";
import { toEngineAnnotations } from "@/lib/whiteboard-animation/timeline/annotation-interop";
import { deriveTimeline } from "@/lib/whiteboard-animation/timeline/derive-timeline";
import { tailleCanvas } from "@/lib/whiteboard-animation/canvas-size";
import type { WhiteboardConfig } from "@/lib/storyboard/store";
import type { StoryboardPanel } from "@/lib/storyboard/schema";
import type { NarrationPart } from "@/lib/whiteboard-animation/audio/narration-schedule";

export interface RenderScene {
  id: string;
  canvasImage: string;
  annotations: unknown[];
  transition: { transitionAfter: string; transitionMs: number } | null;
}

export interface RenderProject {
  /** Repere dans lequel l'editeur a ecrit les regions : le canvas de l'apercu. */
  annotationSpace: { width: number; height: number };
  animStyle: string;
  hand: string;
  handSpeed: number;
  tileSlider: number;
  speed: number;
  /**
   * La voix. `parts` porte un morceau par temps de narration, place a son
   * debut absolu ; `audioUrl` reste la forme a une piste — un televersement,
   * ou un projet d'avant le decoupage.
   */
  narration: { audioUrl?: string; parts?: NarrationPart[] } | null;
  scenes: RenderScene[];
}

/**
 * Animation.DEFAULT_SPEED : toute autre valeur ferait deriver le dessin par
 * rapport a la narration, dont reveal.from/to sont les timestamps.
 */
const FIDELE_1X = 40;

export function toRenderProject({
  panels,
  config,
  aspectRatio = "16:9",
}: {
  panels: StoryboardPanel[];
  config: WhiteboardConfig;
  aspectRatio?: string;
}): RenderProject {
  // persistUrl et non url : `url` est une blob: URL, qui n'existe que dans
  // l'onglet qui l'a creee. Envoyee au rendu, ffmpeg ne peut pas la lire et la
  // video sortirait muette.
  const audioUrl = config.audio?.persistUrl ?? config.audio?.url ?? null;
  // La voix par temps prime : elle dit ou chaque morceau commence, la ou une
  // piste unique oblige a la reconcatener des qu'un temps change.
  const parts = config.narration?.length ? config.narration : null;

  return {
    // Les regions sont enregistrees en pixels du canvas d'apercu, dont la
    // taille ne depend que du ratio. Le renderer en a besoin pour les ramener
    // dans l'espace naturel de l'image avant SA propre projection.
    annotationSpace: tailleCanvas(aspectRatio),
    animStyle: DEFAULT_ANIM_STYLE,
    hand: config.handStyle,
    handSpeed: config.handSpeed ?? 5,
    tileSlider: config.chunks ?? 30,
    speed: FIDELE_1X,
    narration: parts ? { parts } : audioUrl ? { audioUrl } : null,
    scenes: scenesAvecBornes(panels, config),
  };
}

/**
 * Les scenes, chacune portant des bornes ABSOLUES sur l'horloge du projet.
 *
 * toEngineAnnotations pose from/to/startMs a zero : ce sont des remplacants,
 * deriveTimeline est cense les recalculer. Les laisser tels quels n'est pas
 * neutre — bornes() force alors `to = from + 1`, soit une fenetre d'UNE
 * milliseconde par annotation. Chaque scene ne recevait qu'une seule image,
 * celle de son etat initial, et la video sortait blanche et vide.
 *
 * On derive donc scene par scene (ce qui applique gapBeforeMs) puis on decale
 * du temps deja consomme, exactement comme l'apercu combine une timeline locale
 * et le clipOffsetMs de son clip.
 */
function scenesAvecBornes(
  panels: StoryboardPanel[],
  config: WhiteboardConfig,
): RenderScene[] {
  let curseur = 0;

  return panels.map((panel) => {
    const p = panel as StoryboardPanel & {
      imageUrl?: string;
      annotations?: unknown[];
      transition?: { type: string; durationMs: number };
    };

    const source = p.annotations?.length ? p.annotations : config.annotations || [];
    const derive = deriveTimeline(toEngineAnnotations(source as never));

    const annotations = derive.annotations.map((a) => ({
      ...a,
      reveal: {
        ...a.reveal,
        startMs: (a.reveal.startMs ?? 0) + curseur,
        from: (a.reveal.from ?? 0) + curseur,
        to: (a.reveal.to ?? 0) + curseur,
      },
    }));

    curseur += derive.totalDurationMs;

    // Le storyboard ecrit {type, durationMs}, le moteur lit
    // {transitionAfter, transitionMs} : sans cette traduction transitionApres()
    // rend 0 et aucun fondu n'est jamais rendu.
    const t = p.transition;
    const transition =
      t && t.type && t.type !== "none"
        ? { transitionAfter: t.type, transitionMs: t.durationMs }
        : null;

    return {
      id: p.id,
      canvasImage: p.imageUrl ?? "",
      annotations,
      transition,
    };
  });
}
