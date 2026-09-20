import { describe, expect, it } from 'vitest';

const { orderSegments, orderSegmentsNaive } = require('./order-segments');

type Pt = { x: number; y: number };

/** Reproducible generator: a failing test must be replayable. */
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randomSegments(n: number, seed: number, grid = 1000): Pt[][] {
  const r = seededRandom(seed);
  const segs: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const length = 1 + Math.floor(r() * 4);
    const x = Math.floor(r() * grid);
    const y = Math.floor(r() * grid);
    const seg: Pt[] = [];
    for (let k = 0; k < length; k++) seg.push({ x: x + k, y: y + k });
    segs.push(seg);
  }
  return segs;
}

const trace = (segs: Pt[][]) => segs.map((s) => s.map((p) => `${p.x},${p.y}`).join(' '));

describe('orderSegments', () => {
  it('returns the same order as the full scan', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const segs = randomSegments(300, seed);
      const start = { x: 0, y: 0 };
      expect(trace(orderSegments(segs, start))).toEqual(
        trace(orderSegmentsNaive(segs, start)),
      );
    }
  });

  it('returns the same order when many points overlap', () => {
    // Distance ties are where a different tie-break shows up: a small grid
    // multiplies them.
    const segs = randomSegments(400, 99, 12);
    const start = { x: 6, y: 6 };
    expect(trace(orderSegments(segs, start))).toEqual(
      trace(orderSegmentsNaive(segs, start)),
    );
  });

  it('keeps every segment', () => {
    const segs = randomSegments(200, 5);
    expect(orderSegments(segs, { x: 0, y: 0 })).toHaveLength(segs.length);
  });

  it('falls back to the full scan below the threshold, with the same result', () => {
    const segs = randomSegments(10, 3);
    const start = { x: 500, y: 500 };
    expect(trace(orderSegments(segs, start))).toEqual(
      trace(orderSegmentsNaive(segs, start)),
    );
  });

  it('accepts an empty list', () => {
    expect(orderSegments([], { x: 0, y: 0 })).toEqual([]);
  });

  it('costs clearly less than the full scan at large sizes', () => {
    const segs = randomSegments(4000, 21, 4000);
    const start = { x: 0, y: 0 };

    const t0 = performance.now();
    orderSegmentsNaive(segs, start);
    const naive = performance.now() - t0;

    const t1 = performance.now();
    orderSegments(segs, start);
    const gridMs = performance.now() - t1;

    expect(gridMs).toBeLessThan(naive / 2);
  });
});
