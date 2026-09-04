/**
 * Traduit une region du repere ou l'editeur l'a ecrite vers celui que le
 * renderer serveur attend.
 *
 * L'apercu enregistre les regions en PIXELS DE CANVAS : il les a deja projetees
 * sur le rectangle d'artwork et decalees avant de les stocker. Le renderer
 * serveur, lui, les attend en PIXELS NATURELS de l'image et applique sa propre
 * projection (regionToCanvasRect, mise a l'echelle par layer.w / naturalWidth).
 *
 * Envoyer les unes dans l'autre projette DEUX FOIS : les regions tombent a
 * cote, le contenu est coupe et une partie du dessin n'apparait jamais. On
 * ramene donc d'abord la region dans l'espace naturel, pour que la projection
 * du serveur la remette exactement ou l'editeur l'avait posee.
 */
function versEspaceNaturel(region, espace, naturel) {
  if (!espace || !espace.width || !espace.height) return region;
  if (!naturel || !naturel.width || !naturel.height) return region;

  const sx = naturel.width / espace.width;
  const sy = naturel.height / espace.height;
  if (sx === 1 && sy === 1) return region;

  return {
    ...region,
    x: region.x * sx,
    y: region.y * sy,
    width: region.width * sx,
    height: region.height * sy,
  };
}

module.exports = { versEspaceNaturel };
