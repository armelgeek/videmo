import type { EditableClip } from "./storyboard-clips";

/**
 * Un appel de synthese : quel texte dire, et ou ranger le resultat.
 */
export interface NarrationJob {
  clipIndex: number;
  /** Tout ce que l'image dit, d'une traite. */
  text: string;
  /**
   * Ses temps, dans l'ordre, pour que la route les retrouve dans
   * l'enregistrement. Absents pour une image qui n'en porte aucun.
   */
  beats?: { narration: string }[];
}

/**
 * Ce qu'il y a a synthetiser : UNE voix par image, jamais par temps.
 *
 * Les annotations ont besoin de la duree de chaque temps. On a d'abord cru
 * qu'il fallait donc produire chaque temps separement — c'etait resoudre un
 * probleme de mesure par un decoupage de production, et il en decoulait une
 * concatenation, un melange, la fin de chaque temps rognee a la bascule, et
 * une prosodie hachee : un TTS relance a chaque phrase repart a zero, sans
 * liaison ni elan.
 *
 * L'image est enregistree d'une traite, et ses temps sont RETROUVES dedans par
 * la transcription. `beats` accompagne donc la demande : la route s'en sert
 * pour rendre a chacun son instant.
 */
export function narrationJobs(clips: EditableClip[]): NarrationJob[] {
  const jobs: NarrationJob[] = [];

  clips.forEach((clip, clipIndex) => {
    if (clip.isSection) return;

    const beats = (clip.beats ?? []).filter((beat) => beat.narration.trim());
    if (beats.length > 0) {
      jobs.push({
        clipIndex,
        text: beats.map((beat) => beat.narration.trim()).join(" "),
        beats: beats.map((beat) => ({ narration: beat.narration })),
      });
      return;
    }

    const text = (clip.summary || clip.title || "").trim();
    if (text) jobs.push({ clipIndex, text });
  });

  return jobs;
}
