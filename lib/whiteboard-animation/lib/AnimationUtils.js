/**
 * Shared animation utilities used by multiple animation styles.
 */

/**
 * Build tile-based waypoints for chunk-fill animations.
 * Divides content into N organic tiles, generates dense zigzag waypoints.
 *
 * @param {object} animationInstance - The Animation instance (has buildPresenceMap, state, etc.)
 * @param {number} numTiles - Target number of tiles
 * @param {function} orderFn - Function to order tiles: (tiles, cb) => orderedTiles[]
 * @returns {object} { pts: waypoint[], strokeR: number }
 */
/**
 * Target side of a tile, in canvas pixels.
 *
 * The stroke radius derives from the tile size
 * (strokeR = min(tileW, tileH) * 0.18), and the tile size itself used to derive
 * from a fixed COUNT. Since regions differ in size, the pen changed thickness
 * from one region to the next: radius 6 on the label versus 12 on the bag, in
 * the same drawing. Targeting a constant tile size rather than a constant
 * count gives radius 9 everywhere.
 *
 * 52 is calibrated on the reference scene: it is the value that makes the
 * radius identical across its four regions, and it falls in the middle of what
 * the old default setting (30 tiles) produced.
 */
const TILE_SIDE_PX = 52;

/** Number of tiles to request so that they measure ~TILE_SIDE_PX. */
function tuilesPourRegion(cb) {
  const area = Math.max(1, cb.w) * Math.max(1, cb.h);
  return Math.max(4, Math.min(400, Math.round(area / (TILE_SIDE_PX * TILE_SIDE_PX))));
}

/**
 * Reveals one pen tip: a disc of `source` copied onto `rc`.
 *
 * Only the square around the disc is copied. Drawing the whole sheet under the
 * clip gave the same pixels but made the browser composite 1280×720 for every
 * stroke point — thousands per region, replayed in full at each scene handover.
 */
function revealDisc(rc, source, x, y, r) {
  rc.save();
  rc.beginPath();
  rc.arc(x, y, r, 0, Math.PI * 2);
  rc.clip();
  const w = source.width, h = source.height;
  if (w > 0 && h > 0) {
    const sx = Math.max(0, Math.floor(x - r - 1));
    const sy = Math.max(0, Math.floor(y - r - 1));
    const ex = Math.min(w, Math.ceil(x + r + 1));
    const ey = Math.min(h, Math.ceil(y + r + 1));
    if (ex > sx && ey > sy) rc.drawImage(source, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
  } else {
    rc.drawImage(source, 0, 0);
  }
  rc.restore();
}

function buildTileWaypoints(animationInstance, numTiles, orderFn) {
  const state = animationInstance.state;
  const cb = state.contentBounds;
  const map = animationInstance.buildPresenceMap();
  const W = cb.w, H = cb.h;

  // Determine tile grid dimensions
  const aspect = W / H;
  const cols = Math.max(2, Math.round(Math.sqrt(numTiles * aspect)));
  const rows = Math.max(2, Math.round(numTiles / cols));
  const tileW = W / cols;
  const tileH = H / rows;

  // Build tile objects
  const tiles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tx = Math.floor(col * tileW);
      const ty = Math.floor(row * tileH);
      const tw = Math.ceil(tileW) + 1;
      const th = Math.ceil(tileH) + 1;

      let hasContent = false;
      outer: for (let y = ty; y < Math.min(ty + th, H); y++) {
        for (let x = tx; x < Math.min(tx + tw, W); x++) {
          if (map[y * W + x]) { hasContent = true; break outer; }
        }
      }
      if (!hasContent) continue;

      tiles.push({
        col, row, tx, ty, tw, th,
        cx: cb.x + tx + tileW / 2,
        cy: cb.y + ty + tileH / 2
      });
    }
  }

  // Let caller order the tiles
  const ordered = orderFn(tiles, cb);

  // Build waypoints
  const strokeR = Math.max(5, Math.round(Math.min(tileW, tileH) * 0.18));
  const rowStep = Math.max(3, Math.round(strokeR * 1.1));
  const pts = [];

  for (const tile of ordered) {
    const localPts = [];
    let dir = Math.random() < 0.5 ? 1 : -1;
    const angle = (Math.random() - 0.5) * 0.3;
    const cosA = Math.cos(angle), sinA = Math.sin(angle);

    for (let ry = 0; ry < tile.th; ry += rowStep) {
      let lx = tile.tw, rx = 0;
      for (let dy = 0; dy < rowStep; dy++) {
        const py = tile.ty + ry + dy;
        if (py >= H) continue;
        for (let x = 0; x < tile.tw; x++) {
          const px = tile.tx + x;
          if (px >= W) continue;
          if (map[py * W + px]) {
            lx = Math.min(lx, x);
            rx = Math.max(rx, x);
          }
        }
      }
      if (lx > rx) { dir *= -1; continue; }

      const overshoot = strokeR * 0.4;
      const x1 = (dir > 0 ? lx - overshoot : rx + overshoot);
      const x2 = (dir > 0 ? rx + overshoot : lx - overshoot);
      const baseY = ry + rowStep * 0.5;
      const segs = Math.max(3, Math.ceil(Math.abs(rx - lx) / Math.max(strokeR * 0.8, 3)));

      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const lx2 = x1 + (x2 - x1) * t;
        const ly = baseY + Math.sin(t * Math.PI * 2) * 1.5 + (Math.random() - 0.5) * 1.5;
        const dx = lx2 - tileW / 2, dy2 = ly - tileH / 2;
        const rx2 = dx * cosA - dy2 * sinA + tileW / 2;
        const ry2 = dx * sinA + dy2 * cosA + tileH / 2;

        localPts.push({
          x: cb.x + tile.tx + rx2 + (Math.random() - 0.5) * 1.5,
          y: cb.y + tile.ty + ry2 + (Math.random() - 0.5) * 1.5,
          strokeR
        });
      }
      if (localPts.length) localPts.push({...localPts[localPts.length - 1], isLift: true});
      dir *= -1;
    }

    if (!localPts.length) continue;
    localPts[localPts.length - 1] = {
      ...localPts[localPts.length - 1],
      isLift: false,
      isJump: true
    };
    pts.push(...localPts);
  }

  return { pts, strokeR };
}

