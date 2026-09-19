/**
 * Gesture's first-pass sketch: 6px blur, 0.3 saturation, ink faded to 70%,
 * 72% opacity.
 *
 * Computed on pixels rather than through ctx.filter: node-canvas accepts the
 * property but ignores it, so the server export showed the sharp image where
 * the preview showed the sketch. Saturation and fade are affine and the blur is
 * linear, so the order of operations does not change the result.
 */

// Three box blurs of radius 6 approximate a gaussian with a standard deviation of 6.
const RADIUS = 6;
const PASSES = 3;

function boxBlur(src, dst, W, H, r, horizontal) {
  const n = horizontal ? W : H;
  const lines = horizontal ? H : W;
  const stride = horizontal ? 4 : W * 4;
  const width = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * W * 4 : l * 4;
    for (let ch = 0; ch < 4; ch++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[base + Math.min(n - 1, Math.max(0, k)) * stride + ch];
      for (let t = 0; t < n; t++) {
        dst[base + t * stride + ch] = sum / width;
        const out = Math.max(0, t - r);
        const inn = Math.min(n - 1, t + r + 1);
        sum += src[base + inn * stride + ch] - src[base + out * stride + ch];
      }
    }
  }
}

function sketchPixels(d, W, H) {
  let a = Float32Array.from(d);
  let b = new Float32Array(d.length);
  for (let p = 0; p < PASSES; p++) {
    boxBlur(a, b, W, H, RADIUS, true);
    boxBlur(b, a, W, H, RADIUS, false);
  }

  // saturate(0.3): CSS Filter Effects matrix. The fade pivots on white rather
  // than mid-grey like contrast(): the paper has to stay white, otherwise the
  // first pass lays a grey veil over the whole region.
  const s = 0.3;
  const m = [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
  ];
  const fade = 0.7;
  for (let i = 0; i < d.length; i += 4) {
    const r = a[i], g = a[i + 1], bl = a[i + 2];
    for (let ch = 0; ch < 3; ch++) {
      const v = m[ch * 3] * r + m[ch * 3 + 1] * g + m[ch * 3 + 2] * bl;
      d[i + ch] = Math.max(0, Math.min(255, Math.round(255 - (255 - v) * fade)));
    }
    d[i + 3] = Math.round(a[i + 3] * 0.72);
  }
}

/** Draws the sketch of `source` into `ctx` (same size). */
function drawSketch(ctx, source, W, H) {
  const sc = source.getContext('2d', { willReadFrequently: true });
  let image;
  try {
    image = sc.getImageData(0, 0, W, H);
  } catch (_) {
    ctx.globalAlpha = 0.72;
    ctx.drawImage(source, 0, 0);
    ctx.globalAlpha = 1;
    return;
  }
  sketchPixels(image.data, W, H);
  ctx.putImageData(image, 0, 0);
}

module.exports = { drawSketch, sketchPixels };
