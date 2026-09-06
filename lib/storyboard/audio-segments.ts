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
  /** Le temps de narration dont il vient, absent pour une voix par image. */
  beatIndex?: number;
}

/**
 * Decoupe la voix d'une image en morceaux places dans son temps.
 *
 * La synthese produit desormais un fichier par temps de narration : une image
 * n'a plus une seule URL a poser sur la piste, mais une suite. Les projets
 * enregistres avant ce decoupage n'ont que `audioUrl` — ils rendent alors un
 * seul morceau couvrant l'image, sans quoi ils perdraient leur voix.
 *
 * La duree de chaque morceau vient du fichier mesure quand elle existe ; a
 * defaut de l'estimation du decoupage, qui derive mais vaut mieux que rien.
 */
export function panelAudioSegments(panel: StoryboardPanel): AudioSegment[] {
  const beats = panel.beats ?? [];
  const spoken = beats.filter((beat) => beat.audioUrl);

  if (spoken.length === 0) {
    return panel.audioUrl
      ? [{ url: panel.audioUrl, offsetSec: 0, durationSec: panel.duration || 5 }]
      : [];
  }

  const segments: AudioSegment[] = [];
  let offsetSec = 0;

  beats.forEach((beat, beatIndex) => {
    const durationSec =
      beat.audioDurationMs && beat.audioDurationMs > 0
        ? beat.audioDurationMs / 1000
        : beat.durationSec;

    // Un temps muet n'a rien a poser, mais il occupe quand meme sa place : le
    // sauter sans avancer ferait parler le suivant trop tot.
    if (beat.audioUrl) {
      segments.push({ url: beat.audioUrl, offsetSec, durationSec, beatIndex });
    }
    offsetSec += durationSec;
  });

  return segments;
}
