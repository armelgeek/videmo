import type { ClipWindow } from "./clip-transitions";

/** Position et largeur PIXEL d'une carte de transition, a la frontiere d'un clip. */
export interface TransitionMarker {
  /** Index dans `clips` du panneau SORTANT — celui qui porte `transition`. */
  panelIdx: number;
  x: number;
  width: number;
}

/**
 * Traduit chaque frontiere de clip portant une transition en une carte
 * positionnee en pixels, plafonnee au blanc disponible.
 *
 * Meme regle de plafonnement que transitionAt (docs/superpowers/specs/
 * 2026-09-03-clip-transitions-design.md), dupliquee ici volontairement : le
 * composant qui consomme ce module n'a pas besoin de connaitre le renderer
 * canvas pour savoir ou dessiner une carte.
 */
export function markerGeometry(
  clips: ClipWindow[],
  pxParMs: number,
): TransitionMarker[] {
  const marqueurs: TransitionMarker[] = [];

  for (let i = 0; i < clips.length - 1; i++) {
    const sortant = clips[i];
    const entrant = clips[i + 1];

    const transition = sortant.transition;
    if (!transition || transition.type === "none") continue;

    const blanc = entrant.startMs - sortant.endMs;
    if (blanc <= 0) continue;

    const duree = Math.min(transition.durationMs, blanc);
    if (duree <= 0) continue;

    marqueurs.push({
      panelIdx: i,
      x: sortant.endMs * pxParMs,
      width: duree * pxParMs,
    });
  }

  return marqueurs;
}
