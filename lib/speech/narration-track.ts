import type { StoryboardPanel } from "@/lib/storyboard/schema";

export interface NarrationPart {
  url: string;
  durationMs: number;
}

/**
 * Les enregistrements du projet, dans l'ordre du film.
 *
 * Un seul, en general : le script entier est dit d'une traite, et les temps y
 * sont retrouves par la transcription. Plusieurs images partagent donc la meme
 * voix, et c'est le changement d'URL — impose par le plafond de caracteres du
 * moteur — qui separe deux enregistrements.
 *
 * La duree de chacun est la fin du dernier temps qu'il porte : eux seuls savent
 * ou ils s'arretent dedans.
 */
export function narrationParts(panels: StoryboardPanel[]): NarrationPart[] {
  const parts: NarrationPart[] = [];
  let courant: NarrationPart | null = null;

  for (const panel of panels) {
    const dits = (panel.beats ?? []).filter((beat) => beat.audioUrl);

    if (dits.length === 0) {
      // Une image sans temps garde sa propre voix : rien n'y designe un
      // instant, donc elle ne partage rien.
      if (!panel.audioUrl) continue;
      courant = {
        url: panel.audioUrl,
        durationMs:
          panel.audioDurationMs && panel.audioDurationMs > 0
            ? panel.audioDurationMs
            : Math.round((panel.duration || 5) * 1000),
      };
      parts.push(courant);
      courant = null;
      continue;
    }

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
