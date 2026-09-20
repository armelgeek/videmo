/**
 * Orders stroke segments by nearest neighbour, without the N² cost.
 *
 * WHY
 * The ink styles (IllustFill, OutlineFill) cut the drawing into segments and
 * then chain them: at each step, the next segment is the one with an endpoint
 * closest to where the hand just stopped. Written naively, that is a scan of
 * all remaining segments at every step, hence N² comparisons. On a moderately
 * busy illustration N exceeds a thousand, and this computation alone held the
 * main thread for several hundred ms — on EVERY region entry, since setup() is
 * replayed per annotation.
 *
 * HOW
 * Endpoints are stored in a regular grid. The search starts from the hand's
 * cell and widens in rings: as soon as the current ring is farther than the
 * best candidate already found, no later ring can do better and the search
 * stops. The result is the SAME as the full scan — the same nearest neighbour,
 * with the same tie-breaking rules — only the number of comparisons changes.
 * orderSegmentsNaive stays here as an executable reference, and a test checks
 * that both give the same answer.
 *
 * TIE-BREAKING
 * At equal distance, the naive scan keeps what it saw FIRST: the lowest index,
 * and for the same segment its start rather than its end. Since the grid visits
 * cells in a different order, the rule is made explicit here.
 */

'use strict';

/** True if the candidate (d, i, start) beats the current best. */
function isBetter(d, i, best) {
  if (best.i < 0) return true;
  if (d < best.d) return true;
  return d === best.d && i < best.i;
}

const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

/**
 * Reference: full scan. Kept for parity, and used as is when there are too few
 * segments to pay off the grid.
 *
 * @param segments  array of arrays of {x, y} points
 * @param start     {x, y} hand position before the first segment
 * @returns the segments, reordered and reversed if needed
 */
function orderSegmentsNaive(segments, start) {
  const used = new Uint8Array(segments.length);
  const ordered = [];
  let hx = start.x, hy = start.y;

  for (let n = 0; n < segments.length; n++) {
    let bestD = Infinity, bestI = -1, bestFlip = false;
    for (let i = 0; i < segments.length; i++) {
      if (used[i]) continue;
      const seg = segments[i];
      const p0 = seg[0], pZ = seg[seg.length - 1];
      const d0 = dist2(p0.x, p0.y, hx, hy);
      const dZ = dist2(pZ.x, pZ.y, hx, hy);
      if (d0 < bestD) { bestD = d0; bestI = i; bestFlip = false; }
      if (dZ < bestD) { bestD = dZ; bestI = i; bestFlip = true; }
    }
    if (bestI < 0) break;
    used[bestI] = 1;
    const seg = bestFlip ? [...segments[bestI]].reverse() : segments[bestI];
    ordered.push(seg);
    const last = seg[seg.length - 1];
    hx = last.x; hy = last.y;
  }
  return ordered;
}

/** Below this number of segments, the grid costs more than it saves. */
const GRID_THRESHOLD = 64;

/** Target number of segments per cell: beyond that the grid becomes a list. */
const PER_CELL = 2;

function orderSegments(segments, start) {
  const N = segments.length;
  if (N === 0) return [];
  if (N < GRID_THRESHOLD) return orderSegmentsNaive(segments, start);

  // Extent of the endpoints: they are the only points the grid indexes.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    const seg = segments[i];
    const a = seg[0], z = seg[seg.length - 1];
    if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
    if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y;
    if (z.x < minX) minX = z.x; if (z.x > maxX) maxX = z.x;
    if (z.y < minY) minY = z.y; if (z.y > maxY) maxY = z.y;
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  // Cell side chosen to hold PER_CELL endpoints per cell.
  const side = Math.max(1, Math.sqrt((width * height * PER_CELL) / (2 * N)));
  const nx = Math.max(1, Math.ceil(width / side) + 1);
  const ny = Math.max(1, Math.ceil(height / side) + 1);

  const column = (x) => Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / side)));
  const row = (y) => Math.min(ny - 1, Math.max(0, Math.floor((y - minY) / side)));

  // A cell holds the indices of segments with an endpoint falling in it. A
  // segment appears twice if both ends share the cell: harmless, the selected
  // candidate is the same.
  const cells = new Array(nx * ny);
  const place = (cx, cy, i) => {
    const k = cy * nx + cx;
    (cells[k] || (cells[k] = [])).push(i);
  };
  for (let i = 0; i < N; i++) {
    const seg = segments[i];
    const a = seg[0], z = seg[seg.length - 1];
    place(column(a.x), row(a.y), i);
    place(column(z.x), row(z.y), i);
  }

  const used = new Uint8Array(N);
  const ordered = [];
  let hx = start.x, hy = start.y;
  let remaining = N;

  while (remaining > 0) {
    const cx = column(hx), cy = row(hy);
    const best = { d: Infinity, i: -1, flip: false };

    const examine = (gx, gy) => {
      const list = cells[gy * nx + gx];
      if (!list) return;
      for (let n = 0; n < list.length; n++) {
        const i = list[n];
        if (used[i]) continue;
        const seg = segments[i];
        const p0 = seg[0], pZ = seg[seg.length - 1];
        const d0 = dist2(p0.x, p0.y, hx, hy);
        const dZ = dist2(pZ.x, pZ.y, hx, hy);
        // Start first: on an exact tie, the naive scan does not reverse the segment.
        if (isBetter(d0, i, best)) { best.d = d0; best.i = i; best.flip = false; }
        if (dZ < best.d || (dZ === best.d && i < best.i)) {
          best.d = dZ; best.i = i; best.flip = true;
        }
      }
    };

    const rMax = Math.max(nx, ny);
    for (let r = 0; r <= rMax; r++) {
      // A ring of rank r is at least (r-1) cells away in real distance: as soon
      // as it is farther than the best candidate, the search is over.
      if (best.i >= 0 && r > 1) {
        const floor = (r - 1) * side;
        if (floor * floor > best.d) break;
      }
      const x0 = cx - r, x1 = cx + r, y0 = cy - r, y1 = cy + r;
      if (r === 0) {
        if (cx >= 0 && cx < nx && cy >= 0 && cy < ny) examine(cx, cy);
        continue;
      }
      for (let gx = Math.max(0, x0); gx <= Math.min(nx - 1, x1); gx++) {
        if (y0 >= 0) examine(gx, y0);
        if (y1 < ny) examine(gx, y1);
      }
      for (let gy = Math.max(0, y0 + 1); gy <= Math.min(ny - 1, y1 - 1); gy++) {
        if (x0 >= 0) examine(x0, gy);
        if (x1 < nx) examine(x1, gy);
      }
    }

    if (best.i < 0) break;
    used[best.i] = 1;
    remaining--;
    const seg = best.flip ? [...segments[best.i]].reverse() : segments[best.i];
    ordered.push(seg);
    const last = seg[seg.length - 1];
    hx = last.x; hy = last.y;
  }

  return ordered;
}

module.exports = { orderSegments, orderSegmentsNaive };
