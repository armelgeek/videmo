const Animation = require('../Animation');
const AnimationUtils = require('../AnimationUtils');

class Scribble extends Animation {
  setup() {
    const numTiles = this.state.tileSlider || 30;
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
    this.fillBg(this.ctx);
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
        const r = tip.strokeR || 8;
        rc.save();
        rc.beginPath();
        rc.arc(tip.x, tip.y, r, 0, Math.PI * 2);
        rc.clip();
        rc.drawImage(this.offscreen, 0, 0);
        rc.restore();
      }

      this.ctx.save();
      this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.revealCanvas, 0, 0);
      this.ctx.restore();

      if (this.state.strokeIdx >= pts.length) {
        if (legacy) {
          this.finishAnim();
        } else {
          this._regionDone = true; this._flushRegion();
          this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        }
        return;
      }

      const idx = Math.max(0, this.state.strokeIdx - 1);
      const tip = pts[idx];
      const dir = (tip.isLift || tip.isJump) ? 1 : (idx > 0 && pts[idx].x >= pts[idx - 1].x ? 1 : -1);
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      this.setProgress(this.state.strokeIdx / pts.length);
    });
  }
}

module.exports = Scribble;
