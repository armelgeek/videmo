const Animation = require('../Animation');
const { strokePencil, watercolorizeCanvas, fillGapsCanvas, wcFill,
        decouperGroupeCouleur, waypointsGroupeCouleur, grouperCouleurs } = require('../AnimationUtils');

class OutlineFill extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const map = this.buildPresenceMap();
    const W = cb.w, H = cb.h;
    const ocd = this.offscreen.getContext('2d').getImageData(cb.x, cb.y, W, H).data;

    const edgeMap = this.buildEdgeMap(map);
    const raw = this.collectEdgePixels(edgeMap);

    const stride = Math.max(1, Math.floor(raw.length / Math.round(700 * this.resPointScale())));
    const perimPts = raw.filter((_, i) => i % stride === 0);
    if (perimPts.length > 1) perimPts.push({...perimPts[0]});

    let darkest = 766, dR = 20, dG = 20, dB = 20;
    for (let i = 0; i < raw.length; i += Math.max(1, Math.floor(raw.length / Math.round(300 * this.resPointScale())))) {
      const p = raw[i], lx = p.x - cb.x, ly = p.y - cb.y, i4 = (ly * W + lx) * 4;
      const r = ocd[i4], g = ocd[i4 + 1], b = ocd[i4 + 2], a = ocd[i4 + 3];
      if (a > 80 && r + g + b < darkest) { darkest = r + g + b; dR = r; dG = g; dB = b; }
    }
    let outlineColor = darkest > 550 ? '#111' : `rgb(${Math.max(0, dR - 20)},${Math.max(0, dG - 20)},${Math.max(0, dB - 20)})`;
    const ofThickness = 2 * this.resScale();

    const totalPx = map.reduce((s, v) => s + v, 0);
    const minPx = Math.max(Math.round(20 * this.resScale() * this.resScale()), totalPx * 0.003);
    const colorGroups = grouperCouleurs(ocd, cb, this.state.canvasW, minPx).groups;

    const srcFull = this.offscreen.getContext('2d').getImageData(0, 0, this.state.canvasW, this.state.canvasH);
    const makeCanvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      return c;
    };
    colorGroups.forEach(grp => {
      const c = decouperGroupeCouleur(grp, srcFull, this.state.canvasW, makeCanvas);
      const cstyle = this.state.colorStyle || 'sparse';
      if (cstyle === 'watercolor') grp.preCanvas = watercolorizeCanvas(c);
      else if (cstyle === 'filled') grp.preCanvas = fillGapsCanvas(c);
      else grp.preCanvas = c;

      grp.waypoints = waypointsGroupeCouleur(grp.pixels, this.state.canvasW);
    });

    this.state.ofOutlineCanvas = document.createElement('canvas');
    this.state.ofOutlineCanvas.width = this.state.canvasW;
    this.state.ofOutlineCanvas.height = this.state.canvasH;
    this.state.ofOutlineCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);

    this.state.ofColorCanvas = document.createElement('canvas');
    this.state.ofColorCanvas.width = this.state.canvasW;
    this.state.ofColorCanvas.height = this.state.canvasH;
    this.state.ofColorCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);

    this.state.ofPhase = 1;
    this.state.ofPerimPts = perimPts;
    this.state.ofPerimIdx = 0;
    this.state.ofLastDrawn = 0;
    this.state.ofOutlineColor = outlineColor;
    this.state.ofOutlineThickness = ofThickness;
    this.state.ofColorGroups = colorGroups;
    this.state.ofColorIdx = 0;
    this.state.ofWaypointIdx = 0;
    this.state.ofRevealY = 0;
  }

  /**
   * Reveals the already-filled part of a colour group.
   *
   * Isolated here so that styles inheriting from OutlineFill replace ONLY the
   * fill: the outline, the split into groups and the pacing stay theirs.
   * `progress` goes from 0 to 1 over the group's extent, whereas `revealH` is
   * a height in pixels from the top of the region — a fill that is not a
   * horizontal roller blind needs the former.
   */
  revealFill(cc, grp, cb, revealH) {
    wcFill(cc, grp.preCanvas, cb, revealH, grp.box);
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;

    this.withAnnotationAwareness(deltaMs, this._enchainer(() => `${this.state.ofPhase}:${this.state.ofColorIdx}`, (annot, bounds, paceSpeed, legacy) => {
      // contentBounds points to the ACTIVE region: read it HERE, after
      // withAnnotationAwareness has switched it. Reading it at the top of tick()
      // returned the previous region for one frame, and the hand lingered
      // briefly at the old spot on every region change.
      const cb = this.state.contentBounds;
      // Derived from setup(), hence from the ACTIVE region: read it here, not at
      // the top of tick(). Otherwise the phase count comes from the previous
      // region and paceStep paces the sweep at the wrong speed.
      const totalPhases = 1 + (this.state.ofColorGroups ? this.state.ofColorGroups.length : 1);
      // Reset when annotation changes
      if (this.state._annotationChanged) {
        this.state.ofPhase = 1;
        this.state.ofPerimIdx = 0;
        this.state.ofLastDrawn = 0;
        this.state.ofColorIdx = 0;
        this.state.ofWaypointIdx = 0;
        this.state.ofRevealY = cb.y;
      }

      if (this.state.ofPhase === 1) {
      const JUMP = 8 * this.resScale();
      const pts = this.state.ofPerimPts || [];
      // ponytail: an annotation region can be empty - skip instead of pts[-1].
      if (!pts.length) { this.state.ofPhase = 2; this.state.ofColorIdx = 0; this.state.ofWaypointIdx = 0; this.state.ofRevealY = cb.y; return; }
      const step = this.paceStep(pts.length, Math.max(1, handSpeed), totalPhases, 1);
      const newIdx = Math.min(this.state.ofPerimIdx + step, pts.length - 1);
      const oc = this.state.ofOutlineCanvas.getContext('2d');

      if (newIdx > this.state.ofLastDrawn) {
        strokePencil(oc, pts, this.state.ofLastDrawn, newIdx,
          this.state.ofOutlineColor, this.state.ofOutlineThickness ?? (2.4 * this.resScale()),
          JUMP);
        this.state.ofLastDrawn = newIdx;
      }
      this.state.ofPerimIdx = newIdx;

      this.ctx.save();
      if (legacy) this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.ofOutlineCanvas, 0, 0);
      this.ctx.restore();

      const tip = pts[newIdx];
      const prev = pts[Math.max(0, newIdx - 1)];
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, tip.x, tip.y, tip.x >= prev.x ? 1 : -1, this.state.hand);
      this.setProgress((newIdx / pts.length) * (1 / totalPhases));

      if (newIdx >= pts.length - 1) {
        this.state.ofPhase = 2;
        this.state.ofColorIdx = 0;
        this.state.ofWaypointIdx = 0;
        this.state.ofRevealY = cb.y;
      }
    } else {
      const grpIdx = this.state.ofColorIdx;
      if (!this.state.ofColorGroups || grpIdx >= this.state.ofColorGroups.length) {
        if (legacy) {
          this.finishAnim();
        } else {
          this._regionDone = true; this._flushRegion();
        }
        return;
      }

      const grp = this.state.ofColorGroups[grpIdx];
      // A colour group only occupies part of the region. Sweeping the whole
      // height left the hand parked on its first line while the front crossed
      // empty space (up to 579px of waiting). So the sweep is limited to the
      // group's vertical extent.
      const _wp = grp && grp.waypoints && grp.waypoints.length ? grp.waypoints : null;
      const _top = _wp ? Math.max(cb.y, _wp[0].y) : cb.y;
      const _bottom = _wp ? Math.min(cb.y + cb.h, _wp[_wp.length - 1].y) : cb.y + cb.h;
      if (this.state.ofRevealY < _top) this.state.ofRevealY = _top;
      const _extent = Math.max(1, _bottom - _top);
      const maxY = Math.max(_top, _bottom);
      const advance = this.paceStep(_extent, Math.max(1, Math.round(speed * 0.7)), totalPhases, 2 + this.state.ofColorIdx);
      this.state.ofRevealY = Math.min(this.state.ofRevealY + advance, maxY);

      const revealH = this.state.ofRevealY - cb.y;
      if (revealH > 0) {
        const cc = this.state.ofColorCanvas.getContext('2d');
        const progress = (this.state.ofRevealY - _top) / _extent;
        this.revealFill(cc, grp, cb, revealH, progress);
      }

      this.ctx.save();
      if (legacy) this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.ofColorCanvas, 0, 0);
      this.ctx.drawImage(this.state.ofOutlineCanvas, 0, 0);
      this.ctx.restore();

      // The hand is repainted on EVERY sweep frame. Keeping clearRect inside
      // the guard froze the hand at its previous position when a colour group
      // had no waypoint: the front restarted at the top, the hand stayed at the
      // bottom (up to 579px behind).
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      {
        const wpts = grp && grp.waypoints;
        let tip, dir = 1;
        if (wpts && wpts.length > 0) {
          let wi = this.state.ofWaypointIdx;
          while (wi < wpts.length - 1 && wpts[wi].y < this.state.ofRevealY) wi++;
          this.state.ofWaypointIdx = wi;
          tip = wpts[Math.min(wi, wpts.length - 1)];
          const prev2 = wpts[Math.max(0, wi - 1)];
          dir = tip.x >= prev2.x ? 1 : -1;
        } else {
          // group without waypoint: still follow the sweep front
          tip = { x: cb.x + cb.w / 2, y: this.state.ofRevealY };
        }
        this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      }

      const phaseBase = (1 + grpIdx) / totalPhases;
      const phaseSpan = 1 / totalPhases;
      this.setProgress(phaseBase + (this.state.ofRevealY - cb.y) / cb.h * phaseSpan);

      if (this.state.ofRevealY >= maxY) {
        this.state.ofColorIdx++;
        this.state.ofWaypointIdx = 0;
        this.state.ofRevealY = cb.y;
        if (this.state.ofColorIdx >= this.state.ofColorGroups.length) {
          if (legacy) {
            this.finishAnim();
          } else {
            this._regionDone = true; this._flushRegion();
          }
        }
      }
      }
    }));
  }
}

module.exports = OutlineFill;
