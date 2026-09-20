/**
 * Untangles a line drawing into gestures, one per marker stroke.
 *
 * WHY
 * Ink styles used to split the drawing by raster scanning: line by line,
 * cutting as soon as the next pixel was too far. On a grid, the scan line
 * crosses every vertical bar and yields one segment per bar and per row —
 * thousands of crumbs, which nearest-neighbour chaining then glues back in an
 * order that looks nothing like a gesture. The hand starts from the middle of
 * a crossing and spreads toward the edges, instead of drawing each bar in one
 * stroke.
 *
 * HOW
 * On a skeleton (see squelette.js), each ink pixel has a degree: 1 for a
 * stroke end, 2 for a pass-through, 3 or more for a junction. We start from
 * the ends — that is where a hand puts the marker down — and follow each edge
 * exactly once.
 *
 * THE RULE THAT MATTERS
 * At a junction, we keep going STRAIGHT: among the free branches, we take the
 * one that deviates least from the incoming direction. That is what makes a
 * cross read as two bars crossing, not as four stubs leaving the centre.
 * Without this rule, the path turns at a right angle at the first crossing
 * and the drawing falls apart.
 *
 * Closed loops have no end: they are picked up afterwards, from any pixel,
 * otherwise a circle would never be drawn.
 */

'use strict';

const { VOISINS } = require('./squelette');

/** Opposite direction, in VOISINS order. */
const OPPOSITE = [4, 5, 6, 7, 0, 1, 2, 3];

/** Length of each step: diagonals are longer. */
const NORM = VOISINS.map(([dx, dy]) => Math.hypot(dx, dy));

function buildDegrees(bits, W, H) {
  const degree = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!bits[idx]) continue;
      let d = 0;
      for (let i = 0; i < 8; i++) {
        const nx = x + VOISINS[i][0];
        const ny = y + VOISINS[i][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (bits[ny * W + nx]) d++;
      }
      degree[idx] = d;
    }
  }
  return degree;
}

/**
 * Follows a stroke from (x, y), starting in direction `dir0`.
 *
 * `seen` holds one bit per direction and per pixel: a traversed edge is
 * marked on both sides, so it is never taken again, whatever the direction.
 */
function follow(bits, seen, W, H, x, y, dir0) {
  const stroke = [{ x, y }];
  let cx = x;
  let cy = y;
  let dir = dir0;

  for (;;) {
    const idx = cy * W + cx;
    if (seen[idx] & (1 << dir)) break;

    const nx = cx + VOISINS[dir][0];
    const ny = cy + VOISINS[dir][1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || !bits[ny * W + nx]) break;

    seen[idx] |= 1 << dir;
    seen[ny * W + nx] |= 1 << OPPOSITE[dir];
    stroke.push({ x: nx, y: ny });
    cx = nx;
    cy = ny;

    // Keep going as straight as possible: the dot product with the incoming
    // direction ranks the branches, and the best one wins.
    const ax = VOISINS[dir][0] / NORM[dir];
    const ay = VOISINS[dir][1] / NORM[dir];
    let best = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < 8; i++) {
      if (i === OPPOSITE[dir]) continue;
      const vx = cx + VOISINS[i][0];
      const vy = cy + VOISINS[i][1];
      if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
      if (!bits[vy * W + vx]) continue;
      if (seen[(cy * W + cx)] & (1 << i)) continue;
      const score = ax * (VOISINS[i][0] / NORM[i]) + ay * (VOISINS[i][1] / NORM[i]);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) break;
    dir = best;
  }

  return stroke;
}

/** The free directions around a pixel, in VOISINS order. */
function freeBranches(bits, seen, W, H, x, y) {
  const free = [];
  for (let i = 0; i < 8; i++) {
    const nx = x + VOISINS[i][0];
    const ny = y + VOISINS[i][1];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (!bits[ny * W + nx]) continue;
    if (seen[y * W + x] & (1 << i)) continue;
    free.push(i);
  }
  return free;
}

/**
 * Decomposes a skeleton into strokes.
 *
 * @param {Uint8Array} bits  skeleton, 1 = ink
 * @param {number} W
 * @param {number} H
 * @param {number} minLength  shorter crumbs are dropped
 * @returns {{x:number,y:number}[][]} an array of strokes
 */
function decomposeStrokes(bits, W, H, minLength = 2) {
  const degree = buildDegrees(bits, W, H);
  const seen = new Uint8Array(W * H);
  const strokes = [];

  const harvest = (x, y) => {
    for (const dir of freeBranches(bits, seen, W, H, x, y)) {
      const stroke = follow(bits, seen, W, H, x, y, dir);
      if (stroke.length >= minLength) strokes.push(stroke);
    }
  };

  // Ends first: that is where a stroke really begins.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (bits[idx] && degree[idx] === 1) harvest(x, y);
    }
  }

  // Then junctions: what remains between two crossings.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (bits[idx] && degree[idx] >= 3) harvest(x, y);
    }
  }

  // Finally closed loops, which have neither end nor junction.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (bits[idx] && degree[idx] === 2) harvest(x, y);
    }
  }

  return strokes;
}

module.exports = { decomposeStrokes, buildDegrees };
