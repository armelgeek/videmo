import type { StoryboardPanel } from "./schema";

/**
 * Un morceau de voix a poser sur la piste audio : quel fichier, a quel moment
 * de l'image, et pour combien de temps. Les secondes sont l'unite de la
 * timeline ; les durees mesurees, elles, sont en millisecondes.
 */
export interface AudioSegment {
  url: string;
  /** Depuis le debut de l'image, en secondes. */
  offsetSec: number;
  durationSec: number;
}

/**
 * La voix d'une image, posee sur sa piste.
 *
 * Il y a eu un fichier par temps de narration, qu'il fallait placer un a un.
 * Une image est desormais dite d'une traite — ses temps y sont retrouves par la
 * transcription, ils ne la decoupent plus — donc un seul morceau suffit, et il
 * couvre l'image entiere.
 */
export function panelAudioSegments(panel: StoryboardPanel): AudioSegment[] {
  if (!panel.audioUrl) return [];

  const durationSec =
    panel.audioDurationMs && panel.audioDurationMs > 0
      ? panel.audioDurationMs / 1000
      : panel.duration || 5;

  return [{ url: panel.audioUrl, offsetSec: 0, durationSec }];
}
