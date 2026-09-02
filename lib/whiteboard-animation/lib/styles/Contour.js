const Animation = require('../Animation');

class Contour extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const map = this.buildPresenceMap();
    const W = cb.w, H = cb.h;

    const edgeMap = this.buildEdgeMap(map);
    const edgePts = this.collectEdgePixels(edgeMap);

    const STEP = Math.max(4, Math.round(H / 55));
    const fillPts = [];
    let dir = 1;
    for (let ry = 0; ry < H; ry += STEP) {
      let lx = W, rx = 0;
      for (let y2 = ry; y2 < Math.min(ry + STEP, H); y2++) {
        for (let x = 0; x < W; x++) {
          if (map[y2 * W + x]) { lx = Math.min(lx, x); rx = Math.max(rx, x); }
        }
      }
      if (lx > rx) { dir *= -1; continue; }

      const ay = cb.y + ry + STEP * 0.5;
      const x1 = cb.x + (dir > 0 ? lx : rx);
      const x2 = cb.x + (dir > 0 ? rx : lx);
      const segs = Math.max(3, Math.floor((rx - lx) / 28));
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        fillPts.push({
          x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 4,
          y: ay + (Math.random() - 0.5) * 3,
          reveal_y: ay
        });
      }
      dir *= -1;
    }

    this.state.contourEdgePts = edgePts;
    this.state.contourFillPts = fillPts;
    this.state.contourPhase = 1;
    this.state.contourEdgeIdx = 0;
    this.state.contourFillIdx = 0;

    this.state.edgeCanvas = document.createElement('canvas');
    this.state.edgeCanvas.width = this.state.canvasW;
    this.state.edgeCanvas.height = this.state.canvasH;
    this.state.edgeCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);

    const ocd = this.offscreen.getContext('2d').getImageData(cb.x, cb.y, W, H).data;
    this.state.contourEdgeColors = edgePts.map(p => {
      const lx2 = p.x - cb.x, ly = p.y - cb.y;
      const i = (ly * W + lx2) * 4;
      return `rgba(${ocd[i]},${ocd[i + 1]},${ocd[i + 2]},${(ocd[i + 3] / 255).toFixed(2)})`;
    });

    this.state.revealCanvas = null;
    this.ensureRevealCanvas();
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      // Reset when annotation changes
      if (this.state._annotationChanged) {
        this.state.contourPhase = 1;
        this.state.contourEdgeIdx = 0;
        this.state.contourFillIdx = 0;
      }

      if (this.state.contourPhase === 1) {
        const pts = this.state.contourEdgePts || [];
        // ponytail: an annotation region can be empty - skip instead of pts[-1].
        if (!pts.length) { this.state.contourPhase = 2; return; }
        const step = this.paceStep(pts.length, Math.max(1, handSpeed), 2);
        const ec = this.state.edgeCanvas.getContext('2d');

        for (let i = 0; i < step; i++) {
          if (this.state.contourEdgeIdx >= pts.length) break;
          const p = pts[this.state.contourEdgeIdx];
          const col = this.state.contourEdgeColors[this.state.contourEdgeIdx];
          ec.fillStyle = col;
          ec.beginPath();
          ec.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
          ec.fill();
          this.state.contourEdgeIdx++;
        }

        this.ctx.save();
        if (legacy) this.fillBg(this.ctx);
        this.ctx.drawImage(this.state.edgeCanvas, 0, 0);
        this.ctx.restore();

        const tip = pts[Math.min(this.state.contourEdgeIdx, pts.length - 1)] || { x: 0, y: 0 };
        const dir = this.state.contourEdgeIdx > 1
          ? (pts[this.state.contourEdgeIdx - 1].x >= pts[Math.max(0, this.state.contourEdgeIdx - 2)].x ? 1 : -1)
          : 1;
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
        this.setProgress((this.state.contourEdgeIdx / Math.max(1, pts.length)) * 0.35);

        if (this.state.contourEdgeIdx >= pts.length) {
          this.state.contourPhase = 2;
        }
      } else {
        const pts = this.state.contourFillPts || [];
        if (!pts.length) { if (legacy) this.finishAnim(); return; }
        const step = this.paceStep(pts.length, Math.max(1, Math.round(handSpeed * 0.8)), 2);
        this.state.contourFillIdx = Math.min(this.state.contourFillIdx + step, pts.length - 1);
        const idx = this.state.contourFillIdx;
        const tip = pts[idx];
        const cb = this.state.contentBounds;

        this.ctx.save();
        if (legacy) this.fillBg(this.ctx);
        this.ctx.drawImage(this.state.edgeCanvas, 0, 0);
        const revealH = Math.min(tip.reveal_y + Math.round(cb.h / this.state.contourFillPts.length * step * 6), cb.y + cb.h) - cb.y;
        if (revealH > 0) {
          this.ctx.drawImage(this.offscreen, cb.x, cb.y, cb.w, revealH, cb.x, cb.y, cb.w, revealH);
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
        this.setProgress(0.35 + (idx / Math.max(1, pts.length)) * 0.65);
      }
    });
  }
}

module.exports = Contour;
