/**
 * Thins a stroke down to one pixel wide, without breaking it.
 *
 * WHY
 * Ink styles cut the drawing into segments with a raster scan: row by row, a
 * cut happens as soon as the next pixel is too far away. On an isolated
 * stroke that is enough, but as soon as two strokes cross — a grid, a cross,
 * a table — the scan no longer knows which one it follows: it takes pixels
 * from both, in row order, and the hand starts from the middle of the
 * crossing towards the edges instead of drawing each bar in one gesture.
 *
 * A crossing cannot be untangled on a thick stroke: at 3 pixels wide, every
 * pixel touches its eight neighbours and EVERYTHING looks like a junction.
 * The stroke must first be reduced to its axis. That is what this module
 * does; decomposer-traits.js then handles the untangling.
 *
 * HOW
 * Zhang-Suen: two sub-passes that remove edge pixels as long as that does
 * not break local connectivity nor shorten an endpoint. Repeat until a full
 * pass removes nothing. The two sub-passes bite on opposite edges, which
 * keeps the stroke from drifting to one side.
 *
 * The algorithm preserves topology: a ring stays a ring, two crossing
 * strokes still cross. That is exactly what the decomposition needs.
 */

'use strict';

/** The eight neighbours, clockwise from the top (P2..P9). */
const VOISINS = [
  [0, -1], [1, -1], [1, 0], [1, 1],
  [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/**
 * Number of 0 -> 1 transitions going around the neighbours.
 *
 * Equals exactly 1 when the pixel has a single group of connected
 * neighbours, i.e. when removing it cuts nothing.
 */
function transitions(v) {
  let n = 0;
  for (let i = 0; i < 8; i++) {
    if (v[i] === 0 && v[(i + 1) % 8] === 1) n++;
  }
  return n;
}

function neighboursOf(bits, W, H, x, y, out) {
  for (let i = 0; i < 8; i++) {
    const nx = x + VOISINS[i][0];
    const ny = y + VOISINS[i][1];
    out[i] = (nx < 0 || ny < 0 || nx >= W || ny >= H) ? 0 : bits[ny * W + nx];
  }
  return out;
}

/**
 * One sub-pass. Returns the number of pixels removed.
 *
 * Removals are collected then applied in bulk: removing while reading would
 * make a pixel's fate depend on those already processed in the same pass, and
 * the stroke would thin unevenly.
 */
function subPass(bits, W, H, second) {
  const v = new Uint8Array(8);
  const toRemove = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!bits[idx]) continue;

      neighboursOf(bits, W, H, x, y, v);
      let count = 0;
      for (let i = 0; i < 8; i++) count += v[i];
      // Fewer than 2 neighbours: it is an endpoint, removing it shortens the
      // stroke. More than 6: it is an interior pixel, not an edge.
      if (count < 2 || count > 6) continue;
      if (transitions(v) !== 1) continue;

      const [p2, p3, p4, p5, p6, p7, p8] = [v[0], v[1], v[2], v[3], v[4], v[5], v[6]];
      void p3; void p5; void p7;
      const a = second ? p2 * p4 * p8 : p2 * p4 * p6;
      const b = second ? p2 * p6 * p8 : p4 * p6 * p8;
      if (a === 0 && b === 0) toRemove.push(idx);
    }
  }

  for (let i = 0; i < toRemove.length; i++) bits[toRemove[i]] = 0;
  return toRemove.length;
}

/**
 * The skeleton of a binary image.
 *
 * @param {Uint8Array} bits  1 = ink, 0 = background, of length W*H
 * @param {number} W
 * @param {number} H
 * @param {number} maxPasses  safeguard: a noisy image can oscillate
 * @returns {Uint8Array} a NEW array, the input is not modified
 */
function squelettiser(bits, W, H, maxPasses = 60) {
  const out = Uint8Array.from(bits);
  for (let i = 0; i < maxPasses; i++) {
    const a = subPass(out, W, H, false);
    const b = subPass(out, W, H, true);
    if (a + b === 0) break;
  }
  return out;
}

module.exports = { squelettiser, transitions, VOISINS };
