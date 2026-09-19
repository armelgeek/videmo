/**
 * Choisit et decrit la facon dont une zone de couleur se remplit.
 *
 * POURQUOI
 * Le remplissage du moteur est un store qui descend : `wcFill` revele une
 * bande horizontale, du haut de la zone vers le bas, a vitesse constante. Sur
 * une grande surface cela passe, mais sur une petite tache de couleur le store
 * se voit — la main est posee au milieu d'un front parfaitement droit qu'aucun
 * feutre ne produit.
 *
 * Kinoslide (whiteboard-animator, MIT) tranche autrement : apres le contour,
 * la zone se remplit soit par un BALAYAGE INCLINE, soit par des COUPS DE
 * BROSSE, selon sa taille. Une petite zone se hachure a la main, une grande se
 * couvre d'un geste — c'est ce que fait quelqu'un devant un tableau, et c'est
 * la seule regle a retenir.
 *
 * COMMENT
 * Le basculement suit une courbe en S sur l'aire relative de la zone plutot
 * qu'un seuil sec : deux taches de tailles voisines doivent se remplir de
 * facon voisine, sinon le rendu saute d'une couleur a l'autre sans raison
 * visible. La courbe sert aussi a interpoler la largeur de brosse.
 *
 * CE MODULE EST PUR
 * Il ne dessine rien et ne touche a aucun canvas : il rend des nombres et des
 * polygones. Le style s'en sert pour poser ses clips. C'est ce qui rend la
 * geometrie verifiable sans canvas, que jsdom n'implemente pas.
 */

'use strict';

/** Aire relative ou le balayage devient plus credible que la brosse. */
const SWEEP_MIDPOINT = 0.18;

/** Raideur de la courbe : plus haut, plus la bascule est franche. */
const RAIDEUR = 12;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Part de balayage, entre 0 (tout a la brosse) et 1 (tout au balayage).
 *
 * @param {number} aireZone  aire de la zone de couleur, en pixels
 * @param {number} aireRegion aire de la region qui la contient
 */
function sweepWeight(aireZone, aireRegion) {
  if (!(aireRegion > 0)) return 0;
  const ratio = clamp01(aireZone / aireRegion);
  return 1 / (1 + Math.exp(-RAIDEUR * (ratio - SWEEP_MIDPOINT)));
}

/** Le mode retenu pour cette zone. */
function chooseFill(aireZone, aireRegion) {
  return sweepWeight(aireZone, aireRegion) > 0.5 ? 'sweep' : 'brosse';
}

/**
 * Largeur de brosse, en pixels.
 *
 * Elle grandit avec la zone — une grande tache hachuree au pinceau fin
 * demanderait des dizaines d'allers-retours et durerait trop — mais reste
 * bornee, sinon un seul coup couvre tout et le geste disparait.
 */
function brushWidth(box, echelle = 1) {
  const cote = Math.min(box.w, box.h);
  const brute = cote / 6;
  return Math.max(6 * echelle, Math.min(28 * echelle, brute));
}

/**
 * Les coups de brosse d'une zone, dans l'ordre ou la main les donne.
 *
 * Serpentin : chaque coup repart la ou le precedent s'est arrete, comme on
 * hachure sans lever le feutre. Rendre des segments plutot que des rectangles
 * laisse l'appelant choisir son trait, et permet de suivre la pointe.
 *
 * @returns {{x0:number,y0:number,x1:number,y1:number,sens:number}[]}
 */
function brushStrokes(box, largeur) {
  const pas = Math.max(1, largeur);
  const coups = [];
  let sens = 1;
  for (let y = box.y + pas / 2; y < box.y + box.h + pas / 2; y += pas) {
    const yc = Math.min(y, box.y + box.h);
    const gauche = box.x;
    const droite = box.x + box.w;
    coups.push(sens > 0
      ? { x0: gauche, y0: yc, x1: droite, y1: yc, sens: 1 }
      : { x0: droite, y0: yc, x1: gauche, y1: yc, sens: -1 });
    sens = -sens;
  }
  return coups;
}

/**
 * Le front d'un balayage incline, sous forme de droite `nx*x + ny*y = d`.
 *
 * L'angle est celui du geste ; la normale en decoule. `d` va de la valeur qui
 * ne revele rien a celle qui revele tout, donc `progress` 0 et 1 encadrent
 * exactement la zone, sans frame perdue avant ou apres.
 */
function frontSweep(box, progress, angleDeg = 35) {
  const a = (angleDeg * Math.PI) / 180;
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  const coins = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ].map(([x, y]) => nx * x + ny * y);
  const min = Math.min(...coins);
  const max = Math.max(...coins);
  return { nx, ny, d: min + clamp01(progress) * (max - min) };
}

/**
 * La part de la boite situee derriere le front, comme polygone.
 *
 * Decoupe de Sutherland-Hodgman, limitee au seul demi-plan dont on a besoin.
 * Rend un tableau vide quand rien n'est encore revele : l'appelant saute alors
 * son clip au lieu de dessiner un chemin degenere.
 */
function revealedPolygon(box, front) {
  const { nx, ny, d } = front;
  const sommets = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
  const dedans = (p) => nx * p.x + ny * p.y <= d;
  const coupe = (a, b) => {
    const da = nx * a.x + ny * a.y - d;
    const db = nx * b.x + ny * b.y - d;
    const t = da / (da - db);
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  };

  const sortie = [];
  for (let i = 0; i < sommets.length; i++) {
    const a = sommets[i];
    const b = sommets[(i + 1) % sommets.length];
    const aIn = dedans(a);
    const bIn = dedans(b);
    if (aIn) sortie.push(a);
    if (aIn !== bIn) sortie.push(coupe(a, b));
  }
  return sortie;
}

module.exports = {
  sweepWeight,
  chooseFill,
  brushWidth,
  brushStrokes,
  frontSweep,
  revealedPolygon,
  SWEEP_MIDPOINT,
};
