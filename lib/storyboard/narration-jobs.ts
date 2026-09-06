import type { EditableClip } from "./storyboard-clips";

/**
 * Un appel de synthese : quel texte dire, et ou ranger le resultat.
 *
 * `beatIndex` absent designe l'image entiere — le repli pour un projet ouvert
 * avant le decoupage en temps, dont les clips n'en portent aucun.
 */
export interface NarrationJob {
  clipIndex: number;
  beatIndex?: number;
  text: string;
}

/**
 * Ce qu'il y a a synthetiser, temps par temps.
 *
 * La voix se produisait par image, a partir de la narration entiere. Les
 * annotations, elles, se calent sur la duree de CHAQUE temps : sans un fichier
 * par temps, le placement retombait sur l'estimation du decoupage, qui derive
 * de 15 % et decale le trace un peu plus a chaque temps.
 *
 * Decouper ne coute rien de plus : le TTS est facture au caractere, et c'est le
 * meme texte.
 */
export function narrationJobs(clips: EditableClip[]): NarrationJob[] {
  const jobs: NarrationJob[] = [];

  clips.forEach((clip, clipIndex) => {
    if (clip.isSection) return;

    const beats = clip.beats ?? [];
    if (beats.length > 0) {
      beats.forEach((beat, beatIndex) => {
        const text = beat.narration.trim();
        if (text) jobs.push({ clipIndex, beatIndex, text });
      });
      return;
    }

    const text = (clip.summary || clip.title || "").trim();
    if (text) jobs.push({ clipIndex, text });
  });

  return jobs;
}
