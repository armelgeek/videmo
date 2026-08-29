const Animation = require('../Animation');

class SpecText extends Animation {
  setup() {
    const cb = this.state.contentBounds;
    const map = this.buildPresenceMap();
    const dir = this.state.textAnimDir || 'ltr';
    const sty = this.state.textDrawStyle || 'reveal';

    const clusters = this.buildSpecTextClusters(cb, map, dir);

    if (sty === 'reveal') {
      this.state.strokeList = this.buildSpecTextRevealPts(clusters, cb, map);
      this.state.strokeIdx = 0;
      this.state.stPhase = 1;
      this.state.revealCanvas = null;
      this.ensureRevealCanvas();
    } else {
      const { pts, color, thickness } = this.buildSpecTextOutlinePts(clusters, cb, map);
      this.state.stOutlineCanvas = this.createOffscreenCanvas(this.state.canvasW, this.state.canvasH);
      this.state.stOutlineCanvas.getContext('2d').clearRect(0, 0, this.state.canvasW, this.state.canvasH);

      this.state.stOutlinePts = pts;
      this.state.stOutlineIdx = 0;
      this.state.stOutlineLastDrawn = 0;
      this.state.stOutlineColor = color;
      this.state.stOutlineThickness = thickness;
      this.state.stPhase = 1;

      if (sty === 'outline-fill') {
        this.state.stFillPts = this.buildSpecTextRevealPts(clusters, cb, map);
        this.state.strokeList = this.state.stFillPts;
        this.state.strokeIdx = 0;
        this.state.revealCanvas = null;
        this.ensureRevealCanvas();
      } else {
        this.state.stFillPts = null;
      }
    }
  }

