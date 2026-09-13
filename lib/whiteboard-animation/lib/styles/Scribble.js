const Animation = require('../Animation');
const AnimationUtils = require('../AnimationUtils');
const { revealDisc } = AnimationUtils;
const { tuilesPourRegion } = AnimationUtils;

class Scribble extends Animation {
  setup() {
    // Tuiles derivees de la taille de la region : voir tuilesPourRegion.
    const numTiles = tuilesPourRegion(this.state.contentBounds);
    const cb = this.state.contentBounds;

    const { pts } = AnimationUtils.buildTileWaypoints(this, numTiles, (tiles) => {
      const cx = cb.x + cb.w / 2, cy = cb.y + cb.h / 2;
      return [...tiles].sort((a, b) =>
        (Math.hypot(a.cx - cx, a.cy - cy) + Math.random() * 40) -
        (Math.hypot(b.cx - cx, b.cy - cy) + Math.random() * 40)
      );
    });

    this.state.strokeList = pts;
    this.state.strokeIdx = 0;
    this.state.scribblePhase = 0;
    this.state.noFlashFinish = true;
    this.state.revealCanvas = null;
    this.ensureRevealCanvas();
    if (!this.annotationManager) this.fillBg(this.ctx);
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      if (this.state._annotationChanged) {
        this.state.strokeIdx = 0;
        this.state.scribblePhase = 0;
      }

      const pts = this.state.strokeList;
      if (!pts.length) { if (legacy) this.finishAnim(); return; }

      this.state.scribblePhase += 0.12;
      const rhythmMult = 0.6 + 0.6 * Math.abs(Math.sin(this.state.scribblePhase));
      const advance = this.paceStep(pts.length, Math.max(1, Math.round(handSpeed * rhythmMult)));
      const rc = this.state.revealCanvas.getContext('2d');

      for (let i = 0; i < advance; i++) {
        if (this.state.strokeIdx >= pts.length) break;
        const tip = pts[this.state.strokeIdx++];
        if (tip.isLift || tip.isJump) continue;
        revealDisc(rc, this.offscreen, tip.x, tip.y, tip.strokeR || 8);
      }

      this.ctx.save();
      if (legacy) this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.revealCanvas, 0, 0);
      this.ctx.restore();

      if (this.state.strokeIdx >= pts.length) {
        if (legacy) {
          this.finishAnim();
          return;
        } else {
          this._regionDone = true;
          this._flushRegion();
        }
      }

      const idx = Math.min(pts.length - 1, Math.max(0, this.state.strokeIdx - 1));
      const tip = pts[idx];
      if (tip) {
        const dir = (tip.isLift || tip.isJump) ? 1 : (idx > 0 && pts[idx].x >= pts[idx - 1].x ? 1 : -1);
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      }
      this.setProgress(Math.min(1, this.state.strokeIdx / pts.length));
    });
  }
}

module.exports = Scribble;
