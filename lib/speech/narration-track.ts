import type { StoryboardPanel } from "@/lib/storyboard/schema";

export interface NarrationPart {
  url: string;
  durationMs: number;
}

/**
 * Les enregistrements du projet, dans l'ordre du film.
 *
 * Un par image en general : chaque image est dite d'une traite, et ses temps y
 * sont retrouves par la transcription. Une image trop longue pour un seul appel
 * au moteur en porte plusieurs — ses temps designent alors des voix
 * differentes, et c'est ce changement d'URL qui separe les enregistrements.
 *
 * Il n'y a rien a coller : ces morceaux se posent tels quels sur la piste.
 */
export function narrationParts(panels: StoryboardPanel[]): NarrationPart[] {
  const parts: NarrationPart[] = [];

  for (const panel of panels) {
    const dits = (panel.beats ?? []).filter((beat) => beat.audioUrl);

    if (dits.length === 0) {
      if (!panel.audioUrl) continue;
      parts.push({
        url: panel.audioUrl,
        durationMs:
          panel.audioDurationMs && panel.audioDurationMs > 0
            ? panel.audioDurationMs
            : Math.round((panel.duration || 5) * 1000),
      });
      continue;
    }

    // Un enregistrement par suite de temps partageant la meme voix. Sa duree
    // est la fin du dernier temps qu'il porte : eux seuls savent ou ils
    // s'arretent dedans.
    let courant: { url: string; durationMs: number } | null = null;
    for (const beat of dits) {
      const fin = (beat.startMs ?? 0) + (beat.audioDurationMs ?? 0);
      if (courant && courant.url === beat.audioUrl) {
        courant.durationMs = Math.max(courant.durationMs, fin);
        continue;
      }
      courant = { url: beat.audioUrl as string, durationMs: fin };
      parts.push(courant);
    }
  }

  return parts;
}

/** La duree de la narration entiere : la somme de ses enregistrements. */
export function narrationDurationMs(parts: NarrationPart[]): number {
  return parts.reduce((total, part) => total + part.durationMs, 0);
}
