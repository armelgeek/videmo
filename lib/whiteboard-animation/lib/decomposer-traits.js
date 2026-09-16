/**
 * Demele un dessin au trait en gestes, un par coup de feutre.
 *
 * POURQUOI
 * Les styles a encre decoupaient le dessin par balayage raster : ligne par
 * ligne, coupure des que le pixel suivant est trop loin. Sur une grille, la
 * ligne de balayage traverse chaque barre verticale et rend un segment par
 * barre et par rangee — des milliers de miettes, que l'enchainement par plus
 * proche voisin recolle ensuite dans un ordre qui n'a rien d'un geste. La main
 * part du milieu d'un croisement et s'etale vers les bords, au lieu de tracer
 * chaque barre d'un trait.
 *
 * COMMENT
 * Sur un squelette (voir squelette.js), chaque pixel d'encre a un degre : 1
 * pour un bout de trait, 2 pour un passage, 3 et plus pour une jonction. On
 * part des bouts — c'est la qu'une main pose le feutre — et on suit les arretes
 * une seule fois chacune.
 *
 * LA REGLE QUI COMPTE
 * A une jonction, on continue TOUT DROIT : parmi les branches libres, on prend
 * celle qui s'ecarte le moins de la direction d'arrivee. C'est ce qui fait
 * qu'une croix se lit comme deux barres qui se croisent, et non comme quatre
 * moignons partant du centre. Sans cette regle, le parcours tourne a angle
 * droit au premier croisement venu et le trace se disloque.
 *
 * Les boucles fermees n'ont aucun bout : elles sont reprises ensuite, depuis
 * un pixel quelconque, sinon un cercle ne serait jamais trace.
 */

'use strict';

const { VOISINS } = require('./squelette');

/** Direction opposee, dans l'ordre de VOISINS. */
const OPPOSE = [4, 5, 6, 7, 0, 1, 2, 3];

/** Longueur de chaque pas : les diagonales sont plus longues. */
const NORME = VOISINS.map(([dx, dy]) => Math.hypot(dx, dy));

function construireDegres(bits, W, H) {
  const degre = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!bits[idx]) continue;
      let d = 0;
      for (let i = 0; i < 8; i++) {
        const nx = x + VOISINS[i][0];
        const ny = y + VOISINS[i][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (bits[ny * W + nx]) d++;
      }
      degre[idx] = d;
    }
  }
  return degre;
}

/**
 * Suit un trait depuis (x, y) en partant dans la direction `dir0`.
 *
 * `vues` porte un bit par direction et par pixel : une arrete parcourue est
 * marquee des deux cotes, donc jamais reprise, quel que soit le sens.
 */
function suivre(bits, vues, W, H, x, y, dir0) {
  const trait = [{ x, y }];
  let cx = x;
  let cy = y;
  let dir = dir0;

  for (;;) {
    const idx = cy * W + cx;
    if (vues[idx] & (1 << dir)) break;

    const nx = cx + VOISINS[dir][0];
    const ny = cy + VOISINS[dir][1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || !bits[ny * W + nx]) break;

    vues[idx] |= 1 << dir;
    vues[ny * W + nx] |= 1 << OPPOSE[dir];
    trait.push({ x: nx, y: ny });
    cx = nx;
    cy = ny;

    // On continue le plus droit possible : le produit scalaire avec la
    // direction d'arrivee classe les branches, et la meilleure l'emporte.
    const ax = VOISINS[dir][0] / NORME[dir];
    const ay = VOISINS[dir][1] / NORME[dir];
    let meilleure = -1;
    let meilleurScore = -Infinity;
    for (let i = 0; i < 8; i++) {
      if (i === OPPOSE[dir]) continue;
      const vx = cx + VOISINS[i][0];
      const vy = cy + VOISINS[i][1];
      if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
      if (!bits[vy * W + vx]) continue;
      if (vues[(cy * W + cx)] & (1 << i)) continue;
      const score = ax * (VOISINS[i][0] / NORME[i]) + ay * (VOISINS[i][1] / NORME[i]);
      if (score > meilleurScore) { meilleurScore = score; meilleure = i; }
    }
    if (meilleure < 0) break;
    dir = meilleure;
  }

  return trait;
}

/** Les directions libres autour d'un pixel, dans l'ordre de VOISINS. */
function branchesLibres(bits, vues, W, H, x, y) {
  const libres = [];
  for (let i = 0; i < 8; i++) {
    const nx = x + VOISINS[i][0];
    const ny = y + VOISINS[i][1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (!bits[ny * W + nx]) continue;
    if (vues[y * W + x] & (1 << i)) continue;
    libres.push(i);
  }
  return libres;
}

/**
 * Decompose un squelette en traits.
 *
 * @param {Uint8Array} bits  squelette, 1 = encre
 * @param {number} W
 * @param {number} H
 * @param {number} minLongueur  les miettes plus courtes sont jetees
 * @returns {{x:number,y:number}[][]} un tableau de traits
 */
function decomposerTraits(bits, W, H, minLongueur = 2) {
  const degre = construireDegres(bits, W, H);
  const vues = new Uint8Array(W * H);
  const traits = [];

  const recolter = (x, y) => {
    for (const dir of branchesLibres(bits, vues, W, H, x, y)) {
      const trait = suivre(bits, vues, W, H, x, y, dir);
      if (trait.length >= minLongueur) traits.push(trait);
    }
  };

  // Les bouts d'abord : c'est la qu'un trait commence vraiment.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (bits[idx] && degre[idx] === 1) recolter(x, y);
    }
  }

  // Puis les jonctions : ce qui reste entre deux croisements.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (bits[idx] && degre[idx] >= 3) recolter(x, y);
    }
  }

  // Enfin les boucles fermees, qui n'ont ni bout ni jonction.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (bits[idx] && degre[idx] === 2) recolter(x, y);
    }
  }

  return traits;
}

module.exports = { decomposerTraits, construireDegres };