/**
 * Draw a pencil stroke through a series of points with pen-lift handling.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} pts - Array of {x, y} points
 * @param {number} startIdx - Start index
 * @param {number} endIdx - End index
 * @param {string} color - Stroke color
 * @param {number} thickness - Line thickness
 * @param {number} jumpThreshold - Distance threshold to lift pen
 */
function strokePencil(ctx, pts, startIdx, endIdx, color, thickness, jumpThreshold = 8) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = startIdx; i <= endIdx; i++) {
    const p = pts[i];
    if (i === startIdx) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    } else {
      const prev = pts[i - 1];
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (dist > jumpThreshold) {
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
  }
  ctx.stroke();
}

/**
 * Watercolor fill variant (blurs/softens edges).
 * For now, just a simple blit. Real implementation would apply blur.
 */
function watercolorizeCanvas(canvas) {
  // ponytail: simplified — real version applies Gaussian blur
  return canvas;
}

/**
 * Fill gaps in a sparse canvas by expanding strokes.
 * For now, just a simple blit. Real implementation would dilate.
 */
function fillGapsCanvas(canvas) {
  // ponytail: simplified — real version dilates sparse regions
  return canvas;
}

/**
 * Watercolor fill: blit a color group canvas to main canvas up to a reveal line.
 *
 * `box` says where the group's canvas sits in the main canvas. Without it,
 * the source is assumed full-page — which was the case when each color group
 * got a canvas the size of the scene. With it, only the intersection between
 * the revealed band and that frame is copied.
 *
 * @param {CanvasRenderingContext2D} ctx - Target canvas
 * @param {HTMLCanvasElement} srcCanvas - Color group canvas
 * @param {object} cb - Content bounds {x, y, w, h}
 * @param {number} revealH - Revealed height, from cb.y
 * @param {object} [box] - Source canvas frame {x, y, w, h}
 */
function wcFill(ctx, srcCanvas, cb, revealH, box) {
  if (revealH <= 0) return;
  if (!box) {
    ctx.drawImage(srcCanvas, cb.x, cb.y, cb.w, revealH, cb.x, cb.y, cb.w, revealH);
    return;
  }
  const top = Math.max(box.y, cb.y);
  const bottom = Math.min(box.y + box.h, cb.y + revealH);
  if (bottom <= top) return;
  ctx.drawImage(
    srcCanvas,
    0, top - box.y, box.w, bottom - top,
    box.x, top, box.w, bottom - top
  );
}

