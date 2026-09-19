/**
 * SkeletonTrace animation style.
 * Renders line art along topological skeleton paths with R2 junction continuity.
 */

const Animation = require('../Animation');
const { thinZhangSuen } = require('../skeleton/thinning');
const { distanceTransformChamfer } = require('../skeleton/distance-transform');
const { extractSkeletonPaths } = require('../skeleton/skeleton-graph');
const { buildLineArtStrokes } = require('../skeleton/junction-resolver');

class SkeletonTrace extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const W = Math.max(1, Math.round(cb.w));
    const H = Math.max(1, Math.round(cb.h));
    const presenceMap = this.buildPresenceMap();

    // Check for empty region
    let hasPixels = false;
    if (presenceMap) {
      for (let i = 0; i < presenceMap.length; i++) {
        if (presenceMap[i]) { hasPixels = true; break; }
      }
    }

    if (!hasPixels) {
      this.state.skeletonStrokes = [];
      this.state.skeletonStrokeIdx = 0;
      this.state.skeletonPtIdx = 0;
      this.state.skeletonTotalPts = 0;
      this.state.skeletonDrawnPts = 0;
      return;
    }

    // Pipeline: Thinning -> Distance Transform -> Graph -> Junction Pairing
    const skeleton = thinZhangSuen(presenceMap, W, H);
    const distMap = distanceTransformChamfer(presenceMap, W, H);
    const paths = extractSkeletonPaths(skeleton, W, H);
    const localStrokes = buildLineArtStrokes(paths, distMap, W);

    // Transform local coordinates (0..W, 0..H) to global canvas coordinates (+ cb.x, + cb.y)
    const scale = this.resScale ? this.resScale() : 1;
    const strokes = localStrokes.map(stroke => ({
      weight: stroke.weight,
      waypoints: stroke.waypoints.map(pt => ({
        x: cb.x + pt.x,
        y: cb.y + pt.y,
        r: Math.max(1.2 * scale, pt.r * scale)
      }))
    }));

    let totalPts = 0;
    strokes.forEach(s => { totalPts += s.waypoints.length; });

    this.state.skeletonStrokes = strokes;
    this.state.skeletonStrokeIdx = 0;
    this.state.skeletonPtIdx = 0;
    this.state.skeletonTotalPts = totalPts;
    this.state.skeletonDrawnPts = 0;

    // Create mask canvas for revealing offscreen content
    if (!this.state.skeletonMaskCanvas && typeof document !== 'undefined') {
      this.state.skeletonMaskCanvas = document.createElement('canvas');
    }
    if (this.state.skeletonMaskCanvas) {
      this.state.skeletonMaskCanvas.width = this.state.canvasW;
      this.state.skeletonMaskCanvas.height = this.state.canvasH;
      const mctx = this.state.skeletonMaskCanvas.getContext('2d');
      if (mctx) mctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
    }
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      if (this.state._annotationChanged) {
        this.setup();
      }

      const strokes = this.state.skeletonStrokes || [];
      if (!strokes.length || this.state.skeletonStrokeIdx >= strokes.length) {
        this.finishAnim();
        return;
      }

      const remainingPts = Math.max(1, this.state.skeletonTotalPts - this.state.skeletonDrawnPts);
      const step = Math.max(1, this.paceStep(remainingPts, Math.max(1, handSpeed), 2, 1));
      const mctx = this.state.skeletonMaskCanvas ? this.state.skeletonMaskCanvas.getContext('2d') : null;

      let lastX = 0, lastY = 0;
      let prevX = 0;

      if (mctx) {
        mctx.save();
        mctx.lineCap = 'round';
        mctx.lineJoin = 'round';
        mctx.fillStyle = '#fff';
        mctx.strokeStyle = '#fff';

        for (let s = 0; s < step; s++) {
          if (this.state.skeletonStrokeIdx >= strokes.length) break;

          const currentStroke = strokes[this.state.skeletonStrokeIdx];
          const pts = currentStroke.waypoints;
          const pt = pts[this.state.skeletonPtIdx];

          if (this.state.skeletonPtIdx === 0) {
            // Stamp first point circle
            mctx.beginPath();
            mctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
            mctx.fill();
          } else {
            // Stamp continuous capsule line segment from previous point
            const prevPt = pts[this.state.skeletonPtIdx - 1];
            prevX = prevPt.x;
            mctx.lineWidth = pt.r * 2;
            mctx.beginPath();
            mctx.moveTo(prevPt.x, prevPt.y);
            mctx.lineTo(pt.x, pt.y);
            mctx.stroke();
          }

          lastX = pt.x;
          lastY = pt.y;
          this.state.skeletonPtIdx++;
          this.state.skeletonDrawnPts++;

          if (this.state.skeletonPtIdx >= pts.length) {
            this.state.skeletonStrokeIdx++;
            this.state.skeletonPtIdx = 0;
          }
        }
        mctx.restore();
      }

      // Render revealed image to main canvas
      this.ctx.save();
      if (legacy) this.fillBg(this.ctx);

      // Mask offscreen drawing with skeletonMaskCanvas
      this.ensureRevealCanvas();
      const rc = this.state.revealCanvas;
      if (rc && this.state.skeletonMaskCanvas) {
        const rctx = rc.getContext('2d');
        if (rctx) {
          rctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);

          // Draw original source, then mask with skeletonMaskCanvas
          rctx.drawImage(this.offscreen, 0, 0);
          rctx.globalCompositeOperation = 'destination-in';
          rctx.drawImage(this.state.skeletonMaskCanvas, 0, 0);
          rctx.globalCompositeOperation = 'source-over';

          this.ctx.drawImage(rc, 0, 0);
        }
      }
      this.ctx.restore();

      // Draw hand at active tip
      const dir = lastX >= prevX ? 1 : -1;
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, lastX, lastY, dir, this.state.hand);

      // Progress reporting
      const progress = this.state.skeletonTotalPts > 0
        ? Math.min(1.0, this.state.skeletonDrawnPts / this.state.skeletonTotalPts)
        : 1.0;
      this.setProgress(progress);

      if (this.state.skeletonStrokeIdx >= strokes.length) {
        this.finishAnim();
      }
    });
  }
}

module.exports = SkeletonTrace;
