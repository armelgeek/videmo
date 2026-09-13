const Animation = require('../Animation');
const AnimationUtils = require('../AnimationUtils');
const { revealDisc } = AnimationUtils;
const { tuilesPourRegion } = AnimationUtils;

const SPECIALIZED_ORDERS = {
  human(tiles, cb) {
    const H = cb.h;
    function bandScore(normY) {
      if (normY < 0.20) return normY * 1.0;
      if (normY < 0.35) return 0.20 + (normY - 0.20) * 1.2;
      if (normY < 0.65) return 0.38 + (normY - 0.35) * 1.0;
      if (normY < 0.75) return 0.68 + (normY - 0.65) * 1.0;
      return 0.78 + (normY - 0.75) * 1.0;
    }
    return [...tiles].sort((a, b) => {
      const ay = (a.cy - cb.y) / H, by = (b.cy - cb.y) / H;
      const aCx = Math.abs((a.cx - cb.x) / cb.w - 0.5) * 0.08;
      const bCx = Math.abs((b.cx - cb.x) / cb.w - 0.5) * 0.08;
      return (bandScore(ay) + aCx + Math.random() * 0.03) -
             (bandScore(by) + bCx + Math.random() * 0.03);
    });
  },

  animal(tiles, cb) {
    const W = cb.w, H = cb.h;
    return [...tiles].sort((a, b) => {
      const ax = (a.cx - cb.x) / W;
      const bx = (b.cx - cb.x) / W;
      const ayNorm = (a.cy - cb.y) / H;
      const byNorm = (b.cy - cb.y) / H;
      const aBody = Math.abs(ayNorm - 0.45) * 0.18;
      const bBody = Math.abs(byNorm - 0.45) * 0.18;
      return (ax + aBody + Math.random() * 0.04) -
             (bx + bBody + Math.random() * 0.04);
    });
  },

  vehicle(tiles, cb) {
    const W = cb.w, H = cb.h;
    return [...tiles].sort((a, b) => {
      const ax = (a.cx - cb.x) / W;
      const bx = (b.cx - cb.x) / W;
      const ayNorm = (a.cy - cb.y) / H;
      const byNorm = (b.cy - cb.y) / H;
      const aPhase = ayNorm > 0.75 ? 1 + (1 - ax) * 0.3 : ax;
      const bPhase = byNorm > 0.75 ? 1 + (1 - bx) * 0.3 : bx;
      return (aPhase + Math.random() * 0.04) - (bPhase + Math.random() * 0.04);
    });
  },

  building(tiles, cb) {
    const W = cb.w, H = cb.h;
    return [...tiles].sort((a, b) => {
      const ay = 1 - (a.cy - cb.y) / H;
      const by = 1 - (b.cy - cb.y) / H;
      const ax = (a.cx - cb.x) / W * 0.12;
      const bx = (b.cx - cb.x) / W * 0.12;
      return (ay + ax + Math.random() * 0.04) - (by + bx + Math.random() * 0.04);
    });
  },

  nature(tiles, cb) {
    const W = cb.w, H = cb.h;
    return [...tiles].sort((a, b) => {
      const ax = (a.cx - cb.x) / W, ay = (a.cy - cb.y) / H;
      const bx = (b.cx - cb.x) / W, by = (b.cy - cb.y) / H;
      const aDist = Math.min(ax, 1 - ax, ay, 1 - ay);
      const bDist = Math.min(bx, 1 - bx, by, 1 - by);
      const aAngle = Math.atan2(ay - 0.5, ax - 0.5) / (Math.PI * 2) * 0.04;
      const bAngle = Math.atan2(by - 0.5, bx - 0.5) / (Math.PI * 2) * 0.04;
      return (aDist + aAngle + Math.random() * 0.03) -
             (bDist + bAngle + Math.random() * 0.03);
    });
  },

  portrait(tiles, cb) {
    const W = cb.w, H = cb.h;
    const fx = cb.x + W * 0.50;
    const fy = cb.y + H * 0.38;
    return [...tiles].sort((a, b) => {
      const da = Math.hypot((a.cx - fx), (a.cy - fy) * 1.25);
      const db = Math.hypot((b.cx - fx), (b.cy - fy) * 1.25);
      return (da + Math.random() * 18) - (db + Math.random() * 18);
    });
  },

  landscape(tiles, cb) {
    const W = cb.w, H = cb.h;
    const ZONES = 4;
    return [...tiles].sort((a, b) => {
      const zA = Math.floor(((a.cy - cb.y) / H) * ZONES);
      const zB = Math.floor(((b.cy - cb.y) / H) * ZONES);
      if (zA !== zB) return zA - zB;
      return ((a.cx - cb.x) / W) - ((b.cx - cb.x) / W) + (Math.random() - 0.5) * 0.12;
    });
  },

  spiral(tiles, cb) {
    const cx = cb.x + cb.w / 2, cy = cb.y + cb.h / 2;
    const maxR = Math.hypot(cb.w / 2, cb.h / 2);
    return [...tiles].sort((a, b) => {
      const ra = Math.hypot(a.cx - cx, a.cy - cy);
      const rb = Math.hypot(b.cx - cx, b.cy - cy);
      const aa = ((Math.atan2(a.cy - cy, a.cx - cx) + Math.PI * 2) % (Math.PI * 2));
      const ab = ((Math.atan2(b.cy - cy, b.cx - cx) + Math.PI * 2) % (Math.PI * 2));
      const sa = (ra / maxR) + aa / (Math.PI * 2) * 0.6;
      const sb = (rb / maxR) + ab / (Math.PI * 2) * 0.6;
      return sa - sb;
    });
  },

  explode(tiles, cb) {
    const cx = cb.x + cb.w / 2, cy = cb.y + cb.h / 2;
    return [...tiles].sort((a, b) => {
      const da = Math.hypot(a.cx - cx, a.cy - cy);
      const db = Math.hypot(b.cx - cx, b.cy - cy);
      return (db + Math.random() * 22) - (da + Math.random() * 22);
    });
  },
};