/**
 * Cuts a color group out of the source image, sized to its own frame rather
 * than full-page.
 *
 * A group only covers a fraction of the scene, but used to get a canvas the
 * size of it: at 1920x1080 that is 8 MB per color, allocated on every region
 * entry — and setup() is replayed per annotation. Fills in `grp.preCanvas`
 * and `grp.box`, which wcFill knows how to place back.
 *
 * @param {object} grp - Group carrying `pixels` (canvas coordinates)
 * @param {ImageData} srcFull - Full-page source image
 * @param {number} canvasW - Main canvas width
 * @param {function} createCanvas - Canvas factory (w, h)
 */
function decouperGroupeCouleur(grp, srcFull, canvasW, createCanvas) {
  // `pixels`: {x, y} objects, or (y * canvasW + x) indices in a typed array.
  const px = grp.pixels;
  if (ArrayBuffer.isView(px)) return cropIndices(grp, srcFull, canvasW, createCanvas);
  let bx = Infinity, by = Infinity, bx2 = -Infinity, by2 = -Infinity;
  for (let i = 0; i < px.length; i++) {
    const { x, y } = px[i];
    if (x < bx) bx = x;
    if (x > bx2) bx2 = x;
    if (y < by) by = y;
    if (y > by2) by2 = y;
  }
  const bw = Math.max(1, bx2 - bx + 1);
  const bh = Math.max(1, by2 - by + 1);

  const c = createCanvas(bw, bh);
  const cc = c.getContext('2d');
  const imgd = cc.createImageData(bw, bh);
  for (let i = 0; i < px.length; i++) {
    const { x, y } = px[i];
    const si = (y * canvasW + x) * 4;
    const di = ((y - by) * bw + (x - bx)) * 4;
    imgd.data[di] = srcFull.data[si];
    imgd.data[di + 1] = srcFull.data[si + 1];
    imgd.data[di + 2] = srcFull.data[si + 2];
    imgd.data[di + 3] = srcFull.data[si + 3];
  }
  cc.putImageData(imgd, 0, 0);

  grp.box = { x: bx, y: by, w: bw, h: bh };
  return c;
}

/** decouperGroupeCouleur for indices in scan order (see grouperCouleurs). */
function cropIndices(grp, srcFull, canvasW, createCanvas) {
  const px = grp.pixels;
  if (px.length === 0) {
    grp.box = { x: 0, y: 0, w: 1, h: 1 };
    return createCanvas(1, 1);
  }
  const by = (px[0] / canvasW) | 0;
  const by2 = (px[px.length - 1] / canvasW) | 0;
  let bx = canvasW, bx2 = -1;
  for (let i = 0; i < px.length; i++) {
    const x = px[i] % canvasW;
    if (x < bx) bx = x;
    if (x > bx2) bx2 = x;
  }
  const bw = bx2 - bx + 1;
  const bh = by2 - by + 1;

  const c = createCanvas(bw, bh);
  const cc = c.getContext('2d');
  const imgd = cc.createImageData(bw, bh);
  const src = srcFull.data, dst = imgd.data;
  const origin = by * canvasW + bx;
  for (let i = 0; i < px.length; i++) {
    const idx = px[i];
    const rel = idx - origin;
    const y = Math.floor(rel / canvasW);
    const di = (y * bw + (rel - y * canvasW)) * 4;
    const si = idx * 4;
    dst[di] = src[si];
    dst[di + 1] = src[si + 1];
    dst[di + 2] = src[si + 2];
    dst[di + 3] = src[si + 3];
  }
  cc.putImageData(imgd, 0, 0);

  grp.box = { x: bx, y: by, w: bw, h: bh };
  return c;
}

