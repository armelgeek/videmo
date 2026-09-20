const Animation = require('../Animation');
const { drawSketch } = require('../sketch-blur');

class Gesture extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const W = cb.w, H = cb.h;

    this.state.gestureSketchCanvas = this.createOffscreenCanvas(this.state.canvasW, this.state.canvasH);
    const sc = this.state.gestureSketchCanvas.getContext('2d');
    sc.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
    drawSketch(sc, this.offscreen, this.state.canvasW, this.state.canvasH);

    const buildSweeps = (slopeMag, spacing, densityPx, pass) => {
      const pts = [];
      const sweepDefs = [
        { slope: slopeMag, dir: 1 },
        { slope: -slopeMag, dir: -1 },
      ];
      for (const def of sweepDefs) {
        for (let offset = -H; offset < H + W * Math.abs(def.slope) + H; offset += spacing) {
          let sx1, sy1, sx2, sy2;
          if (def.dir === 1) {
            sx1 = cb.x; sy1 = cb.y + offset;
            sx2 = cb.x + W; sy2 = cb.y + offset + W * def.slope;
          } else {
            sx1 = cb.x + W; sy1 = cb.y + offset;
            sx2 = cb.x; sy2 = cb.y + offset + W * Math.abs(def.slope);
          }
          const minY = cb.y, maxY = cb.y + H;
          if (Math.max(sy1, sy2) < minY || Math.min(sy1, sy2) > maxY) continue;
          const lineLen = Math.hypot(sx2 - sx1, sy2 - sy1);
          const segs = Math.max(6, Math.floor(lineLen / densityPx));
          const goFwd = (Math.random() < 0.5);
          for (let s = 0; s <= segs; s++) {
            const t = goFwd ? s / segs : 1 - s / segs;
            const rx = sx1 + (sx2 - sx1) * t;
            const ry = sy1 + (sy2 - sy1) * t + (Math.random() - 0.5) * 4;
            const cx2 = Math.max(cb.x, Math.min(cb.x + W - 1, rx));
            const cy2 = Math.max(cb.y, Math.min(cb.y + H - 1, ry));
            pts.push({ x: cx2, y: cy2, revealY: Math.max(minY, Math.min(maxY, ry)), pass });
          }
          pts.push({
            x: Math.max(cb.x, Math.min(cb.x + W - 1, goFwd ? sx2 : sx1)),
            y: Math.max(cb.y, Math.min(cb.y + H - 1, goFwd ? sy2 : sy1)),
            isJump: true,
            revealY: Math.max(sy1, sy2),
            pass
          });
        }
      }
      return pts;
    };

    const pass1 = buildSweeps(0.45, H / 10, 6, 1);
    const pass2 = buildSweeps(0.25, H / 22, 5, 2);

    this.state.strokeList = [...pass1, ...pass2];
    this.state.gesturePass1End = pass1.length;
    this.state.strokeIdx = 0;
    this.state.gestureRevealY = cb.y;
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

      // Each point copied its band across the full region width, dozens of
      // times per frame (19 to 38 ms on average). Consecutive overlapping bands
      // from the same source are merged into one copy; a line jump closes the
      // band, otherwise the sketch would appear between two sweeps before the
      // hand passes.
      const rc = this.state.revealCanvas.getContext('2d');
      const cb = this.state.contentBounds;
      let run = null;
      const flush = () => {
        if (!run) return;
        const h = run.bottom - run.top;
        rc.drawImage(run.src, cb.x, run.top, cb.w, h, cb.x, run.top, cb.w, h);
        run = null;
      };

      let budget = this.paceStep(pts.length, handSpeed);
      while (budget > 0 && this.state.strokeIdx < pts.length) {
        const p = pts[this.state.strokeIdx];
        this.state.strokeIdx++;
        if (p.isJump) {
          flush();
          continue;
        }
        budget--;
        if (p.revealY === undefined) continue;

        const src = (p.pass === 1) ? this.state.gestureSketchCanvas : this.offscreen;
        const top = Math.max(cb.y, p.revealY - 12);
        // Clamped to the region: the band overflowed below, and _flushRegion
        // painted that overflow onto the neighbouring region before it was drawn.
        const bottom = Math.min(top + 26, cb.y + cb.h);
        if (bottom <= top) continue;
        if (run && run.src === src && top <= run.bottom && bottom >= run.top) {
          run.top = Math.min(run.top, top);
          run.bottom = Math.max(run.bottom, bottom);
        } else {
          flush();
          run = { src, top, bottom };
        }
      }
      flush();

      this.ctx.drawImage(this.state.revealCanvas, 0, 0);

      if (this.state.strokeIdx >= pts.length) {
        if (legacy) {
          this.finishAnim();
          return;
        } else {
          this._regionDone = true;
          this._flushRegion();
        }
      }

      const tip = pts[Math.min(pts.length - 1, Math.max(0, this.state.strokeIdx - 1))];
      const prev = pts[Math.max(0, this.state.strokeIdx - 2)];
      if (tip) {
        const dir = tip.isJump ? 1 : (tip.x >= (prev ? prev.x : tip.x) ? 1 : -1);
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      }
      this.setProgress(Math.min(1, this.state.strokeIdx / pts.length));
    });
  }

  createOffscreenCanvas(w, h) {
    // In Node.js, createCanvas is injected by canvas-renderer
    // In browser, document.createElement is used
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    // Fallback for pure Node.js (shouldn't reach here in normal usage)
    throw new Error('Canvas creation not available');
  }
}

module.exports = Gesture;
