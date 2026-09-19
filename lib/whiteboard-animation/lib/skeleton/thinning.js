/**
 * Zhang-Suen Thinning Algorithm in pure JS.
 * Operates on a binary Uint8Array (0 = background, 1 = foreground).
 *
 * @param {Uint8Array} mask - Binary mask array of size width * height (0 = background, 1 = foreground)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} [maxIterations=100] - Safety bound on iterations
 * @returns {Uint8Array} New Uint8Array of size width * height containing 1-pixel skeleton
 */
function thinZhangSuen(mask, width, height, maxIterations = 100) {
  const W = width, H = height;
  const skel = new Uint8Array(mask);
  if (W < 3 || H < 3) {
    return skel;
  }

  let changed = true;
  let iter = 0;

  // Neighbors lookup relative to (y * W + x)
  // P9 P2 P3
  // P8 P1 P4
  // P7 P6 P5
  const toDelete = [];

  while (changed && iter < maxIterations) {
    changed = false;
    iter++;

    // Sub-iteration 1
    toDelete.length = 0;
    for (let y = 1; y < H - 1; y++) {
      const yw = y * W;
      for (let x = 1; x < W - 1; x++) {
        const idx = yw + x;
        if (!skel[idx]) continue;

        const p2 = skel[idx - W];
        const p3 = skel[idx - W + 1];
        const p4 = skel[idx + 1];
        const p5 = skel[idx + W + 1];
        const p6 = skel[idx + W];
        const p7 = skel[idx + W - 1];
        const p8 = skel[idx - 1];
        const p9 = skel[idx - W - 1];

        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;

        let a = 0;
        if (!p2 && p3) a++;
        if (!p3 && p4) a++;
        if (!p4 && p5) a++;
        if (!p5 && p6) a++;
        if (!p6 && p7) a++;
        if (!p7 && p8) a++;
        if (!p8 && p9) a++;
        if (!p9 && p2) a++;
        if (a !== 1) continue;

        if (p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) {
          toDelete.push(idx);
        }
      }
    }
    if (toDelete.length > 0) {
      changed = true;
      for (let i = 0; i < toDelete.length; i++) skel[toDelete[i]] = 0;
    }

    // Sub-iteration 2
    toDelete.length = 0;
    for (let y = 1; y < H - 1; y++) {
      const yw = y * W;
      for (let x = 1; x < W - 1; x++) {
        const idx = yw + x;
        if (!skel[idx]) continue;

        const p2 = skel[idx - W];
        const p3 = skel[idx - W + 1];
        const p4 = skel[idx + 1];
        const p5 = skel[idx + W + 1];
        const p6 = skel[idx + W];
        const p7 = skel[idx + W - 1];
        const p8 = skel[idx - 1];
        const p9 = skel[idx - W - 1];

        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;

        let a = 0;
        if (!p2 && p3) a++;
        if (!p3 && p4) a++;
        if (!p4 && p5) a++;
        if (!p5 && p6) a++;
        if (!p6 && p7) a++;
        if (!p7 && p8) a++;
        if (!p8 && p9) a++;
        if (!p9 && p2) a++;
        if (a !== 1) continue;

        if (p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) {
          toDelete.push(idx);
        }
      }
    }
    if (toDelete.length > 0) {
      changed = true;
      for (let i = 0; i < toDelete.length; i++) skel[toDelete[i]] = 0;
    }
  }

  return skel;
}

module.exports = { thinZhangSuen };
