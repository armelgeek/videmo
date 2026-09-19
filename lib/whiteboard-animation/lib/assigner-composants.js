/**
 * Assigne des composants d'encre aux regions / boites d'annotations.
 *
 * POURQUOI
 * Les annotations definissent des rectangles (region: { x, y, width, height }).
 * Dans un dessin reel, les traits debordent souvent, ou sont legerement
 * decales. Un test d'inclusion strict (bbox dans bbox) exclurait de nombreux
 * traits legits ou les classerait mal.
 *
 * De plus, les conteneurs (cadres de tableau, grands rectangles, connecteurs
 * qui traversent plusieurs regions) ne doivent pas etre coupes ni dessines
 * apres le texte qu'ils contiennent : un conteneur englobant doit etre trace
 * en priorite avec la premiere region qu'il traverse.
 *
 * COMMENT (inspire de whiteboard-animator, MIT)
 *
 * 1. Extraction des composants englobants (spanning) :
 *    Tout composant qui recouvre >= 60% d'au moins 2 regions differentes est
 *    qualifie de "spanning" et affecte a la region la plus precoce.
 *
 * 2. Assignation en 3 passes progressives :
 *    - Passe 1 (Center containment) : le barycentre du composant est dans la
 *      boite. Si plusieurs boites le contiennent (imbrication), la plus
 *      petite boite l'emporte.
 *    - Passe 2 (Recouvrement >= 25%) : pour les composants a cheval, le ratio
 *      d'intersection / surface du composant >= 0.25. Tri par plus fort
 *      recouvrement puis plus petite boite.
 *    - Passe 3 (Proximite limitee) : si le trait est a proximite immediate du
 *      centre d'une boite, dans une limite bornee proportionnelle a la
 *      diagonale de la boite et du composant.
 *    - Reste : les composants non associes tombent dans `unmatched`.
 *
 * CE MODULE EST PUR
 * Il manipule des coordonnees et des rectangles, sans dependance DOM ni canvas.
 */

'use strict';

/**
 * Normalise une boite ou une region au format { x1, y1, x2, y2, w, h, cx, cy, area, diag2 }.
 * Accepte [x1, y1, x2, y2] ou { x, y, width, height } ou { x1, y1, x2, y2 } ou { left, top, right, bottom }.
 */
function normaliserBoite(b) {
  if (!b) return null;
  let x1, y1, x2, y2;
  if (Array.isArray(b)) {
    [x1, y1, x2, y2] = b;
  } else if (b.x != null && b.width != null) {
    x1 = Number(b.x);
    y1 = Number(b.y);
    x2 = x1 + Number(b.width);
    y2 = y1 + Number(b.height);
  } else if (b.left != null && b.right != null) {
    x1 = Number(b.left);
    y1 = Number(b.top);
    x2 = Number(b.right);
    y2 = Number(b.bottom);
  } else if (b.x1 != null && b.x2 != null) {
    x1 = Number(b.x1);
    y1 = Number(b.y1);
    x2 = Number(b.x2);
    y2 = Number(b.y2);
  } else if (b.region) {
    return normaliserBoite(b.region);
  } else {
    return null;
  }

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);

  return {
    x1: minX,
    y1: minY,
    x2: maxX,
    y2: maxY,
    w,
    h,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    area: w * h,
    diag2: w * w + h * h,
  };
}

/**
 * Normalise les coordonnees d'un composant d'encre.
 */
function normaliserComposant(c) {
  let left = c.left != null ? c.left : c.x != null ? c.x : c.x1;
  let top = c.top != null ? c.top : c.y != null ? c.y : c.y1;
  let right = c.right != null ? c.right : c.width != null ? left + c.width : c.x2;
  let bottom = c.bottom != null ? c.bottom : c.height != null ? top + c.height : c.y2;

  left = Number(left) || 0;
  top = Number(top) || 0;
  right = Number(right) || left + 1;
  bottom = Number(bottom) || top + 1;

  const minX = Math.min(left, right);
  const maxX = Math.max(left, right);
  const minY = Math.min(top, bottom);
  const maxY = Math.max(top, bottom);
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const area = c.area != null ? Number(c.area) : w * h;

  return {
    raw: c,
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    w,
    h,
    area: Math.max(area, 1),
    diag2: w * w + h * h,
  };
}

/**
 * Ratio de couverture de la boite par le composant.
 */
