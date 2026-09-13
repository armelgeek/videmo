const Animation = require('../Animation');
const { buildTileWaypoints, tuilesPourRegion, revealDisc } = require('../AnimationUtils');

class ChunkJump extends Animation {
  setup() {
    // Tuiles derivees de la taille de la region : voir tuilesPourRegion.
    const numTiles = tuilesPourRegion(this.state.contentBounds);

    const { pts } = buildTileWaypoints(this, numTiles, (tiles) => {
      const ordered = [], rem = [...tiles];
      if (!rem.length) return ordered;
      let cur = rem.splice(Math.floor(Math.random() * rem.length), 1)[0];
      ordered.push(cur);
      while (rem.length) {
        let best = Infinity, bi = 0;
        rem.forEach((t, i) => {
          const d = Math.hypot(t.cx - cur.cx, t.cy - cur.cy);
          if (d < best) { best = d; bi = i; }
        });
        cur = rem.splice(bi, 1)[0];
        ordered.push(cur);
      }
      return ordered;
    });

    this.state.strokeList = pts;
    this.state.strokeIdx = 0;
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
      }

      const pts = this.state.strokeList;
      if (!pts.length) { if (legacy) this.finishAnim(); return; }

      const advance = this.paceStep(pts.length, Math.max(1, handSpeed));
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

module.exports = ChunkJump;
