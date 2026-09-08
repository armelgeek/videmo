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
 * Cote vise d'une tuile, en pixels de canvas.
 *
 * Le rayon du trait derive de la taille des tuiles
 * (strokeR = min(tileW, tileH) * 0.18), et la taille des tuiles derivait
 * elle-meme d'un NOMBRE fixe. Les regions n'ayant pas la meme taille, le stylo
 * changeait d'epaisseur d'une region a l'autre : rayon 6 sur l'etiquette contre
 * 12 sur le sac, dans le meme dessin. En visant une taille de tuile constante
 * plutot qu'un nombre constant, le rayon vaut 9 partout.
 *
 * 52 est calibre sur la scene de reference : c'est la valeur qui rend le rayon
 * identique sur ses quatre regions, et elle tombe au milieu de ce que donnait
 * l'ancien reglage par defaut (30 tuiles).
 */
const COTE_TUILE_PX = 52;

/** Nombre de tuiles a demander pour que celles-ci fassent ~COTE_TUILE_PX. */
function tuilesPourRegion(cb) {
  const aire = Math.max(1, cb.w) * Math.max(1, cb.h);
  return Math.max(4, Math.min(400, Math.round(aire / (COTE_TUILE_PX * COTE_TUILE_PX))));
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
 * `box` dit ou le canvas du groupe se pose dans le canvas principal. Sans lui,
 * la source est supposee pleine page — c'etait le cas quand chaque groupe de
 * couleur s'offrait un canvas de la taille de la scene. Avec lui, seule
 * l'intersection entre la bande devoilee et ce cadre est copiee.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas cible
 * @param {HTMLCanvasElement} srcCanvas - Canvas du groupe de couleur
 * @param {object} cb - Bornes du contenu {x, y, w, h}
 * @param {number} revealH - Hauteur devoilee, depuis cb.y
 * @param {object} [box] - Cadre du canvas source {x, y, w, h}
 */
function wcFill(ctx, srcCanvas, cb, revealH, box) {
  if (revealH <= 0) return;
  if (!box) {
    ctx.drawImage(srcCanvas, cb.x, cb.y, cb.w, revealH, cb.x, cb.y, cb.w, revealH);
    return;
  }
  const haut = Math.max(box.y, cb.y);
  const bas = Math.min(box.y + box.h, cb.y + revealH);
  if (bas <= haut) return;
  ctx.drawImage(
    srcCanvas,
    0, haut - box.y, box.w, bas - haut,
    box.x, haut, box.w, bas - haut
  );
}

/**
 * Decoupe un groupe de couleur dans l'image source, au format de son propre
 * cadre plutot qu'en pleine page.
 *
 * Un groupe n'occupe qu'une fraction de la scene, mais recevait un canvas de
 * la taille de celle-ci : a 1920x1080 c'est 8 Mo par couleur, reserves a
 * chaque entree de region — et setup() est rejoue par annotation. Renseigne
 * `grp.preCanvas` et `grp.box`, que wcFill sait replacer.
 *
 * @param {object} grp - Groupe portant `pixels` (coordonnees du canvas)
 * @param {ImageData} srcFull - Image source pleine page
 * @param {number} canvasW - Largeur du canvas principal
 * @param {function} creerCanvas - Fabrique de canvas (w, h)
 */
function decouperGroupeCouleur(grp, srcFull, canvasW, creerCanvas) {
  let bx = Infinity, by = Infinity, bx2 = -Infinity, by2 = -Infinity;
  for (let i = 0; i < grp.pixels.length; i++) {
    const p = grp.pixels[i];
    if (p.x < bx) bx = p.x;
    if (p.x > bx2) bx2 = p.x;
    if (p.y < by) by = p.y;
    if (p.y > by2) by2 = p.y;
  }
  const bw = Math.max(1, bx2 - bx + 1);
  const bh = Math.max(1, by2 - by + 1);

  const c = creerCanvas(bw, bh);
  const cc = c.getContext('2d');
  const imgd = cc.createImageData(bw, bh);
  for (let i = 0; i < grp.pixels.length; i++) {
    const p = grp.pixels[i];
    const si = (p.y * canvasW + p.x) * 4;
    const di = ((p.y - by) * bw + (p.x - bx)) * 4;
    imgd.data[di] = srcFull.data[si];
    imgd.data[di + 1] = srcFull.data[si + 1];
    imgd.data[di + 2] = srcFull.data[si + 2];
    imgd.data[di + 3] = srcFull.data[si + 3];
  }
  cc.putImageData(imgd, 0, 0);

  grp.box = { x: bx, y: by, w: bw, h: bh };
  return c;
}

/**
 * Waypoints de la main pour un groupe : un point par ligne, alternativement a
 * droite et a gauche de l'etendue de cette ligne.
 */
function waypointsGroupeCouleur(pixels) {
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
  buildTileWaypoints,
  tuilesPourRegion,
  COTE_TUILE_PX,
  strokePencil,
  watercolorizeCanvas,
  fillGapsCanvas,
  wcFill,
  decouperGroupeCouleur,
  waypointsGroupeCouleur
};
