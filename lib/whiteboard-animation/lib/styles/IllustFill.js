const Animation = require('../Animation');
const { ordonnerSegments } = require('../ordonner-segments');
const { wcFill, decouperGroupeCouleur, waypointsGroupeCouleur, grouperCouleurs } = require('../AnimationUtils');

class IllustFill extends Animation {
  constructor(options) {
    super(options);
    this.mode = options.mode || 'illustfill'; // 'illustfill' or 'outlineonly'
  }

  revelerSource() {
    return this.mode !== 'outlineonly';
  }

  setup() {
    const cb = this.state.contentBounds;
    const map = this.buildPresenceMap();
    const W = cb.w, H = cb.h;
    const ocd = this.offscreen.getContext('2d').getImageData(cb.x, cb.y, W, H).data;

    const sensitivity = this.state.outlineDetect ? 0.5 : 0;
    const INK_LUM = Math.round(20 + sensitivity * 100);
    const INK_SAT = Math.round(4 + sensitivity * 32);
    const MAX_THICKNESS = Math.round((4 + sensitivity * 8) * (this.resScale?.() || 1));

    const isInkColor = (i4) => {
      if (ocd[i4 + 3] < 20) return false;
      const r = ocd[i4], g = ocd[i4 + 1], b = ocd[i4 + 2];
      if (0.299 * r + 0.587 * g + 0.114 * b >= INK_LUM) return false;
      return Math.max(r, g, b) - Math.min(r, g, b) < INK_SAT;
    };

    const rawInk = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (isInkColor((y * W + x) * 4)) rawInk[y * W + x] = 1;
    }

    const isInk = (x, y) => {
      if (!rawInk[y * W + x]) return false;
      let hSpan = 1;
      for (let dx = 1; x + dx < W && rawInk[y * W + (x + dx)]; dx++) hSpan++;
      for (let dx = 1; x - dx >= 0 && rawInk[y * W + (x - dx)]; dx++) hSpan++;
      if (hSpan > MAX_THICKNESS) {
        let vSpan = 1;
        for (let dy = 1; y + dy < H && rawInk[(y + dy) * W + x]; dy++) vSpan++;
        for (let dy = 1; y - dy >= 0 && rawInk[(y - dy) * W + x]; dy++) vSpan++;
        if (vSpan > MAX_THICKNESS) return false;
      }
      return true;
    };

