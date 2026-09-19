/**
 * L'esquisse de Gesture : flou 6px, saturation 0,3, encre estompee a 70 %, opacite 72 %.
 *
 * Calculee en pixels et non via ctx.filter : node-canvas accepte la propriete
 * mais l'ignore, et l'export serveur montrait l'image nette la ou l'apercu
 * montrait l'esquisse. Saturation et contraste sont affines et le flou lineaire,
 * donc l'ordre des operations ne change pas le resultat.
 */

// Trois flous boite de rayon 6 approchent un gaussien d'ecart-type 6.
const RAYON = 6;
const PASSES = 3;

function flouBoite(src, dst, W, H, r, horizontal) {
  const n = horizontal ? W : H;
  const lignes = horizontal ? H : W;
  const pas = horizontal ? 4 : W * 4;
  const largeur = 2 * r + 1;
  for (let l = 0; l < lignes; l++) {
    const base = horizontal ? l * W * 4 : l * 4;
    for (let ch = 0; ch < 4; ch++) {
      let somme = 0;
      for (let k = -r; k <= r; k++) somme += src[base + Math.min(n - 1, Math.max(0, k)) * pas + ch];
      for (let t = 0; t < n; t++) {
        dst[base + t * pas + ch] = somme / largeur;
        const sort = Math.max(0, t - r);
        const entre = Math.min(n - 1, t + r + 1);
        somme += src[base + entre * pas + ch] - src[base + sort * pas + ch];
      }
    }
  }
}

function esquisserPixels(d, W, H) {
  let a = Float32Array.from(d);
  let b = new Float32Array(d.length);
  for (let p = 0; p < PASSES; p++) {
    flouBoite(a, b, W, H, RAYON, true);
    flouBoite(b, a, W, H, RAYON, false);
  }

  // saturate(0.3) : matrice CSS Filter Effects. Le contraste pivote autour du
  // blanc et non du gris moyen comme contrast() : le papier doit rester blanc,
  // sinon la premiere passe pose un voile gris sur toute la region.
  const s = 0.3;
  const m = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  const c = 0.7;
  for (let i = 0; i < d.length; i += 4) {
    const r = a[i], g = a[i + 1], bl = a[i + 2];
    for (let ch = 0; ch < 3; ch++) {
      const v = m[ch * 3] * r + m[ch * 3 + 1] * g + m[ch * 3 + 2] * bl;
      d[i + ch] = Math.max(0, Math.min(255, Math.round(255 - (255 - v) * c)));
    }
    d[i + 3] = Math.round(a[i + 3] * 0.72);
  }
}

/** Dessine l'esquisse de `source` dans `ctx` (meme taille). */
function dessinerEsquisse(ctx, source, W, H) {
  const sc = source.getContext('2d', { willReadFrequently: true });
  let image;
  try {
    image = sc.getImageData(0, 0, W, H);
  } catch (_) {
    ctx.globalAlpha = 0.72;
    ctx.drawImage(source, 0, 0);
    ctx.globalAlpha = 1;
    return;
  }
  esquisserPixels(image.data, W, H);
  ctx.putImageData(image, 0, 0);
}

module.exports = { dessinerEsquisse, esquisserPixels };
