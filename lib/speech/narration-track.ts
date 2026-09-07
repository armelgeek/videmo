import type { StoryboardPanel } from "@/lib/storyboard/schema";

export interface NarrationPart {
  url: string;
  durationMs: number;
}

/**
 * Les enregistrements du projet, dans l'ordre du film : UN par image.
 *
 * Il y en avait un par temps de narration, et il fallait les coller pour
 * obtenir une piste. Chaque image etant desormais dite d'une traite — ses temps
 * y sont retrouves par la transcription — il n'y a plus rien a coller : ces
 * morceaux se posent tels quels sur la piste, chacun a sa place.
 */
export function narrationParts(panels: StoryboardPanel[]): NarrationPart[] {
  const parts: NarrationPart[] = [];

  for (const panel of panels) {
    if (!panel.audioUrl) continue;
    parts.push({
      url: panel.audioUrl,
      // La duree mesuree sur le fichier prime ; a defaut celle du decoupage,
      // qui derive mais vaut mieux que rien.
      durationMs:
        panel.audioDurationMs && panel.audioDurationMs > 0
          ? panel.audioDurationMs
          : Math.round((panel.duration || 5) * 1000),
    });
  }

  return parts;
}

/** La duree de la narration entiere : la somme de ses enregistrements. */
export function narrationDurationMs(parts: NarrationPart[]): number {
  return parts.reduce((total, part) => total + part.durationMs, 0);
}
