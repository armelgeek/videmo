/**
 * Les rectangles des sujets dessines, mesures sur l'image.
 *
 * Demander ses coordonnees a un modele de vision ne marche pas : verifie sur de
 * vraies illustrations, il rend un point pose au milieu du sujet, ou un cadre
 * decale d'un sujet a l'autre. Or une illustration porte ses propres bornes —
 * il suffit de les lire. Le modele n'a plus alors qu'a APPARIER un temps de
 * narration a l'un de ces rectangles, ce qu'il fait bien.
 *
 * Ce qui compte n'est pas la couleur mais l'ECART AU FOND : un trait noir sur
 * papier blanc, une silhouette claire sur fond sombre ou un aplat colore se
 * mesurent de la meme facon. Restreindre la lecture aux pixels sombres ne
 * marchait que sur un whiteboard.
 */
export interface SubjectRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Le nombre de pixels du sujet : sert a ecarter les poussieres. */
  pixels: number;
}

export interface SubjectRegionsInput {
  /**
   * L'ecart au fond, par pixel, ligne par ligne : 0 = la couleur du fond,
   * 255 = son oppose. `contrastToBackground` le construit depuis une image.
   */
  contrast: Uint8Array;
  width: number;
  height: number;
  /** Au-dela de quoi un pixel appartient a un sujet, et non au fond. */
  threshold?: number;
  /**
   * La distance en pixels sous laquelle deux traits appartiennent au meme
   * sujet. Sans elle, le contour d'un grain et sa fente interieure comptaient
   * pour deux dessins.
   */
  gap?: number;
  /**
   * La part de l'image sous laquelle un amas est du bruit — une poussiere du
   * papier, un point de trame — et non un sujet.
   */
  minSubjectRatio?: number;
}

/**
 * Regroupe ce qui se detache du fond en sujets, et rend le rectangle de chacun.
 *
 * Le regroupement passe par une grille grossiere plutot que par les pixels :
 * deux traits voisins tombent dans des cases voisines, donc se rejoignent, et
 * l'image entiere se parcourt une fois au lieu d'etre dilatee.
 */
export function subjectRegions(input: SubjectRegionsInput): SubjectRegion[] {
  const { contrast, width, height } = input;
  const threshold = input.threshold ?? 64;
  const gap = Math.max(1, input.gap ?? Math.round(Math.min(width, height) / 40));
  const minSubjectRatio = input.minSubjectRatio ?? 0.00004;

  const cols = Math.ceil(width / gap);
  const rows = Math.ceil(height / gap);

  // Par case : la quantite de sujet, et les bornes reelles de ses pixels.
  const dense = new Int32Array(cols * rows);
  const minX = new Int32Array(cols * rows).fill(width);
  const minY = new Int32Array(cols * rows).fill(height);
  const maxX = new Int32Array(cols * rows).fill(-1);
  const maxY = new Int32Array(cols * rows).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (contrast[y * width + x] <= threshold) continue;
      const cell = Math.floor(y / gap) * cols + Math.floor(x / gap);
      dense[cell]++;
      if (x < minX[cell]) minX[cell] = x;
      if (y < minY[cell]) minY[cell] = y;
      if (x > maxX[cell]) maxX[cell] = x;
      if (y > maxY[cell]) maxY[cell] = y;
    }
  }

  const seen = new Uint8Array(cols * rows);
  const regions: SubjectRegion[] = [];
  const minPixels = Math.max(1, Math.round(width * height * minSubjectRatio));

  for (let start = 0; start < dense.length; start++) {
    if (seen[start] || dense[start] === 0) continue;

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
      pixels += dense[cell];
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
          if (seen[next] || dense[next] === 0) continue;
          seen[next] = 1;
          pile.push(next);
        }
      }
    }

    if (pixels < minPixels || x1 < x0) continue;
    regions.push({
      x: x0,
      y: y0,
      width: x1 - x0 + 1,
      height: y1 - y0 + 1,
      pixels,
    });
  }

  // Le sujet le plus dessine d'abord : c'est celui dont un temps parle en
  // general, et la liste soumise au modele est plafonnee.
  return regions.sort((a, b) => b.pixels - a.pixels);
}

/**
 * La couleur du fond, et l'ecart de chaque pixel a cette couleur.
 *
 * Le fond se lit sur le BORD de l'image : une illustration y laisse sa marge,
 * et c'est la seule zone dont on sait d'avance qu'elle n'est pas le sujet. La
 * mediane, et non la moyenne, pour qu'un sujet qui touche le bord ne deplace
 * pas la reference.
 *
 * L'ecart est pris canal par canal, au plus grand des trois : une silhouette
 * rouge sur fond vert a la meme luminance que lui et disparaissait quand on ne
 * regardait que le gris.
 *
 * Une image sans fond uni — une peinture pleine page — rend des ecarts partout,
 * donc un seul sujet couvrant tout. C'est le repli voulu : une zone trop large
 * plutot qu'aucune annotation.
 */
export function contrastToBackground(input: {
  /** Les pixels en RGBA, comme les rend un canvas. */
  rgba: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}): { contrast: Uint8Array; background: [number, number, number] } {
  const { rgba, width, height } = input;
  const bords: [number[], number[], number[]] = [[], [], []];

  const noter = (x: number, y: number) => {
    const p = (y * width + x) * 4;
    bords[0].push(rgba[p]);
    bords[1].push(rgba[p + 1]);
    bords[2].push(rgba[p + 2]);
  };
  for (let x = 0; x < width; x++) {
    noter(x, 0);
    noter(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    noter(0, y);
    noter(width - 1, y);
  }

  const mediane = (valeurs: number[]) => {
    valeurs.sort((a, b) => a - b);
    return valeurs[Math.floor(valeurs.length / 2)] ?? 255;
  };
  const background: [number, number, number] = [
    mediane(bords[0]),
    mediane(bords[1]),
    mediane(bords[2]),
  ];

  const contrast = new Uint8Array(width * height);
  for (let i = 0; i < contrast.length; i++) {
    const p = i * 4;
    contrast[i] = Math.max(
      Math.abs(rgba[p] - background[0]),
      Math.abs(rgba[p + 1] - background[1]),
      Math.abs(rgba[p + 2] - background[2]),
    );
  }

  return { contrast, background };
}
