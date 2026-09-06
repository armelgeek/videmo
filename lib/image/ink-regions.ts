/**
 * Les rectangles de l'encre, mesures sur l'image.
 *
 * Demander ses coordonnees a un modele de vision ne marche pas : verifie sur de
 * vraies illustrations, il rend un point pose au milieu du sujet, ou un cadre
 * decale d'un sujet a l'autre. Or un dessin au trait noir sur papier blanc porte
 * ses propres bornes — il suffit de les lire. Le modele n'a plus alors qu'a
 * APPARIER un temps de narration a l'un de ces rectangles, ce qu'il fait bien.
 */
export interface InkRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Le nombre de pixels d'encre : sert a ecarter les poussieres. */
  inkPixels: number;
}

export interface InkRegionsInput {
  /** Luminance par pixel, 0 = noir, 255 = blanc, en ligne par ligne. */
  luminance: Uint8Array;
  width: number;
  height: number;
  /** En dessous de quoi un pixel est de l'encre. */
  threshold?: number;
  /**
   * La distance en pixels sous laquelle deux traits appartiennent au meme
   * sujet. Sans elle, le contour d'un grain et sa fente interieure comptaient
   * pour deux dessins.
   */
  gap?: number;
  /**
   * La part de l'image en pixels d'encre sous laquelle un amas est du bruit —
   * une poussiere du papier, un point de trame — et non un sujet.
   */
  minInkRatio?: number;
}

/**
 * Regroupe l'encre en sujets, et rend le rectangle de chacun.
 *
 * Le regroupement passe par une grille grossiere plutot que par les pixels :
 * deux traits voisins tombent dans des cases voisines, donc se rejoignent, et
 * l'image entiere se parcourt une fois au lieu d'etre dilatee.
 */
export function inkRegions(input: InkRegionsInput): InkRegion[] {
  const { luminance, width, height } = input;
  const threshold = input.threshold ?? 128;
  const gap = Math.max(1, input.gap ?? Math.round(Math.min(width, height) / 40));
  const minInkRatio = input.minInkRatio ?? 0.00004;

  const cols = Math.ceil(width / gap);
  const rows = Math.ceil(height / gap);

  // Par case : la quantite d'encre et les bornes reelles des pixels sombres.
  const ink = new Int32Array(cols * rows);
  const minX = new Int32Array(cols * rows).fill(width);
  const minY = new Int32Array(cols * rows).fill(height);
  const maxX = new Int32Array(cols * rows).fill(-1);
  const maxY = new Int32Array(cols * rows).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (luminance[y * width + x] >= threshold) continue;
      const cell = Math.floor(y / gap) * cols + Math.floor(x / gap);
      ink[cell]++;
      if (x < minX[cell]) minX[cell] = x;
      if (y < minY[cell]) minY[cell] = y;
      if (x > maxX[cell]) maxX[cell] = x;
      if (y > maxY[cell]) maxY[cell] = y;
    }
  }

  const seen = new Uint8Array(cols * rows);
  const regions: InkRegion[] = [];
  const minInk = Math.max(1, Math.round(width * height * minInkRatio));

  for (let start = 0; start < ink.length; start++) {
    if (seen[start] || ink[start] === 0) continue;

    // Parcours en largeur sur les cases voisines, diagonales comprises : un
    // trait oblique ne doit pas casser le sujet en deux.
    const pile = [start];
    seen[start] = 1;
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    let pixels = 0;

    while (pile.length > 0) {
      const cell = pile.pop() as number;
      pixels += ink[cell];
      if (minX[cell] < x0) x0 = minX[cell];
      if (minY[cell] < y0) y0 = minY[cell];
      if (maxX[cell] > x1) x1 = maxX[cell];
      if (maxY[cell] > y1) y1 = maxY[cell];

      const cx = cell % cols;
      const cy = Math.floor(cell / cols);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const next = ny * cols + nx;
          if (seen[next] || ink[next] === 0) continue;
          seen[next] = 1;
          pile.push(next);
        }
      }
    }

    if (pixels < minInk || x1 < x0) continue;
    regions.push({
      x: x0,
      y: y0,
      width: x1 - x0 + 1,
      height: y1 - y0 + 1,
      inkPixels: pixels,
    });
  }

  // Le sujet le plus dessine d'abord : c'est celui dont un temps parle en
  // general, et la liste soumise au modele est plafonnee.
  return regions.sort((a, b) => b.inkPixels - a.inkPixels);
}
