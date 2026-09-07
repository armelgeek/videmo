import type { EditableClip } from "./storyboard-clips";

/**
 * Le plafond de caracteres d'un appel au moteur de synthese.
 *
 * L'API en accepte 4096 ; on garde une marge, la jointure entre temps ajoutant
 * quelques caracteres.
 */
export const BUDGET_CARACTERES = 3800;

/** Ou ranger le resultat d'un temps : son image, et son rang dedans. */
export interface NarrationPlace {
  clipIndex: number;
  beatIndex: number;
}

export interface NarrationJob {
  /** Tout ce que cet enregistrement dit, d'une traite. */
  text: string;
  /** Ses temps, dans l'ordre, pour que la route les y retrouve. */
  beats: { narration: string }[];
  /** Ou ranger chacun d'eux, dans le meme ordre. */
  places: NarrationPlace[];
}

/**
 * Ce qu'il y a a enregistrer : le script ENTIER, d'une seule traite.
 *
 * On a d'abord synthetise chaque temps de narration separement, puis chaque
 * image. Les deux fois, la couture s'entend : un TTS relance repart a zero,
 * sans liaison ni elan, et l'oreille reconnait le raccord. Ce qui avait motive
 * le decoupage — connaitre la duree de chaque temps — ne le demandait pas :
 * les temps se RETROUVENT dans l'enregistrement par la transcription.
 *
 * Le seul decoupage restant est celui que le moteur impose : au-dela de son
 * plafond de caracteres, on coupe ENTRE deux temps, jamais au milieu de l'un —
 * un temps coupe ne se retrouverait plus dans sa propre transcription. Un
 * script ordinaire tient en un seul appel, donc en une seule voix.
 */
export function narrationJobs(clips: EditableClip[]): NarrationJob[] {
  const dits: { narration: string; place: NarrationPlace }[] = [];

  clips.forEach((clip, clipIndex) => {
    if (clip.isSection) return;

    const beats = clip.beats ?? [];
    if (beats.length === 0) {
      const texte = (clip.summary || clip.title || "").trim();
      // Une image sans temps n'a rien ou ranger un instant : elle se dit
      // quand meme, comme un temps unique couvrant l'image.
      if (texte) dits.push({ narration: texte, place: { clipIndex, beatIndex: -1 } });
      return;
    }

    beats.forEach((beat, beatIndex) => {
      if (beat.narration.trim()) {
        dits.push({ narration: beat.narration, place: { clipIndex, beatIndex } });
      }
    });
  });

  return grouperSousLeBudget(dits).map((groupe) => ({
    text: groupe.map((entree) => entree.narration.trim()).join(" "),
    beats: groupe.map((entree) => ({ narration: entree.narration })),
    places: groupe.map((entree) => entree.place),
  }));
}

/**
 * Repartit les temps en groupes qui tiennent dans un appel.
 *
 * Un temps plus long que le budget a lui seul part quand meme, seul : le
 * refuser priverait le film de cette voix, alors que le moteur, lui, tronquera
 * au pire.
 */
function grouperSousLeBudget<T extends { narration: string }>(
  dits: T[],
): T[][] {
  const groupes: T[][] = [];
  let courant: T[] = [];
  let taille = 0;

  for (const dit of dits) {
    const longueur = dit.narration.trim().length + 1;
    if (courant.length > 0 && taille + longueur > BUDGET_CARACTERES) {
      groupes.push(courant);
      courant = [];
      taille = 0;
    }
    courant.push(dit);
    taille += longueur;
  }

  if (courant.length > 0) groupes.push(courant);
  return groupes;
}
