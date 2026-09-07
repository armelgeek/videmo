import type { EditableClip } from "./storyboard-clips";

/**
 * Un appel de synthese : quel texte dire, et ou ranger le resultat.
 */
/**
 * Le plafond de caracteres d'un appel au moteur de synthese.
 *
 * L'API en accepte 4096 ; on garde une marge, la jointure entre temps ajoutant
 * quelques caracteres. Une image depasse rarement ce budget — le decoupage vise
 * peu d'images, mais rien ne l'interdit — et depasser rendait un 400 qui
 * privait toute l'image de sa voix.
 */
export const BUDGET_CARACTERES = 3800;

export interface NarrationJob {
  clipIndex: number;
  /** Tout ce que l'image dit, d'une traite. */
  text: string;
  /**
   * Ses temps, dans l'ordre, pour que la route les retrouve dans
   * l'enregistrement. Absents pour une image qui n'en porte aucun.
   */
  beats?: { narration: string }[];
  /**
   * Le rang de chaque temps DANS l'image, dans l'ordre de `beats`.
   *
   * Un rang par temps, et non un simple decalage : un temps vide est ecarte de
   * la synthese mais garde sa place dans l'image, si bien que les rangs ne se
   * suivent pas forcement.
   */
  beatIndexes?: number[];
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

    const dits = (clip.beats ?? [])
      .map((beat, index) => ({ narration: beat.narration, index }))
      .filter((entree) => entree.narration.trim());

    if (dits.length > 0) {
      // Une image trop longue pour un seul appel se dit en plusieurs
      // enregistrements, coupes ENTRE deux temps et jamais au milieu de l'un :
      // un temps coupe ne se retrouverait plus dans sa transcription.
      for (const groupe of grouperSousLeBudget(dits)) {
        jobs.push({
          clipIndex,
          text: groupe.map((entree) => entree.narration.trim()).join(" "),
          beats: groupe.map((entree) => ({ narration: entree.narration })),
          beatIndexes: groupe.map((entree) => entree.index),
        });
      }
      return;
    }

    const text = (clip.summary || clip.title || "").trim();
    if (text) jobs.push({ clipIndex, text });
  });

  return jobs;
}

/**
 * Repartit les temps en groupes qui tiennent dans un appel.
 *
 * Un temps plus long que le budget a lui seul part quand meme, seul : le
 * refuser priverait l'image de sa voix, alors que le moteur, lui, tronquera au
 * pire.
 */
function grouperSousLeBudget<T extends { narration: string }>(
  beats: T[],
): T[][] {
  const groupes: T[][] = [];
  let courant: T[] = [];
  let taille = 0;

  for (const beat of beats) {
    const longueur = beat.narration.trim().length + 1;
    if (courant.length > 0 && taille + longueur > BUDGET_CARACTERES) {
      groupes.push(courant);
      courant = [];
      taille = 0;
    }
    courant.push(beat);
    taille += longueur;
  }

  if (courant.length > 0) groupes.push(courant);
  return groupes;
}
