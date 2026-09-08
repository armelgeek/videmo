import type { Annotation } from "@/lib/unified-engine/types";
import type { TailleCanvas } from "../canvas-size";
import { secoursMs, type PanelTiming } from "./panel-windows";

/** L'id local d'une image entiere, avant le prefixage par panneau. */
export const PLEINE_IMAGE_ID = "pleine-image";

/** La duree d'une image qui n'a ni voix mesuree ni duree reglee. */
const DUREE_PAR_DEFAUT_MS = 5000;

/**
 * Ce que la timeline montre pour une image SANS annotation.
 *
 * Sans elle, l'image ne posait aucun clip : la piste sautait d'une image a la
 * suivante, et le trou n'etait ni selectionnable ni deplacable. Toute l'image
 * devient donc UNE zone, sur la duree de sa voix — sinon celle qu'on lui a
 * reglee a l'etape storyboard.
 *
 * Elle n'est pas ecrite dans le projet : c'est une vue. Une edition qui la vise
 * ne trouve aucune annotation stockee et reste sans effet, ce qui vaut mieux
 * qu'un clip fantome absent de la piste.
 */
export function annotationPleineImage(
  panel: PanelTiming & { narration?: string },
  taille: TailleCanvas,
): Annotation {
  const brut = secoursMs(panel);
  const durationMs = brut > 0 ? brut : DUREE_PAR_DEFAUT_MS;

  return {
    id: PLEINE_IMAGE_ID,
    text: panel.narration ?? "",
    region: { x: 0, y: 0, width: taille.width, height: taille.height },
    reveal: {
      from: 0,
      to: durationMs,
      startMs: 0,
      durationMs,
    },
  };
}
