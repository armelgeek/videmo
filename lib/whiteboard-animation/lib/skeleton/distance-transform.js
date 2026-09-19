/**
 * 2-Pass Chamfer 3-4 Distance Transform in pure JS.
 * Returns local stroke radius in pixels for each pixel.
 * Chamfer weights: 3 for orthogonal, 4 for diagonal. Divisor is 3.
 */

const INF = 1e7;

/**
 * Computes the distance of each foreground pixel to the nearest background pixel.
 * @param {Uint8Array} mask - Binary mask (0 = background, 1 = foreground)
 * @param {number} width - Width of the mask
 * @param {number} height - Height of the mask
 * @returns {Float32Array} Local radius in pixels for each pixel
 */
function distanceTransformChamfer(mask, width, height) {
  const W = width;
  const H = height;
  const rawDist = new Int32Array(W * H);

  // Initialize: 0 for background, INF for foreground
  for (let i = 0; i < W * H; i++) {
    rawDist[i] = mask[i] ? INF : 0;
  }

  // Forward pass: top-to-bottom, left-to-right
  for (let y = 0; y < H; y++) {
    const yw = y * W;
    for (let x = 0; x < W; x++) {
      const idx = yw + x;
      if (rawDist[idx] === 0) continue;

      let d = rawDist[idx];
      if (x > 0) d = Math.min(d, rawDist[idx - 1] + 3);
      if (y > 0) {
        d = Math.min(d, rawDist[idx - W] + 3);
        if (x > 0) d = Math.min(d, rawDist[idx - W - 1] + 4);
        if (x < W - 1) d = Math.min(d, rawDist[idx - W + 1] + 4);
      }
      rawDist[idx] = d;
    }
  }

  // Backward pass: bottom-to-top, right-to-left
  for (let y = H - 1; y >= 0; y--) {
    const yw = y * W;
    for (let x = W - 1; x >= 0; x--) {
      const idx = yw + x;
      if (rawDist[idx] === 0) continue;

      let d = rawDist[idx];
      if (x < W - 1) d = Math.min(d, rawDist[idx + 1] + 3);
      if (y < H - 1) {
        d = Math.min(d, rawDist[idx + W] + 3);
        if (x < W - 1) d = Math.min(d, rawDist[idx + W + 1] + 4);
        if (x > 0) d = Math.min(d, rawDist[idx + W - 1] + 4);
      }
      rawDist[idx] = d;
    }
  }

  // Convert raw Chamfer distance (weight 3 = 1px) to float pixel radius
  const radius = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (mask[i]) {
      radius[i] = Math.max(1.0, rawDist[i] / 3.0);
    }
  }

  return radius;
}

module.exports = { distanceTransformChamfer };
