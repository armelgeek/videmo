/**
 * Geometrie de dessin de la main, partagee frontend / backend.
 *
 * Les assets sont dessines pour la taille nominale de leur palier
 * (720p/1080p/1440p). Deux corrections y sont appliquees :
 *
 *  1. mise a l'echelle si le canvas ne correspond pas au palier ;
 *  2. plafonnement de la hauteur : l'asset 1080 fait 1152px de haut pour un
 *     canvas de 1080, avec la pointe tout en haut. Des que la pointe descend,
 *     la main occupe tout le bas du cadre et masque le dessin.
 *
 * L'ancrage suit toujours l'echelle, donc la pointe reste sur le trait.
 */
const NOMINAL = { '720': 1280, '1080': 1920, '1440': 2560 };

/** Fraction de la hauteur du canvas que la main ne doit pas depasser. */
const MAX_HEIGHT_RATIO = 0.85;

/**
 * @returns {{x,y,width,height,scale}} rectangle de dessin de l'image de main.
 */
function handDrawRect(imageConfig, resKey, tipX, tipY, canvasW, canvasH) {
  const maxDim = Math.max(canvasW, canvasH);
  const nominal = NOMINAL[String(resKey).replace('v', '')] || 1920;

  let scale = maxDim / nominal;
  const capH = canvasH * MAX_HEIGHT_RATIO;
  if (imageConfig.height * scale > capH) scale = capH / imageConfig.height;

  return {
    x: tipX - imageConfig.tipX * scale,
    y: tipY - imageConfig.tipY * scale,
    width: imageConfig.width * scale,
    height: imageConfig.height * scale,
    scale,
  };
}

module.exports = { handDrawRect, MAX_HEIGHT_RATIO };
