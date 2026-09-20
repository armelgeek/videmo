const OutlineFill = require('./OutlineFill');
const { chooseFill, brushWidth, brushStrokes,
        frontSweep, revealedPolygon } = require('../brush-fill-strokes');

/**
 * OutlineFill, but the colour arrives by brush rather than by roller blind.
 *
 * The outline, the split into colour groups and the pacing are the parent's:
 * only the way each group is revealed changes. A small patch is hatched back
 * and forth, a large one is covered by a slanted sweep. The choice is made per
 * zone, on its relative area — see brush-fill-strokes.js for why it switches.
 */
class BrushFill extends OutlineFill {
  revealFill(cc, grp, cb, revealH, progress = 0) {
    const box = grp.box;
    // Without a box, the group covers the region: the parent handles it, and
    // its roller blind beats a clip on coordinates we do not have.
    if (!box || !(box.w > 0) || !(box.h > 0)) {
      return super.revealFill(cc, grp, cb, revealH);
    }

    const mode = chooseFill(box.w * box.h, Math.max(1, cb.w * cb.h));
    cc.save();
    cc.beginPath();
    if (mode === 'sweep') this._sweepPath(cc, box, progress);
    else this._brushPath(cc, box, progress);
    cc.clip();
    cc.drawImage(grp.preCanvas, box.x, box.y);
    cc.restore();
  }

  /** The half-plane behind a slanted front. */
  _sweepPath(cc, box, progress) {
    const poly = revealedPolygon(box, frontSweep(box, progress, 35));
    if (poly.length < 3) return;
    cc.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) cc.lineTo(poly[i].x, poly[i].y);
    cc.closePath();
  }

  /**
   * The strokes already made, plus the done part of the current stroke.
   *
   * The current stroke is not drawn in one block: its revealed portion follows
   * the gesture direction, so a forward stroke uncovers from the left and a
   * return from the right. Otherwise the brush would always seem to start from
   * the same edge.
   */
  _brushPath(cc, box, progress) {
    const width = brushWidth(box, this.resScale ? this.resScale() : 1);
    const strokes = brushStrokes(box, width);
    const exact = Math.max(0, Math.min(1, progress)) * strokes.length;
    const whole = Math.floor(exact);

    for (let i = 0; i < Math.min(whole, strokes.length); i++) {
      const c = strokes[i];
      cc.rect(box.x, c.y0 - width / 2, box.w, width);
    }

    const current = strokes[whole];
    if (current) {
      const part = exact - whole;
      const doneWidth = box.w * part;
      const x = current.sens > 0 ? box.x : box.x + box.w - doneWidth;
      cc.rect(x, current.y0 - width / 2, doneWidth, width);
    }
  }
}

module.exports = BrushFill;
