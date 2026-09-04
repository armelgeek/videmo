import { toEngineAnnotations } from "@/lib/whiteboard-animation/timeline/annotation-interop";
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
    scenes: panels.map((panel) => {
      const p = panel as StoryboardPanel & {
        imageUrl?: string;
        annotations?: unknown[];
      };
      return {
        id: p.id,
        canvasImage: p.imageUrl ?? "",
        annotations: toEngineAnnotations(
          (p.annotations?.length
            ? p.annotations
            : config.annotations || []) as never,
        ),
        transition: null,
      };
    }),
  };
}
