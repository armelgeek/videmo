/**
 * Ramene le fond d'un artwork a du blanc PUR.
 *
 * Les illustrations arrivent avec un fond « presque blanc » — 254,254,254 pour
 * la scene de demo — alors que le canvas est peint en 255. Chaque region
 * revelee posait donc un rectangle gris : invisible pixel par pixel, mais net
 * a l'oeil une fois les bords alignes sur la region, et accentue par le
 * banding du h264 a l'export.
 *
 * Le seuil est haut expres : au-dessus de 250 un pixel ne porte plus que ~2%
 * d'encre, donc l'antialiasing des traits ne bouge pas visiblement.
 */
const SEUIL_BLANC = 250;

/**
 * Blanchit sur place le contenu deja dessine dans `ctx`.
 *
 * Sans effet si le canvas est teinte par une image cross-origin : ce passage
 * est cosmetique, il ne doit jamais casser un rendu.
 */
function blanchirFond(ctx, width, height) {
  let image;
  try {
    image = ctx.getImageData(0, 0, width, height);
  } catch (_) {
    return;
  }

  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= SEUIL_BLANC && d[i + 1] >= SEUIL_BLANC && d[i + 2] >= SEUIL_BLANC) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

module.exports = { blanchirFond, SEUIL_BLANC };
