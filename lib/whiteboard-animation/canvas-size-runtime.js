/**
 * rectContenu en CommonJS, pour le renderer serveur.
 *
 * canvas-size.ts est du TypeScript : le worker, qui est un process Node nu, ne
 * sait pas le charger. La regle d'ajustement est la meme des deux cotes, et
 * canvas-size.test.ts la verrouille cote TypeScript.
 */
function rectContenu(canvasW, canvasH, srcW, srcH) {
  if (srcW <= 0 || srcH <= 0) return { x: 0, y: 0, w: canvasW, h: canvasH };
  const echelle = Math.min(canvasW / srcW, canvasH / srcH);
  const w = Math.round(srcW * echelle);
  const h = Math.round(srcH * echelle);
  return { x: Math.round((canvasW - w) / 2), y: Math.round((canvasH - h) / 2), w, h };
}

module.exports = { rectContenu };
