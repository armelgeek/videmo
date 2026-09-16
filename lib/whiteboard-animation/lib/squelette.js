/**
 * Amincit un trait a un pixel de large, sans le couper.
 *
 * POURQUOI
 * Les styles a encre decoupent le dessin en segments par un balayage raster :
 * ligne par ligne, on coupe des que le pixel suivant est trop loin. Sur un
 * trait isole cela suffit, mais des que deux traits se croisent — une grille,
 * une croix, un tableau — le balayage ne sait plus lequel il suit : il prend
 * les pixels des deux, dans l'ordre des lignes, et la main part du milieu du
 * croisement vers les bords au lieu de tracer chaque barre d'un geste.
 *
 * On ne peut pas demeler un croisement sur un trait epais : a 3 pixels de
 * large, chaque pixel touche ses huit voisins et TOUT ressemble a une
 * jonction. Il faut d'abord ramener le trait a son axe. C'est ce que fait ce
 * module ; decomposer-traits.js s'occupe ensuite du demelage.
 *
 * COMMENT
 * Zhang-Suen : deux sous-passes qui retirent les pixels de bord tant que cela
 * ne casse pas la connexite locale ni ne raccourcit une extremite. On repete
 * jusqu'a ce qu'une passe complete ne retire plus rien. Les deux sous-passes
 * mordent sur des bords opposes, ce qui evite que le trait derive d'un cote.
 *
 * L'algorithme preserve la topologie : un anneau reste un anneau, deux traits
 * qui se croisent se croisent toujours. C'est precisement ce dont la
 * decomposition a besoin.
 */

'use strict';

/** Les huit voisins, dans l'ordre horaire depuis le haut (P2..P9). */
const VOISINS = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/**
 * Nombre de transitions 0 -> 1 en faisant le tour des voisins.
 *
 * Vaut 1 exactement quand le pixel a un seul groupe de voisins connexes,
 * c'est-a-dire quand le retirer ne coupe rien.
 */
function transitions(v) {
  let n = 0;
  for (let i = 0; i < 8; i++) {
    if (v[i] === 0 && v[(i + 1) % 8] === 1) n++;
  }
  return n;
}

function voisinsDe(bits, W, H, x, y, out) {
  for (let i = 0; i < 8; i++) {
    const nx = x + VOISINS[i][0];
    const ny = y + VOISINS[i][1];
    out[i] = (nx < 0 || ny < 0 || nx >= W || ny >= H) ? 0 : bits[ny * W + nx];
  }
  return out;
}

/**
 * Une sous-passe. Rend le nombre de pixels retires.
 *
 * Les suppressions sont collectees puis appliquees en bloc : retirer au fil de
 * la lecture ferait dependre le sort d'un pixel de ceux deja traites dans la
 * meme passe, et le trait s'amincirait de travers.
 */
function passe(bits, W, H, seconde) {
  const v = new Uint8Array(8);
  const aRetirer = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!bits[idx]) continue;

      voisinsDe(bits, W, H, x, y, v);
      let compte = 0;
      for (let i = 0; i < 8; i++) compte += v[i];
      // Moins de 2 voisins : c'est une extremite, la retirer raccourcit le
      // trait. Plus de 6 : c'est un interieur, pas un bord.
      if (compte < 2 || compte > 6) continue;
      if (transitions(v) !== 1) continue;

      const [p2, p3, p4, p5, p6, p7, p8] = [v[0], v[1], v[2], v[3], v[4], v[5], v[6]];
      void p3; void p5; void p7;
      const a = seconde ? p2 * p4 * p8 : p2 * p4 * p6;
      const b = seconde ? p2 * p6 * p8 : p4 * p6 * p8;
      if (a === 0 && b === 0) aRetirer.push(idx);
    }
  }

  for (let i = 0; i < aRetirer.length; i++) bits[aRetirer[i]] = 0;
  return aRetirer.length;
}

/**
 * Le squelette d'une image binaire.
 *
 * @param {Uint8Array} bits  1 = encre, 0 = fond, de longueur W*H
 * @param {number} W
 * @param {number} H
 * @param {number} maxPasses  garde-fou : une image bruitee peut osciller
 * @returns {Uint8Array} un NOUVEAU tableau, l'entree n'est pas modifiee
 */
function squelettiser(bits, W, H, maxPasses = 60) {
  const out = Uint8Array.from(bits);
  for (let i = 0; i < maxPasses; i++) {
    const a = passe(out, W, H, false);
    const b = passe(out, W, H, true);
    if (a + b === 0) break;
  }
  return out;
}

module.exports = { squelettiser, transitions, VOISINS };
