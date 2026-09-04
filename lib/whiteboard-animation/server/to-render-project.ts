import { toEngineAnnotations } from "@/lib/whiteboard-animation/timeline/annotation-interop";
import { deriveTimeline } from "@/lib/whiteboard-animation/timeline/derive-timeline";
import type { WhiteboardConfig } from "@/lib/storyboard/store";
import type { StoryboardPanel } from "@/lib/storyboard/schema";

export interface RenderScene {
  id: string;
  canvasImage: string;
  annotations: unknown[];
  transition: { transitionAfter: string | null } | null;
}

export interface RenderProject {
  animStyle: string;
  hand: string;
  handSpeed: number;
  tileSlider: number;
  speed: number;
  narration: { audioUrl: string } | null;
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
}: {
  panels: StoryboardPanel[];
  config: WhiteboardConfig;
}): RenderProject {
  // persistUrl et non url : `url` est une blob: URL, qui n'existe que dans
  // l'onglet qui l'a creee. Envoyee au rendu, ffmpeg ne peut pas la lire et la
  // video sortirait muette.
  const audioUrl = config.audio?.persistUrl ?? config.audio?.url ?? null;

  return {
    animStyle: config.animStyle,
    hand: config.handStyle,
    handSpeed: config.handSpeed ?? 5,
    tileSlider: config.chunks ?? 30,
    speed: FIDELE_1X,
    narration: audioUrl ? { audioUrl } : null,
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

    return {
      id: p.id,
      canvasImage: p.imageUrl ?? "",
      annotations,
      transition: null,
    };
  });
}
