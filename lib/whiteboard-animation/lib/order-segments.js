/**
 * Ordonne des segments de trace par plus proche voisin, sans le cout en N².
 *
 * POURQUOI
 * Les styles a encre (IllustFill, OutlineFill) decoupent le dessin en segments
 * puis les enchainent : a chaque etape, le segment repris est celui dont une
 * extremite est la plus proche de la ou la main vient de s'arreter. Ecrit
 * naivement, c'est un balayage de tous les segments restants a chaque etape,
 * donc N² comparaisons. Sur une illustration un peu fournie N depasse le
 * millier, et ce seul calcul tenait le fil principal plusieurs centaines de ms
 * — a CHAQUE entree de region, puisque setup() est rejoue par annotation.
 *
 * COMMENT
 * Les extremites sont rangees dans une grille regulière. La recherche part de
 * la cellule de la main et s'ouvre en anneaux : des que l'anneau courant est
 * plus loin que le meilleur candidat deja trouve, aucun anneau suivant ne peut
 * faire mieux et la recherche s'arrete. Le resultat est le MEME que le
 * balayage complet — c'est le meme plus proche voisin, avec les memes regles
 * de departage — seul le nombre de comparaisons change. orderSegmentsNaive
 * reste ici comme reference executable, et un test verifie que les deux
 * repondent la meme chose.
 *
 * DEPARTAGE
 * A distance egale, le balayage naif garde ce qu'il a vu en PREMIER : le plus
 * petit indice, et pour un meme segment son debut plutot que sa fin. La grille
 * visitant les cellules dans un autre ordre, la regle est ici explicite.
 */

'use strict';

/** Vrai si le candidat (d, i, debut) bat le meilleur courant. */
function meilleur(d, i, best) {
  if (best.i < 0) return true;
  if (d < best.d) return true;
  return d === best.d && i < best.i;
}

const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

/**
 * Reference : balayage complet. Conserve pour la parite, et utilisee telle
 * quelle quand les segments sont trop peu nombreux pour amortir la grille.
 *
 * @param segments  tableau de tableaux de points {x, y}
 * @param depart    {x, y} position de la main avant le premier segment
 * @returns les segments, reordonnes et retournes si besoin
 */
function orderSegmentsNaive(segments, depart) {
  const used = new Uint8Array(segments.length);
  const ordered = [];
  let hx = depart.x, hy = depart.y;

  for (let n = 0; n < segments.length; n++) {
    let bestD = Infinity, bestI = -1, bestFlip = false;
    for (let i = 0; i < segments.length; i++) {
      if (used[i]) continue;
      const seg = segments[i];
      const p0 = seg[0], pZ = seg[seg.length - 1];
      const d0 = dist2(p0.x, p0.y, hx, hy);
      const dZ = dist2(pZ.x, pZ.y, hx, hy);
      if (d0 < bestD) { bestD = d0; bestI = i; bestFlip = false; }
      if (dZ < bestD) { bestD = dZ; bestI = i; bestFlip = true; }
    }
    if (bestI < 0) break;
    used[bestI] = 1;
    const seg = bestFlip ? [...segments[bestI]].reverse() : segments[bestI];
    ordered.push(seg);
    const last = seg[seg.length - 1];
    hx = last.x; hy = last.y;
  }
  return ordered;
}

/** En deca de ce nombre de segments, la grille coute plus qu'elle ne rapporte. */
const SEUIL_GRILLE = 64;

/** Nombre de segments vise par cellule : au-dela la grille devient une liste. */
const PAR_CELLULE = 2;

