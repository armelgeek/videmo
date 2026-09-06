import type { StoryboardPanel } from "@/lib/storyboard/schema";

export interface NarrationPart {
  /**
   * `null` designe un silence de la meme duree, et non un morceau a sauter :
   * l'annotation d'un temps sans voix — texte vide, ou synthese echouee —
   * occupe quand meme sa place, et l'omettre avancerait tout ce qui suit.
   */
  url: string | null;
  durationMs: number;
}

/**
 * Les morceaux de voix du projet, dans l'ordre du film.
 *
 * L'etape whiteboard ne joue qu'UNE piste (`whiteboardConfig.audio`), remplie
 * jusqu'ici par un televersement a la main : la voix produite par la chaine ne
 * l'atteignait jamais, et un export sortait muet. On la reconstitue donc en
 * mettant les temps bout a bout.
 *
 * Les coller suffit, sans silence a intercaler : `deriveTimeline` place chaque
 * annotation a la somme des durees qui la precedent, exactement celles de ces
 * fichiers. La piste et le trace partent donc du meme calcul.
 *
 * Un projet d'avant le decoupage par temps garde sa voix par image : elle est
 * reprise telle quelle plutot que perdue.
 */
export function narrationParts(panels: StoryboardPanel[]): NarrationPart[] {
  const parts: NarrationPart[] = [];

  for (const panel of panels) {
    const beats = panel.beats ?? [];
    const parles = beats.filter((beat) => beat.audioUrl);

    if (parles.length === 0 && beats.length === 0) {
      if (panel.audioUrl) {
        parts.push({
          url: panel.audioUrl,
          durationMs: Math.round((panel.duration || 5) * 1000),
        });
      }
      continue;
    }

    for (const beat of beats) {
      parts.push({
        url: beat.audioUrl ?? null,
        durationMs:
          beat.audioDurationMs && beat.audioDurationMs > 0
            ? beat.audioDurationMs
            : Math.round(beat.durationSec * 1000),
      });
    }
  }

  return parts;
}

/** La duree de la piste reconstituee : la somme de ses morceaux. */
export function narrationDurationMs(parts: NarrationPart[]): number {
  return parts.reduce((total, part) => total + part.durationMs, 0);
}
