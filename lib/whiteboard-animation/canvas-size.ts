/**
 * Dimensions du canvas d'apercu, derivees du ratio du PROJET.
 *
 * La resolution est un choix d'export, pas un reglage d'apercu : l'apercu rend
 * toujours a la meme densite et seule la forme change. On fixe donc le PETIT
 * cote, ce qui donne les conventions habituelles — 1280x720, 720x1280,
 * 720x720 — au lieu d'un canvas carre deux fois plus lourd que le 16:9.
 */
export const PETIT_COTE = 720;

export type RatioProjet = "16:9" | "9:16" | "1:1";

export interface TailleCanvas {
  width: number;
  height: number;
}

/** Canvas d'apercu pour ce ratio. Retombe sur 16:9 si le ratio est inconnu. */
export function tailleCanvas(ratio: RatioProjet | string | undefined): TailleCanvas {
  switch (ratio) {
    case "9:16":
      return { width: PETIT_COTE, height: Math.round((PETIT_COTE * 16) / 9) };
    case "1:1":
      return { width: PETIT_COTE, height: PETIT_COTE };
    default:
      return { width: Math.round((PETIT_COTE * 16) / 9), height: PETIT_COTE };
  }
}

/** Valeur CSS `aspect-ratio` correspondante. */
export function cssAspectRatio(ratio: RatioProjet | string | undefined): string {
  const { width, height } = tailleCanvas(ratio);
  return `${width} / ${height}`;
}
