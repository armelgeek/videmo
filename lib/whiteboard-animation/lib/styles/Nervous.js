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
        const rowY = cb.y + ry;
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          pts.push({
            x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 3,
            y: ay + yoff + Math.sin(t * Math.PI * 6) * 2,
            rowY, rowH: STEP, stroke: s > 0,
            // Le premier et le dernier segment vont jusqu'au bord de la ligne :
            // l'inset aleatoire laisserait sinon ses extremites non revelees.
            edge: s === 1 || s === segs ? cb.x + (s === 1 === (dir > 0) ? lx : rx + 1) : null
          });
        }

        // Hesitation : la main piétine au bout du passage sans rien reveler.
        for (let h2 = 0; h2 < 6; h2++) {
          pts.push({
            x: x2 + (Math.random() - 0.5) * 2,
            y: ay + yoff + (Math.random() - 0.5) * 2,
            rowY, rowH: STEP, stroke: false
          });
        }

        dir *= -1;
      }
    }

    this.state.strokeList = pts;
    this.state.strokeIdx = 0;
    this.state.revealCanvas = null;
    this.ensureRevealCanvas();
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
      const from = this.state.strokeIdx;
      this.state.strokeIdx = Math.min(this.state.strokeIdx + step, pts.length - 1);
      const idx = this.state.strokeIdx;
      const tip = pts[idx];

      // L'encre suit la pointe : chaque segment parcouru devoile sa bande de
      // ligne, avec un bord vertical irregulier qui garde la trace du tremblement.
      const cb = this.state.contentBounds;
      const rc = this.state.revealCanvas.getContext('2d');
      for (let i = Math.max(1, from + 1); i <= idx; i++) {
        const a = pts[i - 1], b = pts[i];
        if (!b.stroke) continue;
        // Le bord deborde de la bande de 0 a 3 px : irregulier, mais sans
        // jamais laisser d'interligne vide.
        const jit = Math.random() * 3;
        const xs = b.edge === null ? [a.x, b.x] : [a.x, b.x, b.edge];
        const x0 = Math.max(cb.x, Math.floor(Math.min(...xs)) - 1);
        const x1 = Math.min(cb.x + cb.w, Math.ceil(Math.max(...xs)) + 1);
        const y0 = Math.max(cb.y, Math.floor(b.rowY - jit));
        const y1 = Math.min(cb.y + cb.h, Math.ceil(b.rowY + b.rowH + jit));
        if (x1 > x0 && y1 > y0) rc.drawImage(this.offscreen, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
      }

      this.ctx.save();
      if (legacy) this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.revealCanvas, 0, 0);
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
