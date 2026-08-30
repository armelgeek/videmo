const Animation = require('../Animation');

class TopAnchor extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const map = this.buildPresenceMap();
    const W = cb.w, H = cb.h;

    const COL_W = Math.max(18, Math.round(W / 28));
    const pts = [];

    const colOrder = [];
    for (let cx = 0; cx < W; cx += COL_W) colOrder.push(cx);
    for (let i = colOrder.length - 1; i > 0; i--) {
      if (Math.random() < 0.5) {
        const j = Math.max(0, i - 1 - Math.floor(Math.random() * 4));
        [colOrder[i], colOrder[j]] = [colOrder[j], colOrder[i]];
      }
    }

    for (const cx of colOrder) {
      let topY = -1, botY = -1;
      for (let y = 0; y < H; y++) {
        for (let x = cx; x < Math.min(cx + COL_W, W); x++) {
          if (map[y * W + x]) { if (topY < 0) topY = y; botY = y; }
        }
      }
      if (topY < 0) continue;

      const midX = cb.x + cx + COL_W * 0.5 + (Math.random() - 0.5) * COL_W * 0.3;
      const dist = botY - topY;
      const steps = Math.max(4, Math.floor(dist / 3));

      pts.push({
        x: midX, y: cb.y + topY - 8, isJump: true,
        revealColX: cb.x + cx, revealColW: COL_W, revealColY1: cb.y + topY, revealColY2: cb.y + botY
      });

      for (let r = 0; r <= steps; r++) {
        const t = r / steps;
        const ry = topY + dist * t;
        pts.push({
          x: midX + (Math.random() - 0.5) * 5,
          y: cb.y + ry,
          revealColX: cb.x + cx, revealColW: COL_W,
          revealColY1: cb.y + topY, revealColY2: cb.y + ry
        });
      }

      pts.push({
        x: midX, y: cb.y + botY + 8, isJump: true,
        revealColX: cb.x + cx, revealColW: COL_W, revealColY1: cb.y + topY, revealColY2: cb.y + botY
      });
    }

    this.state.strokeList = pts;
    this.state.strokeIdx = 0;
    this.state.revealCanvas = null;
    this.ensureRevealCanvas();
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;
    const effectiveSpeed = Math.max(speed || 40, handSpeed * 5);

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      if (this.state._annotationChanged) {
        this.state.strokeIdx = 0;
      }

      const pts = this.state.strokeList;
      if (!pts.length) { if (legacy) this.finishAnim(); return; }

      let budget = this.paceStep(pts.length, handSpeed);

      while (budget > 0 && this.state.strokeIdx < pts.length) {
        const p = pts[this.state.strokeIdx];
        this.state.strokeIdx++;
        if (!p.isJump) budget--;

        if (!p.isJump && p.revealColX !== undefined) {
          const rc = this.state.revealCanvas.getContext('2d');
          const rh = p.revealColY2 - p.revealColY1 + 1;
          if (rh > 0) {
            rc.drawImage(this.offscreen,
              p.revealColX, p.revealColY1, p.revealColW, rh,
              p.revealColX, p.revealColY1, p.revealColW, rh);
          }
        }
      }

      this.ctx.drawImage(this.state.revealCanvas, 0, 0);

      if (this.state.strokeIdx >= pts.length) {
        if (legacy) {
          this.finishAnim();
        } else {
          this._regionDone = true; this._flushRegion();
          this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        }
        return;
      }

      const tip = pts[Math.min(this.state.strokeIdx, pts.length - 1)];
      const prev = pts[Math.max(0, this.state.strokeIdx - 1)];
      const dir = tip.isJump ? 1 : (tip.y >= prev.y ? 1 : -1);
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      this.setProgress(this.state.strokeIdx / pts.length);
    });
  }
}

module.exports = TopAnchor;