  tick(speed, deltaMs = 16.67) {
    const sty = this.state.textDrawStyle || 'reveal';
    const handSpeed = this.state.handSpeed || 5;

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      if (this.state._annotationChanged) {
        this.state.strokeIdx = 0;
        this.state.stPhase = 1;
        this.state.stOutlineIdx = 0;
        this.state.stOutlineLastDrawn = 0;
      }

      if (sty === 'reveal') {
        const pts = this.state.strokeList;
        if (!pts || !pts.length) { if (legacy) this.finishAnim(); return; }
        let budget = this.paceStep(pts.length, handSpeed);
        while (budget > 0 && this.state.strokeIdx < pts.length) {
          const p = pts[this.state.strokeIdx++];
          if (!p.isJump) budget--;
          if (!p.isJump && p.revealColX !== undefined) {
            const rc = this.state.revealCanvas.getContext('2d');
            const rh = p.revealColY2 - p.revealColY1 + 1;
            if (rh > 0) rc.drawImage(this.offscreen, p.revealColX, p.revealColY1, p.revealColW, rh,
                                                p.revealColX, p.revealColY1, p.revealColW, rh);
          }
        }
        this.ctx.save(); this.fillBg(this.ctx); this.ctx.drawImage(this.state.revealCanvas, 0, 0); this.ctx.restore();
        if (this.state.strokeIdx >= pts.length) { if (legacy) this.finishAnim(); return; }
        const tip = pts[Math.min(this.state.strokeIdx, pts.length - 1)];
        const prv = pts[Math.max(0, this.state.strokeIdx - 1)];
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        this.drawHand(this.hctx, tip.x, tip.y, tip.isJump ? 1 : (tip.y >= prv.y ? 1 : -1), this.state.hand);
        this.setProgress(this.state.strokeIdx / pts.length);
        return;
      }

      const resScale = this.resScale();
      if (this.state.stPhase === 1) {
        const JUMP = 8 * resScale;
        const pts = this.state.stOutlinePts;
        if (!pts || !pts.length) {
          if (sty === 'outline') { if (legacy) this.finishAnim(); return; }
          this.state.stPhase = 2;
          this.state.strokeIdx = 0;
          return;
        }
        const step = this.paceStep(pts.length, Math.max(1, handSpeed), 2);
        const newIdx = Math.min(this.state.stOutlineIdx + step, pts.length - 1);
        const oc = this.state.stOutlineCanvas.getContext('2d');
        if (newIdx > this.state.stOutlineLastDrawn) {
          this.strokePencil(oc, pts, this.state.stOutlineLastDrawn, newIdx,
            this.state.stOutlineColor, this.state.stOutlineThickness, JUMP);
          this.state.stOutlineLastDrawn = newIdx;
        }
        this.state.stOutlineIdx = newIdx;
        this.ctx.save(); this.fillBg(this.ctx); this.ctx.drawImage(this.state.stOutlineCanvas, 0, 0); this.ctx.restore();
        const tip = pts[newIdx], prv = pts[Math.max(0, newIdx - 1)];
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        this.drawHand(this.hctx, tip.x, tip.y, tip.x >= prv.x ? 1 : -1, this.state.hand);
        this.setProgress(newIdx / pts.length * 0.5);
        if (newIdx >= pts.length - 1) { this.state.stPhase = 2; this.state.strokeIdx = 0; }
        return;
      }

      if (this.state.stPhase === 2) {
        const pts = this.state.stFillPts || this.state.strokeList;
        if (!pts || !pts.length) { if (legacy) this.finishAnim(); return; }
        let budget = this.paceStep(pts.length, handSpeed, 2);
        while (budget > 0 && this.state.strokeIdx < pts.length) {
          const p = pts[this.state.strokeIdx++];
          if (!p.isJump) budget--;
          if (!p.isJump && p.revealColX !== undefined) {
            const rc = this.state.revealCanvas.getContext('2d');
            const rh = p.revealColY2 - p.revealColY1 + 1;
            if (rh > 0) rc.drawImage(this.offscreen, p.revealColX, p.revealColY1, p.revealColW, rh,
                                                p.revealColX, p.revealColY1, p.revealColW, rh);
          }
        }
        this.ctx.save(); this.fillBg(this.ctx);
        this.ctx.drawImage(this.state.revealCanvas, 0, 0);
        this.ctx.drawImage(this.state.stOutlineCanvas, 0, 0);
        this.ctx.restore();
        if (this.state.strokeIdx >= pts.length) { if (legacy) this.finishAnim(); return; }
        this.setProgress(0.45 + (this.state.strokeIdx / pts.length) * 0.55);
        const tip = pts[Math.min(this.state.strokeIdx, pts.length - 1)];
        const prv = pts[Math.max(0, this.state.strokeIdx - 1)];
        this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
        this.drawHand(this.hctx, tip.x, tip.y, tip.isJump ? 1 : (tip.y >= prv.y ? 1 : -1), this.state.hand);
      }
    });
  }

  buildSpecTextClusters(cb, map, dir) {
    const W = cb.w, H = cb.h;
    const visited = new Uint8Array(W * H);
    const rawComps = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (!map[idx] || visited[idx]) continue;
        let minX = x, maxX = x, minY = y, maxY = y;
        const queue = [idx];
        visited[idx] = 1;
        let qi = 0;
        while (qi < queue.length) {
          const cur = queue[qi++];
          const cx2 = cur % W, cy2 = Math.floor(cur / W);
          minX = Math.min(minX, cx2); maxX = Math.max(maxX, cx2);
          minY = Math.min(minY, cy2); maxY = Math.max(maxY, cy2);
          for (const ni of [cur - 1, cur + 1, cur - W, cur + W]) {
            if (ni < 0 || ni >= W * H) continue;
            if (ni % W === 0 && cur % W === W - 1) continue;
            if (cur % W === 0 && ni % W === W - 1) continue;
            if (!map[ni] || visited[ni]) continue;
            visited[ni] = 1;
            queue.push(ni);
          }
        }
        if (queue.length < 3) continue;
        rawComps.push({ minX: cb.x + minX, maxX: cb.x + maxX, minY: cb.y + minY, maxY: cb.y + maxY });
      }
    }

    const MERGE_GAP = Math.max(6, Math.round(Math.min(W, H) * 0.05));
    const par = rawComps.map((_, i) => i);
    const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const union = (a, b) => { par[find(a)] = find(b); };
    for (let i = 0; i < rawComps.length; i++)
      for (let j = i + 1; j < rawComps.length; j++) {
        const a = rawComps[i], b = rawComps[j];
        if (a.maxX + MERGE_GAP >= b.minX && b.maxX + MERGE_GAP >= a.minX &&
            a.maxY + MERGE_GAP >= b.minY && b.maxY + MERGE_GAP >= a.minY) union(i, j);
      }
    const gm = new Map();
    rawComps.forEach((c, i) => {
      const r = find(i);
      if (!gm.has(r)) gm.set(r, { minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY });
      else { const g = gm.get(r); g.minX = Math.min(g.minX, c.minX); g.maxX = Math.max(g.maxX, c.maxX); g.minY = Math.min(g.minY, c.minY); g.maxY = Math.max(g.maxY, c.maxY); }
    });

    let clusters = [...gm.values()].map(g => ({ ...g, cx: (g.minX + g.maxX) / 2, cy: (g.minY + g.maxY) / 2 }));
    if (!clusters.length) clusters = [{ minX: cb.x, maxX: cb.x + W, minY: cb.y, maxY: cb.y + H, cx: cb.x + W / 2, cy: cb.y + H / 2 }];

    if (dir === 'ltr') clusters.sort((a, b) => (a.cx - b.cx) + (a.cy - b.cy) * 0.05);
    else if (dir === 'rtl') clusters.sort((a, b) => (b.cx - a.cx) + (a.cy - b.cy) * 0.05);
    else if (dir === 'ttb') clusters.sort((a, b) => (a.cy - b.cy) + (a.cx - b.cx) * 0.05);
    else if (dir === 'btt') clusters.sort((a, b) => (b.cy - a.cy) + (a.cx - b.cx) * 0.05);

    return clusters;
  }

  buildSpecTextRevealPts(clusters, cb, map) {
    const W = cb.w;
    const pts = [];
    clusters.forEach(cluster => {
      const cW = Math.max(1, cluster.maxX - cluster.minX);
      const COL_W = Math.max(3, Math.round(cW / Math.max(1, Math.round(cW / 12))));
      pts.push({ x: cluster.cx, y: cluster.minY - 10, isJump: true, revealColX: cluster.minX, revealColW: 1, revealColY1: cluster.minY, revealColY2: cluster.minY });
      for (let cx2 = cluster.minX; cx2 <= cluster.maxX; cx2 += COL_W) {
        const cxLocal = cx2 - cb.x;
        let topY = -1, botY = -1;
        for (let y2 = 0; y2 < cb.h; y2++)
          for (let dx = 0; dx < COL_W; dx++) {
            const lx = cxLocal + dx; if (lx < 0 || lx >= W) continue;
            if (map[y2 * W + lx]) { if (topY < 0) topY = cb.y + y2; botY = cb.y + y2; }
          }
        if (topY < 0) continue;
        const midX = cx2 + COL_W * 0.5;
        const dist = botY - topY;
        const steps = Math.max(3, Math.floor(dist / 3));
        pts.push({ x: midX, y: topY - 6, isJump: true, revealColX: cx2, revealColW: COL_W, revealColY1: topY, revealColY2: topY });
        for (let s = 0; s <= steps; s++) {
          const t = s / steps, ry = topY + dist * t;
          pts.push({ x: midX + (Math.random() - 0.5) * 4, y: ry, revealColX: cx2, revealColW: COL_W, revealColY1: topY, revealColY2: Math.min(ry, botY) });
        }
        pts.push({ x: midX, y: botY + 6, isJump: true, revealColX: cx2, revealColW: COL_W, revealColY1: topY, revealColY2: botY });
      }
    });
    return pts;
  }

  buildSpecTextOutlinePts(clusters, cb, map) {
    const W = cb.w, H = cb.h;
    const ocd = this.offscreen.getContext('2d').getImageData(cb.x, cb.y, W, H).data;
    let darkest = 766, dR = 20, dG = 20, dB = 20;
    for (let i = 0; i < W * H; i += Math.max(1, Math.floor(W * H / 400))) {
      if (!map[i]) continue;
      const i4 = i * 4, r = ocd[i4], g = ocd[i4 + 1], b = ocd[i4 + 2], a = ocd[i4 + 3];
      if (a > 80 && r + g + b < darkest) { darkest = r + g + b; dR = r; dG = g; dB = b; }
    }
    const autoColor = darkest > 550 ? '#111' : `rgb(${Math.max(0, dR - 20)},${Math.max(0, dG - 20)},${Math.max(0, dB - 20)})`;
    const thickness = 2 * (this.resScale());
    const pts = [];
    clusters.forEach(cluster => {
      const raw = [];
      for (let x = cluster.minX; x <= cluster.maxX; x++) { for (let y = cluster.minY; y <= cluster.maxY; y++) { if (map[(y - cb.y) * W + (x - cb.x)]) { raw.push({ x, y }); break; } } }
      for (let y = cluster.minY; y <= cluster.maxY; y++) { for (let x = cluster.maxX; x >= cluster.minX; x--) { if (map[(y - cb.y) * W + (x - cb.x)]) { raw.push({ x, y }); break; } } }
      for (let x = cluster.maxX; x >= cluster.minX; x--) { for (let y = cluster.maxY; y >= cluster.minY; y--) { if (map[(y - cb.y) * W + (x - cb.x)]) { raw.push({ x, y }); break; } } }
      for (let y = cluster.maxY; y >= cluster.minY; y--) { for (let x = cluster.minX; x <= cluster.maxX; x++) { if (map[(y - cb.y) * W + (x - cb.x)]) { raw.push({ x, y }); break; } } }
      const pStride = Math.max(1, Math.floor(raw.length / 70));
      raw.filter((_, i) => i % pStride === 0).forEach(p => pts.push(p));
    });
    return { pts, color: autoColor, thickness };
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
    ctx.beginPath();
    ctx.moveTo(pts[fromIdx].x, pts[fromIdx].y);
    for (let i = fromIdx + 1; i <= toIdx; i++) {
      const p = pts[i], prev = pts[i - 1];
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (p.isJump || dist > JUMP) {
        ctx.stroke(); ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

module.exports = SpecText;