/**
 * Groups a region's visible pixels by quantized color (step of 40).
 *
 * Integer keys and (y * canvasW + x) indices in an Int32Array: the version
 * with string keys and an {x, y} object per pixel cost 100 to 200 ms on every
 * region entry, a visible freeze when moving from one annotation to the next.
 *
 * Groups below `minPx` are merged into `small`, in scan order. Kept groups
 * are sorted from lightest to darkest, ties in the order their color first
 * appears. `sansPixels` returns only the colors.
 *
 * @param {Uint8ClampedArray} ocd - RGBA pixels of the region (cb.w x cb.h)
 * @param {object} cb - Region {x, y, w, h} in the canvas
 * @param {number} canvasW - Main canvas width
 * @param {number} minPx - Minimum size of a kept group
 * @param {Uint8Array} [exclu] - Region pixels to ignore
 */
function grouperCouleurs(ocd, cb, canvasW, minPx, { exclu = null, sansPixels = false } = {}) {
  const W = cb.w, H = cb.h;
  const Q = 40, LV = Math.round(255 / Q) + 1, NONE = 0xffff;
  const keys = new Uint16Array(W * H);
  const counts = new Uint32Array(LV * LV * LV);
  const order = [];
  for (let p = 0, i4 = 0; p < keys.length; p++, i4 += 4) {
    if (ocd[i4 + 3] < 20 || (exclu && exclu[p])) { keys[p] = NONE; continue; }
    const k = (Math.round(ocd[i4] / Q) * LV + Math.round(ocd[i4 + 1] / Q)) * LV + Math.round(ocd[i4 + 2] / Q);
    keys[p] = k;
    if (counts[k]++ === 0) order.push(k);
  }

  const slots = new Array(counts.length);
  const groups = [];
  let smallCount = 0;
  for (const k of order) {
    if (counts[k] < minPx) { smallCount += counts[k]; continue; }
    const grp = {
      r: Math.floor(k / (LV * LV)) * Q, g: (Math.floor(k / LV) % LV) * Q, b: (k % LV) * Q,
      pixels: sansPixels ? null : new Int32Array(counts[k]),
    };
    slots[k] = { grp, fill: 0 };
    groups.push(grp);
  }
  groups.sort((a, b) => (0.299 * b.r + 0.587 * b.g + 0.114 * b.b) - (0.299 * a.r + 0.587 * a.g + 0.114 * a.b));
  if (sansPixels) return { groups, small: new Int32Array(0), smallCount };

  const small = new Int32Array(smallCount);
  let sf = 0;
  for (let y = 0; y < H; y++) {
    const row = (cb.y + y) * canvasW + cb.x;
    for (let x = 0; x < W; x++) {
      const k = keys[y * W + x];
      if (k === NONE) continue;
      const slot = slots[k];
      if (slot) slot.grp.pixels[slot.fill++] = row + x;
      else small[sf++] = row + x;
    }
  }
  return { groups, small, smallCount };
}

/**
 * Hand waypoints for a group: one point per row, alternately at the right and
 * left of that row's extent.
 */
function waypointsGroupeCouleur(pixels, canvasW) {
  if (ArrayBuffer.isView(pixels)) {
    // Indices in scan order: rows already arrive sorted.
    const waypoints = [];
    let wdir = 1;
    for (let i = 0; i < pixels.length;) {
      const y = (pixels[i] / canvasW) | 0;
      let minX = pixels[i] % canvasW, maxX = minX;
      for (; i < pixels.length && ((pixels[i] / canvasW) | 0) === y; i++) {
        const x = pixels[i] % canvasW;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      waypoints.push({ x: wdir > 0 ? maxX : minX, y });
      wdir *= -1;
    }
    return waypoints;
  }
  const rows = new Map();
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    const r = rows.get(p.y);
    if (!r) rows.set(p.y, { minX: p.x, maxX: p.x });
    else {
      if (p.x < r.minX) r.minX = p.x;
      if (p.x > r.maxX) r.maxX = p.x;
    }
  }
  const waypoints = [];
  let wdir = 1;
  [...rows.entries()].sort((a, b) => a[0] - b[0]).forEach(([y, r]) => {
    waypoints.push({ x: wdir > 0 ? r.maxX : r.minX, y });
    wdir *= -1;
  });
  return waypoints;
}

module.exports = {
  revealDisc,
  buildTileWaypoints,
  tuilesPourRegion,
  TILE_SIDE_PX,
  strokePencil,
  watercolorizeCanvas,
  fillGapsCanvas,
  wcFill,
  decouperGroupeCouleur,
  waypointsGroupeCouleur,
  grouperCouleurs
};