class Specialized extends Animation {
  constructor(options) {
    super(options);
    this.kind = options.kind || 'spiral';
  }

  setup() {
    // Tuiles derivees de la taille de la region : voir tuilesPourRegion.
    const numTiles = tuilesPourRegion(this.state.contentBounds);
    const cb = this.state.contentBounds;
    const orderFn = SPECIALIZED_ORDERS[this.kind] || SPECIALIZED_ORDERS.spiral;

    const { pts } = AnimationUtils.buildTileWaypoints(this, numTiles, (tiles) => orderFn(tiles, cb));

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

      this.state.scribblePhase = (this.state.scribblePhase || 0) + 0.1;
      const rhythmMult = 0.7 + 0.5 * Math.abs(Math.sin(this.state.scribblePhase));
      const advance = this.paceStep(pts.length, Math.max(1, Math.round(handSpeed * rhythmMult)));
      const rc = this.state.revealCanvas.getContext('2d');

      for (let i = 0; i < advance; i++) {
        if (this.state.strokeIdx >= pts.length) break;
        const tip = pts[this.state.strokeIdx++];
        if (tip.isLift || tip.isJump) continue;
        revealDisc(rc, this.offscreen, tip.x, tip.y, tip.strokeR || 8);
      }

      this.ctx.save();
      this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.revealCanvas, 0, 0);
      this.ctx.restore();

      if (this.state.strokeIdx >= pts.length) { if (legacy) this.finishAnim(); return; }

      const idx = Math.max(0, this.state.strokeIdx - 1);
      const tip = pts[idx];
      const dir = (tip.isLift || tip.isJump) ? 1 : (idx > 0 && pts[idx].x >= pts[idx - 1].x ? 1 : -1);
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      this.setProgress(this.state.strokeIdx / pts.length);
    });
  }
}

module.exports = Specialized;
