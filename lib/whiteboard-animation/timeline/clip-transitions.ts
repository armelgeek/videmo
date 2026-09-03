/**
 * Decide s'il y a une transition en cours a un instant donne, et ou elle en est.
 *
 * La transition se loge dans le BLANC qui separe deja deux clips, plafonnee a
 * sa largeur : la duree totale de la video ne change donc jamais, et la
 * narration ne derive pas. Une transition plus longue s'obtient en allongeant
 * ce blanc a l'ecriture, pas en debordant sur les clips.
 */

export type TransitionName =
  | "none"
  | "cut"
  | "fade"
  | "slideup"
  | "slidedown"
  | "slideleft"
  | "slideright";

export interface Transition {
  type: TransitionName;
  /** Duree souhaitee. Plafonnee au blanc reellement disponible. */
  durationMs: number;
}

/** Fenetre d'un clip sur l'horloge globale, avec sa transition de SORTIE. */
export interface ClipWindow {
  startMs: number;
  endMs: number;
  transition?: Transition;
}

export interface ActiveTransition {
  name: TransitionName;
  /** 0 au debut de la fenetre, tend vers 1 a sa fin. */
  t: number;
}

export function transitionAt(
  clips: ClipWindow[],
  globalMs: number,
): ActiveTransition | null {
  for (let i = 0; i < clips.length - 1; i++) {
    const sortant = clips[i];
    const entrant = clips[i + 1];

    const transition = sortant.transition;
    if (!transition || transition.type === "none") continue;

    const blanc = entrant.startMs - sortant.endMs;
    if (blanc <= 0) continue;

    const duree = Math.min(transition.durationMs, blanc);
    if (duree <= 0) continue;

    const ecoule = globalMs - sortant.endMs;
    if (ecoule < 0 || ecoule >= duree) continue;

    return { name: transition.type, t: ecoule / duree };
  }

  return null;
}
