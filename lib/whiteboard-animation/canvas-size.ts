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

export interface RectContenu {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Rectangle centre ou l'artwork tient EN ENTIER dans le canvas, sans
 * deformation.
 *
 * L'ancien rendu etirait l'image sur tout le canvas : une scene 16:9 ecrasee
 * dans un cadre 9:16. Sur un whiteboard le fond est blanc, donc les bandes
 * laissees par un ajustement "contain" ne se voient pas — il n'y a aucune
 * raison de deformer le dessin.
 */
export function rectContenu(
  canvasW: number,
  canvasH: number,
  srcW: number,
  srcH: number
): RectContenu {
  if (srcW <= 0 || srcH <= 0) return { x: 0, y: 0, w: canvasW, h: canvasH };
  const echelle = Math.min(canvasW / srcW, canvasH / srcH);
  const w = Math.round(srcW * echelle);
  const h = Math.round(srcH * echelle);
  return { x: Math.round((canvasW - w) / 2), y: Math.round((canvasH - h) / 2), w, h };
}

/**
 * Transporte une region d'un rectangle d'artwork vers un autre.
 *
 * Sert quand le canvas change de forme : les regions sont stockees en pixels
 * de canvas, donc sans cela elles resteraient aux coordonnees de l'ancien.
 * On les DEPLACE au lieu de les regenerer depuis la scene de demo, pour ne pas
 * perdre les annotations que l'utilisateur a editees.
 */
export function reprojeterRegion(
  region: { x: number; y: number; width: number; height: number },
  de: RectContenu,
  vers: RectContenu
) {
  if (de.w <= 0 || de.h <= 0) return region;
  const sx = vers.w / de.w;
  const sy = vers.h / de.h;
  return {
    x: Math.round(vers.x + (region.x - de.x) * sx),
    y: Math.round(vers.y + (region.y - de.y) * sy),
    width: Math.round(region.width * sx),
    height: Math.round(region.height * sy),
  };
}
