const Animation = require('../Animation');

class Nervous extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const map = this.buildPresenceMap();
    const W = cb.w, H = cb.h;

    const STEP = Math.max(4, Math.round(H / 70));
    const pts = [];

    for (let ry = 0; ry < H; ry += STEP) {
      let lx = W, rx = 0;
      for (let y2 = ry; y2 < Math.min(ry + STEP, H); y2++) {
        for (let x = 0; x < W; x++) {
          if (map[y2 * W + x]) { lx = Math.min(lx, x); rx = Math.max(rx, x); }
        }
      }
      if (lx > rx) continue;

      const ay = cb.y + ry + STEP * 0.4;
      const passes = 2 + Math.floor(Math.random() * 2);
      let dir = Math.random() < 0.5 ? 1 : -1;

      for (let p = 0; p < passes; p++) {
        const inset = Math.random() * 12;
        const x1 = cb.x + (dir > 0 ? lx + inset : rx - inset);
        const x2 = cb.x + (dir > 0 ? rx - inset : lx + inset);
        const yoff = (Math.random() - 0.5) * STEP * 0.5;
        const dist = Math.abs(x2 - x1);

        const segs = Math.max(4, Math.floor(dist / 4));
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          pts.push({
            x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 3,
            y: ay + yoff + Math.sin(t * Math.PI * 6) * 2,
            reveal_y: ay + STEP * (p / passes)
          });
        }

        for (let h2 = 0; h2 < 6; h2++) {
          pts.push({
            x: x2 + (Math.random() - 0.5) * 2,
            y: ay + yoff + (Math.random() - 0.5) * 2,
            reveal_y: ay + STEP * (p / passes)
          });
        }

        dir *= -1;
      }
    }

    this.state.strokeList = pts;
    this.state.strokeIdx = 0;
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      if (this.state._annotationChanged) {
        this.state.strokeIdx = 0;
      }

      const pts = this.state.strokeList;
      if (!pts.length) { if (legacy) this.finishAnim(); return; }

      const step = this.paceStep(pts.length, Math.max(1, handSpeed));
      this.state.strokeIdx = Math.min(this.state.strokeIdx + step, pts.length - 1);
      const idx = this.state.strokeIdx;
      const tip = pts[idx];

      this.ctx.save();
      if (legacy) this.fillBg(this.ctx);
      const cb = this.state.contentBounds;
      const h = Math.min(tip.reveal_y + 16, cb.y + cb.h) - cb.y;
      if (h > 0) {
        this.ctx.drawImage(this.offscreen, cb.x, cb.y, cb.w, h, cb.x, cb.y, cb.w, h);
      }
      this.ctx.restore();

      if (idx >= pts.length - 1) {
        if (legacy) {
          this.finishAnim();
          return;
        } else {
          this._regionDone = true;
          this._flushRegion();
        }
      }

      if (tip) {
        const dir = (idx > 0 && pts[idx].x >= pts[idx - 1].x) ? 1 : -1;
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      }
      this.setProgress(Math.min(1, idx / Math.max(1, pts.length)));
    });
  }
}

module.exports = Nervous;
