/**
 * Rattache les points de ponctuation et accents a leur glyphe parent.
 *
 * POURQUOI
 * Un point d'interrogation (?), un point d'exclamation (!), les deux-points (:),
 * ou le point sur un 'i' ou 'j' sont composes de deux morceaux disjoints :
 * le glyphe principal et un point minuscule.
 *
 * Le tri spatial par defaut (de haut en bas, puis de gauche a droite) traite
 * le point comme un composant independant. Il le deplace souvent dans une
 * ligne inferieure ou tout a la fin du bloc : l'animation trace alors la
 * boucle du '?', dessine 10 autres mots, puis revient des secondes plus tard
 * poser le point en bas. Aucun humain ne dessine ainsi.
 *
 * COMMENT (inspire de whiteboard-animator, MIT)
 *
 * 1. Pour chaque composant de petite taille (largeur <= 45, hauteur <= 45,
 *    aire <= 1200 px et non-remplissage) :
 * 2. On cherche parmi les composants ordonnes un "parent" nettement plus grand
 *    (aire >= 3 * aire_point) dont l'alignement horizontal englobe le point
 *    (avec une marge de tolerance de 5 px).
 * 3. On teste si le point est positionne soit immediatement sous le glyphe
 *    (point de '?' ou '!'), soit immediatement au-dessus (point de 'i', 'j',
 *    ou accent).
 * 4. Si un parent unique ou le plus proche est identifie, le point est extrait
 *    de sa position courante et re-insere IMMEDIATEMENT apres son parent.
 *
 * CE MODULE EST PUR
 * Fonction pure sans effet de bord sur le tableau d'origine.
 */

'use strict';

/**
 * Extrait les dimensions normalisees d'un composant.
 */
function dims(c) {
  const left = c.left != null ? c.left : c.x != null ? c.x : c.x1 || 0;
  const top = c.top != null ? c.top : c.y != null ? c.y : c.y1 || 0;
  const right = c.right != null ? c.right : c.width != null ? left + c.width : c.x2 || left + 1;
  const bottom = c.bottom != null ? c.bottom : c.height != null ? top + c.height : c.y2 || top + 1;
  const w = Math.max(right - left, 1);
  const h = Math.max(bottom - top, 1);
  const area = c.area != null ? Number(c.area) : w * h;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;

  return { left, top, right, bottom, w, h, area, cx, cy };
}

/**
 * Rattache les points isoles a leur glyphe parent.
 *
 * @param {Array} ordonnes - liste ordonnee de composants
 * @returns {Array} nouvelle liste avec les points repositionnes
 */
function rattacherPoints(ordonnes) {
  if (!Array.isArray(ordonnes) || ordonnes.length < 2) {
    return ordonnes ? [...ordonnes] : [];
  }

  let resultat = [...ordonnes];

  for (const comp of ordonnes) {
    const dc = dims(comp);
    // Un point est petit et n'est pas un aplat de couleur
    if (comp.is_fill || comp.isFill || dc.w > 45 || dc.h > 45 || dc.area > 1200) {
      continue;
    }

    const dotH = Math.max(dc.h, 1);
    let meilleurParent = null;
    let meilleurEcart = Infinity;

    for (const parent of ordonnes) {
      if (parent === comp) continue;
      const dp = dims(parent);

      // Le parent doit etre nettement plus substantiel (au moins 3x la surface)
      if (dp.area < dc.area * 3) continue;

      // Alignement horizontal : le centre du point doit etre dans la largeur du parent (+- 5px)
      if (dc.cx < dp.left - 5 || dc.cx > dp.right + 5) continue;

      // Cas 1 : Point sous le glyphe (ex: '?', '!')
      const ecartBas = dc.top - dp.bottom;
      if (-dotH <= ecartBas && ecartBas <= 4 * dotH) {
        const ecartAbs = Math.abs(ecartBas);
        if (ecartAbs < meilleurEcart) {
          meilleurParent = parent;
          meilleurEcart = ecartAbs;
        }
      }

      // Cas 2 : Point au-dessus du glyphe (ex: 'i', 'j')
      const ecartHaut = dp.top - dc.bottom;
      if (-dotH <= ecartHaut && ecartHaut <= 4 * dotH) {
        const ecartAbs = Math.abs(ecartHaut);
        if (ecartAbs < meilleurEcart) {
          meilleurParent = parent;
          meilleurEcart = ecartAbs;
        }
      }
    }

    if (!meilleurParent) continue;

    // Retirer le point de sa position actuelle et l'inserer apres son parent
    const sansPoint = resultat.filter((c) => c !== comp);
    const parentIdx = sansPoint.indexOf(meilleurParent);
    if (parentIdx !== -1) {
      sansPoint.splice(parentIdx + 1, 0, comp);
      resultat = sansPoint;
    }
  }

  return resultat;
}

module.exports = {
  rattacherPoints,
};