function orderSegments(segments, depart) {
  const N = segments.length;
  if (N === 0) return [];
  if (N < SEUIL_GRILLE) return orderSegmentsNaive(segments, depart);

  // Etendue des extremites : ce sont les seuls points que la grille indexe.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    const seg = segments[i];
    const a = seg[0], z = seg[seg.length - 1];
    if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
    if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y;
    if (z.x < minX) minX = z.x; if (z.x > maxX) maxX = z.x;
    if (z.y < minY) minY = z.y; if (z.y > maxY) maxY = z.y;
  }

  const largeur = Math.max(1, maxX - minX);
  const hauteur = Math.max(1, maxY - minY);
  // Cote de cellule vise pour tenir PAR_CELLULE extremites par case.
  const cote = Math.max(1, Math.sqrt((largeur * hauteur * PAR_CELLULE) / (2 * N)));
  const nx = Math.max(1, Math.ceil(largeur / cote) + 1);
  const ny = Math.max(1, Math.ceil(hauteur / cote) + 1);

  const colonne = (x) => Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / cote)));
  const ligne = (y) => Math.min(ny - 1, Math.max(0, Math.floor((y - minY) / cote)));

  // Une cellule porte les indices de segment dont une extremite y tombe. Un
  // segment y figure deux fois si ses deux bouts partagent la cellule : sans
  // consequence, le candidat retenu est le meme.
  const cellules = new Array(nx * ny);
  const poser = (cx, cy, i) => {
    const k = cy * nx + cx;
    (cellules[k] || (cellules[k] = [])).push(i);
  };
  for (let i = 0; i < N; i++) {
    const seg = segments[i];
    const a = seg[0], z = seg[seg.length - 1];
    poser(colonne(a.x), ligne(a.y), i);
    poser(colonne(z.x), ligne(z.y), i);
  }

  const used = new Uint8Array(N);
  const ordered = [];
  let hx = depart.x, hy = depart.y;
  let restants = N;

  while (restants > 0) {
    const cx = colonne(hx), cy = ligne(hy);
    const best = { d: Infinity, i: -1, flip: false };

    const examiner = (gx, gy) => {
      const liste = cellules[gy * nx + gx];
      if (!liste) return;
      for (let n = 0; n < liste.length; n++) {
        const i = liste[n];
        if (used[i]) continue;
        const seg = segments[i];
        const p0 = seg[0], pZ = seg[seg.length - 1];
        const d0 = dist2(p0.x, p0.y, hx, hy);
        const dZ = dist2(pZ.x, pZ.y, hx, hy);
        // Debut d'abord : a egalite parfaite, le naif ne retourne pas le segment.
        if (meilleur(d0, i, best)) { best.d = d0; best.i = i; best.flip = false; }
        if (dZ < best.d || (dZ === best.d && i < best.i)) {
          best.d = dZ; best.i = i; best.flip = true;
        }
      }
    };

    const rMax = Math.max(nx, ny);
    for (let r = 0; r <= rMax; r++) {
      // Un anneau de rang r est a au moins (r-1) cellules de distance reelle :
      // des qu'il est plus loin que le meilleur candidat, la recherche est finie.
      if (best.i >= 0 && r > 1) {
        const plancher = (r - 1) * cote;
        if (plancher * plancher > best.d) break;
      }
      const x0 = cx - r, x1 = cx + r, y0 = cy - r, y1 = cy + r;
      if (r === 0) {
        if (cx >= 0 && cx < nx && cy >= 0 && cy < ny) examiner(cx, cy);
        continue;
      }
      for (let gx = Math.max(0, x0); gx <= Math.min(nx - 1, x1); gx++) {
        if (y0 >= 0) examiner(gx, y0);
        if (y1 < ny) examiner(gx, y1);
      }
      for (let gy = Math.max(0, y0 + 1); gy <= Math.min(ny - 1, y1 - 1); gy++) {
        if (x0 >= 0) examiner(x0, gy);
        if (x1 < nx) examiner(x1, gy);
      }
    }

    if (best.i < 0) break;
    used[best.i] = 1;
    restants--;
    const seg = best.flip ? [...segments[best.i]].reverse() : segments[best.i];
    ordered.push(seg);
    const last = seg[seg.length - 1];
    hx = last.x; hy = last.y;
  }

  return ordered;
}

module.exports = { orderSegments, orderSegmentsNaive };
