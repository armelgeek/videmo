/**
 * Preview canvas dimensions, derived from the PROJECT's ratio.
 *
 * Resolution is an export choice, not a preview setting: the preview always
 * renders at the same density and only the shape changes. So we fix the SHORT
 * side, which gives the usual conventions — 1280x720, 720x1280, 720x720 —
 * instead of a square canvas twice as heavy as 16:9.
 */
export const PETIT_COTE = 720;

export type RatioProjet = "16:9" | "9:16" | "1:1";

export interface TailleCanvas {
  width: number;
  height: number;
}

/** Preview canvas for this ratio. Falls back to 16:9 if the ratio is unknown. */
export function canvasSize(ratio: RatioProjet | string | undefined): TailleCanvas {
  switch (ratio) {
    case "9:16":
      return { width: PETIT_COTE, height: Math.round((PETIT_COTE * 16) / 9) };
    case "1:1":
      return { width: PETIT_COTE, height: PETIT_COTE };
    default:
      return { width: Math.round((PETIT_COTE * 16) / 9), height: PETIT_COTE };
  }
}

/** Matching CSS `aspect-ratio` value. */
export function cssAspectRatio(ratio: RatioProjet | string | undefined): string {
  const { width, height } = canvasSize(ratio);
  return `${width} / ${height}`;
}

export interface RectContenu {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Centered rectangle where the artwork fits ENTIRELY in the canvas, without
 * distortion.
 *
 * The old render stretched the image over the whole canvas: a 16:9 scene
 * squashed into a 9:16 frame. On a whiteboard the background is white, so the
 * bars left by a "contain" fit are invisible — there is no reason to distort
 * the drawing.
 */
export function rectContenu(
  canvasW: number,
  canvasH: number,
  srcW: number,
  srcH: number
): RectContenu {
  if (srcW <= 0 || srcH <= 0) return { x: 0, y: 0, w: canvasW, h: canvasH };
  const scale = Math.min(canvasW / srcW, canvasH / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  return { x: Math.round((canvasW - w) / 2), y: Math.round((canvasH - h) / 2), w, h };
}

/**
 * Moves a region from one artwork rectangle to another.
 *
 * Used when the canvas changes shape: regions are stored in canvas pixels, so
 * without this they would stay at the old canvas's coordinates. We MOVE them
 * instead of regenerating them from the demo scene, so as not to lose the
 * annotations the user has edited.
 */
export function reprojeterRegion(
  region: { x: number; y: number; width: number; height: number },
  from: RectContenu,
  to: RectContenu
) {
  if (from.w <= 0 || from.h <= 0) return region;
  const sx = to.w / from.w;
  const sy = to.h / from.h;
  return {
    x: Math.round(to.x + (region.x - from.x) * sx),
    y: Math.round(to.y + (region.y - from.y) * sy),
    width: Math.round(region.width * sx),
    height: Math.round(region.height * sy),
  };
}
