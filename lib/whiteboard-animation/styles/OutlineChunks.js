const Animation = require('../Animation');
const { buildTileWaypoints } = require('../AnimationUtils');

class OutlineChunks extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const map = this.buildPresenceMap();
    const W = cb.w, H = cb.h;

    const edgeMap = this.buildEdgeMap(map);
    const edgePts = this.collectEdgePixels(edgeMap);

    const ocd = this.offscreen.getContext('2d').getImageData(cb.x, cb.y, W, H).data;
    this.state.outlineChunksEdgeColors = edgePts.map(p => {
      const lx2 = p.x - cb.x, ly = p.y - cb.y;
      const i = (ly * W + lx2) * 4;
      return `rgba(${ocd[i]},${ocd[i + 1]},${ocd[i + 2]},${(ocd[i + 3] / 255).toFixed(2)})`;
    });

    this.state.outlineChunksEdgePts = edgePts;
    this.state.outlineChunksPhase = 1;
    this.state.outlineChunksEdgeIdx = 0;

    this.state.edgeCanvas = document.createElement('canvas');
    this.state.edgeCanvas.width = this.state.canvasW;
    this.state.edgeCanvas.height = this.state.canvasH;
    this.state.edgeCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);

    const numTiles = this.state.tileSlider || 30;
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

    this.state.outlineChunksChunkPts = pts;
    this.state.outlineChunksChunkIdx = 0;
    this.state.revealCanvas = null;
    this.ensureRevealCanvas();
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      // Reset when annotation changes
      if (this.state._annotationChanged) {
        this.state.outlineChunksPhase = 1;
        this.state.outlineChunksEdgeIdx = 0;
        this.state.outlineChunksChunkIdx = 0;
      }

      if (this.state.outlineChunksPhase === 1) {
      const pts = this.state.outlineChunksEdgePts;
      const step = this.paceStep(pts.length, Math.max(1, handSpeed), 2);
      const ec = this.state.edgeCanvas.getContext('2d');

      for (let i = 0; i < step; i++) {
        if (this.state.outlineChunksEdgeIdx >= pts.length) break;
        const p = pts[this.state.outlineChunksEdgeIdx];
        const col = this.state.outlineChunksEdgeColors[this.state.outlineChunksEdgeIdx];
        ec.fillStyle = col;
        ec.beginPath();
        ec.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ec.fill();
        this.state.outlineChunksEdgeIdx++;
      }

      this.ctx.save();
      this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.edgeCanvas, 0, 0);
      this.ctx.restore();

      const tip = pts[Math.min(this.state.outlineChunksEdgeIdx, pts.length - 1)] || { x: 0, y: 0 };
      const dir = this.state.outlineChunksEdgeIdx > 1
        ? (pts[this.state.outlineChunksEdgeIdx - 1].x >= pts[Math.max(0, this.state.outlineChunksEdgeIdx - 2)].x ? 1 : -1)
        : 1;
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      this.setProgress((this.state.outlineChunksEdgeIdx / Math.max(1, pts.length)) * 0.4);

      if (this.state.outlineChunksEdgeIdx >= pts.length) {
        this.state.outlineChunksPhase = 2;
      }
    } else {
      const pts = this.state.outlineChunksChunkPts || [];
      if (!pts.length) { if (legacy) this.finishAnim(); return; }

      const advance = this.paceStep(pts.length, Math.max(1, handSpeed), 2);
      const rc = this.state.revealCanvas.getContext('2d');

      for (let i = 0; i < advance; i++) {
        if (this.state.outlineChunksChunkIdx >= pts.length) break;
        const tip = pts[this.state.outlineChunksChunkIdx++];
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
      this.ctx.drawImage(this.state.edgeCanvas, 0, 0);
      this.ctx.drawImage(this.state.revealCanvas, 0, 0);
      this.ctx.restore();

      if (this.state.outlineChunksChunkIdx < pts.length) {
        const idx = Math.max(0, this.state.outlineChunksChunkIdx - 1);
        const tip = pts[idx];
        const dir = (tip.isLift || tip.isJump) ? 1 : (idx > 0 && pts[idx].x >= pts[idx - 1].x ? 1 : -1);
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      } else {
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      }

      this.setProgress(0.4 + (this.state.outlineChunksChunkIdx / pts.length) * 0.6);

      if (this.state.outlineChunksChunkIdx >= pts.length) {
        if (legacy) this.finishAnim();
      }
      }
    });
  }
}

module.exports = OutlineChunks;