    const edgeMap = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!map[y * W + x]) continue;
      if ((x === 0 || !map[y * W + (x - 1)]) || (x === W - 1 || !map[y * W + (x + 1)]) ||
          (y === 0 || !map[(y - 1) * W + x]) || (y === H - 1 || !map[(y + 1) * W + x]))
        edgeMap[y * W + x] = 1;
    }

    const raw = [];
    for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) { if (edgeMap[y * W + x]) { raw.push({ x: cb.x + x, y: cb.y + y }); break; } } }
    for (let y = 0; y < H; y++) { for (let x = W - 1; x >= 0; x--) { if (edgeMap[y * W + x]) { raw.push({ x: cb.x + x, y: cb.y + y }); break; } } }
    for (let x = W - 1; x >= 0; x--) { for (let y = H - 1; y >= 0; y--) { if (edgeMap[y * W + x]) { raw.push({ x: cb.x + x, y: cb.y + y }); break; } } }
    for (let y = H - 1; y >= 0; y--) { for (let x = 0; x < W; x++) { if (edgeMap[y * W + x]) { raw.push({ x: cb.x + x, y: cb.y + y }); break; } } }

    const resPointScale = this.resPointScale?.() || 1;
    const pStride = Math.max(1, Math.floor(raw.length / Math.round(700 * resPointScale)));
    const perimPts = raw.filter((_, i) => i % pStride === 0);
    if (perimPts.length > 1) perimPts.push({ ...perimPts[0] });

    let darkest = 766, dR = 20, dG = 20, dB = 20;
    for (let i = 0; i < raw.length; i += Math.max(1, Math.floor(raw.length / Math.round(300 * resPointScale)))) {
      const p = raw[i], lx = p.x - cb.x, ly = p.y - cb.y, i4 = (ly * W + lx) * 4;
      const r = ocd[i4], g = ocd[i4 + 1], b = ocd[i4 + 2], a = ocd[i4 + 3];
      if (a > 80 && r + g + b < darkest) { darkest = r + g + b; dR = r; dG = g; dB = b; }
    }
    let outlineColor = darkest > 550 ? '#111' : `rgb(${Math.max(0, dR - 20)},${Math.max(0, dG - 20)},${Math.max(0, dB - 20)})`;
    const resScale = this.resScale?.() || 1;
    const ifThickness = 2 * resScale;

    const GAP = Math.round(5 * resScale);
    const inkSet = new Uint8Array(W * H);
    const segments = [];
    let curSeg = null;
    let lastX = -9999, lastY = -9999;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!isInk(x, y)) continue;
        inkSet[y * W + x] = 1;
        const px = cb.x + x, py = cb.y + y;
        const dist = Math.abs(px - lastX) + Math.abs(py - lastY);
        if (!curSeg || dist > GAP) {
          curSeg = [];
          segments.push(curSeg);
        }
        curSeg.push({ x: px, y: py });
        lastX = px; lastY = py;
      }
    }

    const MAX_SEG_PX = Math.round(200 * resScale);
    const subSampled = segments
      .filter(seg => seg.length >= 1)
      .map(seg => {
        if (seg.length <= MAX_SEG_PX) return seg;
        const k = Math.ceil(seg.length / MAX_SEG_PX);
        const out = [seg[0]];
        for (let i = 1; i < seg.length - 1; i++) { if (i % k === 0) out.push(seg[i]); }
        out.push(seg[seg.length - 1]);
        return out;
      });

    // Enchainement des segments par plus proche voisin. Le balayage complet
    // qui vivait ici etait en N² : ordonnerSegments rend exactement le meme
    // ordre (un test de parite le verifie) sans le cout.
    const depart = perimPts.length > 0
      ? perimPts[perimPts.length - 1]
      : { x: cb.x + cb.w / 2, y: cb.y };
    const ordered = ordonnerSegments(subSampled, depart);

    const inkWaypoints = [];
    ordered.forEach(seg => {
      seg.forEach((pt, i) => inkWaypoints.push({ x: pt.x, y: pt.y, lift: i === 0 }));
    });

    const totalPx = map.reduce((s, v) => s + v, 0);
    const minPx = Math.max(Math.round(20 * resScale * resScale), totalPx * 0.003);
    // outlineonly ne peint jamais ses couleurs, mais leur NOMBRE regle le
    // partage du temps entre ses phases : on ne compte que les groupes.
    const sansPixels = this.mode === 'outlineonly';
    const { groups, small, smallCount } = grouperCouleurs(ocd, cb, this.state.canvasW, minPx, { exclu: inkSet, sansPixels });
    const colorGroups = groups;
    if (smallCount > 0) {
      colorGroups.push({ r: 128, g: 128, b: 128, pixels: sansPixels ? null : small });
    }

    // Les pixels d'un groupe sortent de la boucle ci-dessus, donc de la region
    // courante : son canvas n'a besoin que de son propre cadre. Il etait
    // alloue en PLEIN CADRE, une fois par groupe — a 1920x1080 c'est 8 Mo par
    // couleur, reserves a chaque entree de region, pour n'en peindre qu'une
    // fraction. Les coordonnees restent celles du canvas : `box` dit ou le
    // cadre se pose, et wcFill fait la conversion.
    if (!sansPixels) {
      const srcFull = this.offscreen.getContext('2d').getImageData(0, 0, this.state.canvasW, this.state.canvasH);
      colorGroups.forEach(grp => {
        grp.preCanvas = decouperGroupeCouleur(
          grp, srcFull, this.state.canvasW,
          (w, h) => this.createOffscreenCanvas(w, h)
        );
        grp.waypoints = waypointsGroupeCouleur(grp.pixels, this.state.canvasW);
      });
    }

    this.state.ifOutlineCanvas = this.createOffscreenCanvas(this.state.canvasW, this.state.canvasH);
    this.state.ifOutlineCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);
    this.state.ifInkCanvas = this.createOffscreenCanvas(this.state.canvasW, this.state.canvasH);
    this.state.ifInkCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);
    this.state.ifColorCanvas = this.createOffscreenCanvas(this.state.canvasW, this.state.canvasH);
    this.state.ifColorCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);

    this.state.ifPhase = 1;
    this.state.ifPerimPts = perimPts;
    this.state.ifPerimIdx = 0;
    this.state.ifLastDrawn = 0;
    this.state.ifOutlineColor = outlineColor;
    this.state.ifOutlineThickness = ifThickness;
    this.state.ifInkWaypoints = inkWaypoints;
    this.state.ifInkIdx = 0;
    this.state.ifInkLastDrawn = 0;
    this.state.ifColorGroups = colorGroups;
    this.state.ifColorIdx = 0;
    this.state.ifWaypointIdx = 0;
    this.state.ifRevealY = 0;
  }

  tick(speed, deltaMs = 16.67) {
    const handSpeed = this.state.handSpeed || 5;
    const resScale = this.resScale?.() || 1;
    const JUMP = 8 * resScale;

    this.withAnnotationAwareness(deltaMs, this._enchainer(() => `${this.state.ifPhase}:${this.state.ifColorIdx}`, (annot, bounds, paceSpeed, legacy) => {
      // contentBounds pointe sur la region ACTIVE : le lire ICI, apres que
      // withAnnotationAwareness l'ait bascule. Le lire en haut de tick()
      // renvoyait la region precedente pendant une frame, et la main restait
      // un instant a l'ancien endroit a chaque changement de region.
      const cb = this.state.contentBounds;
      // Derive de setup(), donc de la region ACTIVE : a lire ici, pas en haut
      // de tick(). Sinon le nombre de phases vient de la region precedente
      // et paceStep cadence le balayage a la mauvaise vitesse.
      const nColors = this.state.ifColorGroups ? this.state.ifColorGroups.length : 1;
      // Une phase sans rien a tracer ne doit pas garder sa part du temps.
      const aDeLEncre = !!(this.state.ifInkWaypoints && this.state.ifInkWaypoints.length);
      const totalPhases = this.mode === 'outlineonly' ? (aDeLEncre ? 2 : 1) : 2 + nColors;
      // Reset when annotation changes
      if (this.state._annotationChanged) {
        this.state.ifPhase = 1;
        this.state.ifPerimIdx = 0;
        this.state.ifLastDrawn = 0;
        this.state.ifInkIdx = 0;
        this.state.ifInkLastDrawn = 0;
        this.state.ifColorIdx = 0;
        this.state.ifWaypointIdx = 0;
        this.state.ifRevealY = cb.y;
      }

      if (this.state.ifPhase === 1) {
      const pts = this.state.ifPerimPts || [];
      // ponytail: an annotation region can be empty - skip instead of pts[-1].
      if (!pts.length) { this.state.ifPhase = 2; this.state.ifInkIdx = 0; this.state.ifInkLastDrawn = 0; return; }
      const step = this.paceStep(pts.length, Math.max(1, handSpeed), totalPhases, 1);
      const newIdx = Math.min(this.state.ifPerimIdx + step, pts.length - 1);
      const oc = this.state.ifOutlineCanvas.getContext('2d');
      if (newIdx > this.state.ifLastDrawn) {
        this.strokePencil(oc, pts, this.state.ifLastDrawn, newIdx,
          this.state.ifOutlineColor, this.state.ifOutlineThickness ?? (2.4 * resScale),
          JUMP);
        this.state.ifLastDrawn = newIdx;
      }
      this.state.ifPerimIdx = newIdx;
      this.ctx.save(); if (legacy) this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.ifOutlineCanvas, 0, 0);
      
      this.ctx.restore();
      const tip = pts[newIdx], prev = pts[Math.max(0, newIdx - 1)];
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, tip.x, tip.y, tip.x >= prev.x ? 1 : -1, this.state.hand);
      this.setProgress((newIdx / pts.length) * (1 / totalPhases));
      if (newIdx >= pts.length - 1) { this.state.ifPhase = 2; this.state.ifInkIdx = 0; this.state.ifInkLastDrawn = 0; }
      // outlineonly enchaine dans la meme frame : sans couleurs, une frame vide
      // par changement de phase le faisait deborder de sa fenetre.
      if (this.state.ifPhase === 1 || this.mode !== 'outlineonly') return;
    }

    if (this.state.ifPhase === 2) {
      const wps = this.state.ifInkWaypoints;
      if (!wps || wps.length === 0) {
        this.state.ifPhase = 3; this.state.ifColorIdx = 0; this.state.ifRevealY = cb.y;
        if (this.mode !== 'outlineonly') return;
      } else {
      // Cap step so the final strokes never flash — at most 1% of waypoints per tick
      const maxStep = Math.max(1, Math.floor(wps.length * 0.01));
      const step = this.paceStep(wps.length, Math.min(Math.max(1, handSpeed), maxStep), totalPhases, 2);
      const newIdx = Math.min(this.state.ifInkIdx + step, wps.length - 1);
      const ic = this.state.ifInkCanvas.getContext('2d');

      if (newIdx > this.state.ifInkLastDrawn) {
        this.strokePencil(ic, wps, this.state.ifInkLastDrawn, newIdx,
          this.state.ifOutlineColor, this.state.ifOutlineThickness ?? (1.8 * resScale),
          JUMP);
        this.state.ifInkLastDrawn = newIdx;
      }
      this.state.ifInkIdx = newIdx;

      this.ctx.save(); if (legacy) this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.ifOutlineCanvas, 0, 0);
      this.ctx.drawImage(this.state.ifInkCanvas, 0, 0);
      this.ctx.restore();

      const tip = wps[newIdx], prev = wps[Math.max(0, newIdx - 1)];
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, tip.x, tip.y, tip.x >= prev.x ? 1 : -1, this.state.hand);
      this.setProgress((1 / totalPhases) + (newIdx / wps.length) * (1 / totalPhases));

      if (newIdx >= wps.length - 1) {
        this.state.ifPhase = 3; this.state.ifColorIdx = 0;
        this.state.ifWaypointIdx = 0; this.state.ifRevealY = cb.y;
      }
      if (this.state.ifPhase === 2 || this.mode !== 'outlineonly') return;
      }
    }

    if (this.mode === 'outlineonly') {
      // outline-only has no colour phase: outline + ink are done here.
      // ponytail: the old guard tested ifColorIdx >= nColors, but nothing ever
      // incremented ifColorIdx on this path, so it span forever.
      this.ctx.save(); if (legacy) this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.ifOutlineCanvas, 0, 0);
      this.ctx.drawImage(this.state.ifInkCanvas, 0, 0);
      this.ctx.restore();
      // Le trace est fini : la main n'a plus rien a dessiner. Sans cet effacement
      // elle restait figee sur son dernier point, seul element immobile d'une
      // image achevee. Meme regle que la pause entre deux annotations.
      this.setProgress(1);
      if (legacy) {
        this.finishAnim();
      } else {
        this._regionDone = true; this._flushRegion();
      }
      return;
    }

    if (this.state.ifPhase === 3) {
      if (this.state.ifColorIdx >= nColors) {
        if (legacy) {
          this.finishAnim();
        } else {
          this._regionDone = true; this._flushRegion();
        }
        return;
      }
      const grp = this.state.ifColorGroups[this.state.ifColorIdx];
      // Un groupe de couleur n'occupe qu'une partie de la region. Le faire
      // balayer toute la hauteur laissait la main garee sur sa premiere ligne
      // pendant que le front traversait du vide (jusqu'a 579px d'attente).
      // Le balayage se limite donc a l'etendue verticale du groupe.
      const _wp = grp && grp.waypoints && grp.waypoints.length ? grp.waypoints : null;
      const _haut = _wp ? Math.max(cb.y, _wp[0].y) : cb.y;
      const _bas = _wp ? Math.min(cb.y + cb.h, _wp[_wp.length - 1].y) : cb.y + cb.h;
      if (this.state.ifRevealY < _haut) this.state.ifRevealY = _haut;
      const _etendue = Math.max(1, _bas - _haut);
      const maxY = Math.max(_haut, _bas);
      const advance = this.paceStep(_etendue, Math.max(1, Math.round(speed * 0.7)), totalPhases, 3 + this.state.ifColorIdx);
      this.state.ifRevealY = Math.min(this.state.ifRevealY + advance, maxY);

      // La couleur s'accumule dans ifColorCanvas et se dessine SOUS le contour
      // et l'encre (comme animations.js). La peindre directement sur ctx
      // recouvrait les traits, et chaque frame effacait les groupes de couleur
      // deja remplis.
      const revealH = this.state.ifRevealY - cb.y;
      if (revealH > 0 && grp && grp.preCanvas) {
        this.wcFill(this.state.ifColorCanvas.getContext('2d'), grp.preCanvas, cb, revealH, grp.box);
      }

      this.ctx.save(); if (legacy) this.fillBg(this.ctx);
      this.ctx.drawImage(this.state.ifColorCanvas, 0, 0);
      this.ctx.drawImage(this.state.ifOutlineCanvas, 0, 0);
      this.ctx.drawImage(this.state.ifInkCanvas, 0, 0);
      this.ctx.restore();

      // La main est repeinte a CHAQUE frame de balayage. Laisser clearRect a
      // l'interieur du garde figeait la main a sa position precedente quand un
      // groupe de couleur n'avait aucun waypoint : le front repartait en haut,
      // la main restait en bas (jusqu'a 579px de retard).
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      {
        const wpts = grp && grp.waypoints;
        let tip, dir = 1;
        if (wpts && wpts.length > 0) {
          let wi = this.state.ifWaypointIdx;
          while (wi < wpts.length - 1 && wpts[wi].y < this.state.ifRevealY) wi++;
          this.state.ifWaypointIdx = wi;
          tip = wpts[Math.min(wi, wpts.length - 1)];
          const prev2 = wpts[Math.max(0, wi - 1)];
          dir = tip.x >= prev2.x ? 1 : -1;
        } else {
          tip = { x: cb.x + cb.w / 2, y: this.state.ifRevealY };
        }
        this.drawHand(this.hctx, tip.x, tip.y, dir, this.state.hand);
      }

      const phaseBase = (2 + this.state.ifColorIdx) / totalPhases;
      const phaseSpan = 1 / totalPhases;
      this.setProgress(phaseBase + (this.state.ifRevealY - cb.y) / cb.h * phaseSpan);

      if (this.state.ifRevealY >= maxY) {
        this.state.ifColorIdx++;
        this.state.ifWaypointIdx = 0;
        this.state.ifRevealY = cb.y;
        if (this.state.ifColorIdx >= nColors) {
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

  createOffscreenCanvas(w, h) {
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    throw new Error('Canvas creation not available');
  }

  strokePencil(oc, pts, fromIdx, toIdx, color, thickness, JUMP) {
    const ctx = oc;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(pts[fromIdx].x, pts[fromIdx].y);
    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const p = pts[i], prev = pts[i - 1];
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (p.lift || dist > JUMP) {
        ctx.stroke(); ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Depose la bande deja devoilee du groupe sur le calque de couleur.
   * Methode d'instance conservee comme point de surcharge ; le calcul vit
   * dans AnimationUtils, partage avec OutlineFill.
   */
  wcFill(cc, srcCanvas, cb, revealH, box) {
    wcFill(cc, srcCanvas, cb, revealH, box);
  }
}

module.exports = IllustFill;
