/**
 * Brings an artwork's background to PURE white.
 *
 * Two defects, a single pass:
 *
 * 1. "Almost white" background (254,254,254): each revealed region laid down a
 *    grey rectangle, made worse by h264 banding. Threshold WHITE_THRESHOLD.
 *
 * 2. Tinted background: image models often render cream, light grey or a
 *    slight gradient despite the #FFFFFF instruction. presence-map counts every
 *    pixel under 240 as ink: the whole background became a shape to draw,
 *    swept or skeletonized by the styles.
 *
 * For (2) the background is estimated from the image edges (median profiles,
 * then a Coons patch to follow a gradient), and each pixel is divided by it,
 * like a document scanner: the background goes to 255, dark ink does not move,
 * antialiasing stays continuous. Nothing is touched if the edges are not a
 * solid background (photo, full-bleed frame) or if that background is dark (blackboard).
 */
const WHITE_THRESHOLD = 250;

// A background darker than this is intentional: dividing by it would invert the image.
const MIN_BACKGROUND = 170;
// Tolerated gap between an edge pixel and the estimated background (JPEG noise, grain).
const EDGE_TOLERANCE = 24;
// Share of edge pixels that must match the background for it to be corrected.
const SOLID_EDGE_RATIO = 0.7;
const PROFILE_POINTS = 48;
// Maximum gradient variation along an edge; beyond that it is ink.
const MAX_GRADIENT_DELTA = 40;

function median(values) {
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

/**
 * Edge profile: `n` control points, each the RGB median of a segment of the
 * band. The median ignores a stroke touching the edge.
 * `px(t, k)` returns the pixel index at position t (along the edge) and at
 * depth k into the band.
 */
function profile(d, length, thickness, px) {
  const n = Math.min(PROFILE_POINTS, length);
  // Wide window: a stroke leaving the frame must stay a minority in it.
  const half = Math.max(Math.ceil(length / n / 2), Math.round(length * 0.06));
  const pts = [];
  for (let s = 0; s < n; s++) {
    const center = Math.round(((s + 0.5) * length) / n);
    const t0 = Math.max(0, center - half);
    const t1 = Math.min(length, center + half + 1);
    const r = [], g = [], b = [];
    for (let t = t0; t < t1; t++) {
      for (let k = 0; k < thickness; k++) {
        const i = px(t, k);
        r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
      }
    }
    pts.push({ c: center, rgb: [median(r), median(g), median(b)] });
  }
  // A point very far from the typical edge is a stroke, not a gradient.
  const ref = [0, 1, 2].map((ch) => median(pts.map((p) => p.rgb[ch])));
  for (const p of pts) {
    if (Math.max(...p.rgb.map((v, ch) => Math.abs(v - ref[ch]))) > MAX_GRADIENT_DELTA) p.rgb = ref.slice();
  }
  const out = new Float32Array(length * 3);
  for (let t = 0, s = 0; t < length; t++) {
    while (s < pts.length - 2 && pts[s + 1].c < t) s++;
    const a = pts[s], z = pts[Math.min(s + 1, pts.length - 1)];
    const f = z.c > a.c ? Math.min(1, Math.max(0, (t - a.c) / (z.c - a.c))) : 0;
    for (let ch = 0; ch < 3; ch++) out[t * 3 + ch] = a.rgb[ch] + (z.rgb[ch] - a.rgb[ch]) * f;
  }
  return out;
}

/** Per-pixel estimated background, or null if the image has no light, solid background. */
function estimateBackground(d, W, H) {
  if (W < 8 || H < 8) return null;
  const ep = Math.max(1, Math.min(4, Math.round(Math.min(W, H) * 0.01)));
  const top = profile(d, W, ep, (x, k) => (k * W + x) * 4);
  const bottom = profile(d, W, ep, (x, k) => ((H - 1 - k) * W + x) * 4);
  const left = profile(d, H, ep, (y, k) => (y * W + k) * 4);
  const right = profile(d, H, ep, (y, k) => (y * W + (W - 1 - k)) * 4);

  let close = 0, total = 0;
  const minChannel = [];
  const check = (prof, length, px) => {
    for (let t = 0; t < length; t++) {
      const i = px(t);
      const e = Math.max(
        Math.abs(d[i] - prof[t * 3]),
        Math.abs(d[i + 1] - prof[t * 3 + 1]),
        Math.abs(d[i + 2] - prof[t * 3 + 2]),
      );
      if (e <= EDGE_TOLERANCE) close++;
      total++;
      minChannel.push(Math.min(prof[t * 3], prof[t * 3 + 1], prof[t * 3 + 2]));
    }
  };
  check(top, W, (x) => x * 4);
  check(bottom, W, (x) => ((H - 1) * W + x) * 4);
  check(left, H, (y) => y * W * 4);
  check(right, H, (y) => (y * W + W - 1) * 4);
  if (median(minChannel) < MIN_BACKGROUND || close / total < SOLID_EDGE_RATIO) return null;

  return { top, bottom, left, right, W, H };
}

/** Whitens an RGBA buffer in place. Pure: used by the browser, the worker and the server. */
function whitenPixels(d, W, H) {
  const background = estimateBackground(d, W, H);
  if (background) {
    const { top, bottom, left, right } = background;
    const c00 = [0, 1, 2].map((ch) => (top[ch] + left[ch]) / 2);
    const c10 = [0, 1, 2].map((ch) => (top[(W - 1) * 3 + ch] + right[ch]) / 2);
    const c01 = [0, 1, 2].map((ch) => (bottom[ch] + left[(H - 1) * 3 + ch]) / 2);
    const c11 = [0, 1, 2].map((ch) => (bottom[(W - 1) * 3 + ch] + right[(H - 1) * 3 + ch]) / 2);
    for (let y = 0; y < H; y++) {
      const v = H > 1 ? y / (H - 1) : 0;
      for (let x = 0; x < W; x++) {
        const u = W > 1 ? x / (W - 1) : 0;
        const i = (y * W + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const f =
            (1 - v) * top[x * 3 + ch] + v * bottom[x * 3 + ch] +
            (1 - u) * left[y * 3 + ch] + u * right[y * 3 + ch] -
            ((1 - u) * (1 - v) * c00[ch] + u * (1 - v) * c10[ch] + (1 - u) * v * c01[ch] + u * v * c11[ch]);
          d[i + ch] = Math.min(255, Math.round((d[i + ch] * 255) / Math.max(1, f)));
        }
      }
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= WHITE_THRESHOLD && d[i + 1] >= WHITE_THRESHOLD && d[i + 2] >= WHITE_THRESHOLD) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
    }
  }
  return !!background;
}

/**
 * Whitens in place the content already drawn in `ctx`, limited to `rect` (the
 * artwork rectangle: letterbox bars would skew the estimate).
 *
 * No effect if the canvas is tainted by a cross-origin image: this pass is
 * cosmetic, it must never break a render.
 */
function whitenBackground(ctx, width, height, rect) {
  const x = rect ? Math.max(0, Math.round(rect.x)) : 0;
  const y = rect ? Math.max(0, Math.round(rect.y)) : 0;
  const w = rect ? Math.min(width - x, Math.round(rect.w)) : width;
  const h = rect ? Math.min(height - y, Math.round(rect.h)) : height;
  if (w <= 0 || h <= 0) return;

  let image;
  try {
    image = ctx.getImageData(x, y, w, h);
  } catch (_) {
    return;
  }
  whitenPixels(image.data, w, h);
  ctx.putImageData(image, x, y);
}

module.exports = { whitenBackground, whitenPixels, WHITE_THRESHOLD };
