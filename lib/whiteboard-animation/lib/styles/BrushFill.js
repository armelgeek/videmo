const OutlineFill = require('./OutlineFill');
const { chooseFill, brushWidth, brushStrokes,
        frontSweep, revealedPolygon } = require('../brush-fill-strokes');

/**
 * OutlineFill, mais la couleur arrive au pinceau plutot qu'au store.
 *
 * Le contour, le decoupage en groupes de couleur et la cadence sont ceux du
 * parent : seule la facon dont chaque groupe se devoile change. Une petite
 * tache se hachure en allers-retours, une grande se couvre d'un balayage
 * incline. Le choix se fait par zone, sur son aire relative — voir
 * brush-fill-strokes.js pour le pourquoi de la bascule.
 */
class BrushFill extends OutlineFill {
  revelerRemplissage(cc, grp, cb, revealH, avance = 0) {
    const box = grp.box;
    // Sans boite, le groupe couvre la region : le parent sait faire, et son
    // store vaut mieux qu'un clip sur des coordonnees qu'on n'a pas.
    if (!box || !(box.w > 0) || !(box.h > 0)) {
      return super.revelerRemplissage(cc, grp, cb, revealH);
    }

    const mode = chooseFill(box.w * box.h, Math.max(1, cb.w * cb.h));
    cc.save();
    cc.beginPath();
    if (mode === 'sweep') this._cheminSweep(cc, box, avance);
    else this._cheminBrosse(cc, box, avance);
    cc.clip();
    cc.drawImage(grp.preCanvas, box.x, box.y);
    cc.restore();
  }

  /** Le demi-plan derriere un front incline. */
  _cheminSweep(cc, box, avance) {
    const poly = revealedPolygon(box, frontSweep(box, avance, 35));
    if (poly.length < 3) return;
    cc.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) cc.lineTo(poly[i].x, poly[i].y);
    cc.closePath();
  }

  /**
   * Les coups deja donnes, plus la part faite du coup en cours.
   *
   * Le coup courant n'est pas dessine d'un bloc : sa portion revelee suit le
   * sens du geste, donc un aller se decouvre par la gauche et un retour par la
   * droite. Sans cela la brosse semblerait toujours partir du meme bord.
   */
  _cheminBrosse(cc, box, avance) {
    const largeur = brushWidth(box, this.resScale ? this.resScale() : 1);
    const coups = brushStrokes(box, largeur);
    const exact = Math.max(0, Math.min(1, avance)) * coups.length;
    const entiers = Math.floor(exact);

    for (let i = 0; i < Math.min(entiers, coups.length); i++) {
      const c = coups[i];
      cc.rect(box.x, c.y0 - largeur / 2, box.w, largeur);
    }

    const courant = coups[entiers];
    if (courant) {
      const part = exact - entiers;
      const largeurFaite = box.w * part;
      const x = courant.sens > 0 ? box.x : box.x + box.w - largeurFaite;
      cc.rect(x, courant.y0 - largeur / 2, largeurFaite, largeur);
    }
  }
}

module.exports = BrushFill;
