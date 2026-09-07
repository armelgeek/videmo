import type { StoryboardPanel } from "./schema";

/**
 * Ce qu'une image occupe dans la narration : quel fichier, ou l'on entre
 * dedans, et pour combien de temps. Les secondes sont l'unite de la timeline.
 */
export interface AudioSegment {
  url: string;
  /** Ou commence cette image DANS le fichier, en secondes. */
  offsetSec: number;
  durationSec: number;
}

/**
 * La part de narration qui revient a une image.
 *
 * Le script est dit d'une traite : plusieurs images partagent le meme fichier,
 * et chacune n'en occupe qu'une tranche. C'est `offsetSec` qui dit laquelle —
 * sans lui, chaque image rejouerait la narration depuis le debut.
 */
export function panelAudioSegments(panel: StoryboardPanel): AudioSegment[] {
  const dits = (panel.beats ?? []).filter((beat) => beat.audioUrl);

  if (dits.length === 0) {
    if (!panel.audioUrl) return [];
    const durationSec =
      panel.audioDurationMs && panel.audioDurationMs > 0
        ? panel.audioDurationMs / 1000
        : panel.duration || 5;
    return [{ url: panel.audioUrl, offsetSec: 0, durationSec }];
  }

  const debutMs = dits[0].startMs ?? 0;
  const dernier = dits[dits.length - 1];
  const finMs = (dernier.startMs ?? 0) + (dernier.audioDurationMs ?? 0);

  return [
    {
      url: dits[0].audioUrl as string,
      offsetSec: debutMs / 1000,
      durationSec: Math.max(0.001, (finMs - debutMs) / 1000),
    },
  ];
}