function couvertureBoite(comp, boite) {
  const ix = Math.max(0, Math.min(comp.right, boite.x2) - Math.max(comp.left, boite.x1));
  const iy = Math.max(0, Math.min(comp.bottom, boite.y2) - Math.max(comp.top, boite.y1));
  return (ix * iy) / boite.area;
}

/**
 * Separe les composants englobants (spanning) couvrant >= 60% de 2+ regions.
 * Rend { spanning: [{ comp, regionIndex }], rest: [comp] }.
 */
function extraireComposantsEnglobants(composants, regions) {
  const boites = regions.map(normaliserBoite);
  const spanning = [];
  const rest = [];

  for (const c of composants) {
    const norm = normaliserComposant(c);
    const regionsCouvertes = [];

    for (let i = 0; i < boites.length; i++) {
      if (!boites[i]) continue;
      if (couvertureBoite(norm, boites[i]) >= 0.6) {
        regionsCouvertes.push(i);
      }
    }

    if (regionsCouvertes.length >= 2) {
      // Affecte a l'index de region le plus precoce (minimum)
      const premierIndex = Math.min(...regionsCouvertes);
      spanning.push({ comp: c, regionIndex: premierIndex });
    } else {
      rest.push(c);
    }
  }

  return { spanning, rest };
}

/**
 * Assigne une liste de composants a des boites de regions.
 *
 * @param {Array} composants
 * @param {Array} regions - liste de boites/regions d'annotations
 * @returns {{ perRegion: Array<Array>, unmatched: Array }}
 */
function assignerComposantsAuxRegions(composants, regions) {
  if (!Array.isArray(composants) || composants.length === 0) {
    return { perRegion: (regions || []).map(() => []), unmatched: [] };
  }
  if (!Array.isArray(regions) || regions.length === 0) {
    return { perRegion: [], unmatched: [...composants] };
  }

  const boitesNorm = regions.map((r, idx) => {
    const nb = normaliserBoite(r);
    return nb ? { ...nb, index: idx, items: [] } : null;
  });

  const boitesActives = boitesNorm.filter(Boolean);
  const unmatched = [];

  for (const c of composants) {
    const comp = normaliserComposant(c);
    let conteneur = null;

    // 1. Center containment (la plus petite boite qui englobe le centre gagne)
    const contenants = boitesActives.filter(
      (b) => b.x1 <= comp.cx && comp.cx <= b.x2 && b.y1 <= comp.cy && comp.cy <= b.y2
    );
    if (contenants.length > 0) {
      conteneur = contenants.reduce((min, b) => (b.area < min.area ? b : min), contenants[0]);
    }

    // 2. Chevauchement >= 25% si pas de conteneur de centre
    if (!conteneur) {
      const chevauchements = [];
      for (const b of boitesActives) {
        const ix = Math.max(0, Math.min(comp.right, b.x2) - Math.max(comp.left, b.x1));
        const iy = Math.max(0, Math.min(comp.bottom, b.y2) - Math.max(comp.top, b.y1));
        const recouvrement = (ix * iy) / comp.area;
        if (recouvrement >= 0.25) {
          chevauchements.push({ b, recouvrement, area: b.area });
        }
      }
      if (chevauchements.length > 0) {
        // Plus fort recouvrement d'abord, puis plus petite surface
        chevauchements.sort((a, b) => b.recouvrement - a.recouvrement || a.area - b.area);
        conteneur = chevauchements[0].b;
      }
    }

    // 3. Proximite du centre dans un rayon limite
    if (!conteneur) {
      let meilleur = null;
      let meilleurScore = Infinity;

      for (const b of boitesActives) {
        const dx = comp.cx - b.cx;
        const dy = comp.cy - b.cy;
        const d2 = dx * dx + dy * dy;
        const limite2 = Math.max(b.diag2 * 0.55, comp.diag2 * 2.25, 90 * 90);
        if (d2 > limite2) continue;

        const score = d2 / Math.max(b.diag2, 1);
        if (score < meilleurScore) {
          meilleur = b;
          meilleurScore = score;
        }
      }
      if (meilleur) {
        conteneur = meilleur;
      }
    }

    if (conteneur) {
      conteneur.items.push(c);
    } else {
      unmatched.push(c);
    }
  }

  const perRegion = boitesNorm.map((b) => (b ? b.items : []));
  return { perRegion, unmatched };
}

module.exports = {
  normaliserBoite,
  normaliserComposant,
  extraireComposantsEnglobants,
  assignerComposantsAuxRegions,
};
