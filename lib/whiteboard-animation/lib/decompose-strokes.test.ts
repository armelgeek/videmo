import { describe, expect, it } from 'vitest';

const { squelettiser } = require('./squelette');
const { decomposeStrokes, buildDegrees } = require('./decompose-strokes');

const W = 21;
const H = 21;
type Pt = { x: number; y: number };

const empty = () => new Uint8Array(W * H);
const paint = (b: Uint8Array, x0: number, y0: number, w: number, h: number) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) b[y * W + x] = 1;
  return b;
};

/** The ink pixels actually touched by the strokes. */
const covered = (strokes: Pt[][]) => {
  const s = new Set<number>();
  strokes.forEach((t) => t.forEach((p) => s.add(p.y * W + p.x)));
  return s;
};

const ink = (b: Uint8Array) => {
  const s = new Set<number>();
  for (let i = 0; i < b.length; i++) if (b[i]) s.add(i);
  return s;
};

describe('buildDegrees', () => {
  it('tells ends, pass-throughs and junctions apart', () => {
    const b = empty();
    for (let x = 5; x <= 15; x++) b[10 * W + x] = 1;
    for (let y = 5; y <= 15; y++) b[y * W + 10] = 1;
    const d = buildDegrees(b, W, H);

    expect(d[10 * W + 5]).toBe(1);   // left end
    expect(d[10 * W + 7]).toBe(2);   // pass-through
    expect(d[10 * W + 10]).toBe(4);  // the crossing
  });
});

describe('decomposeStrokes', () => {
  it('draws each bar of a cross in a single gesture', () => {
    const b = empty();
    paint(b, 3, 9, 15, 3);
    paint(b, 9, 3, 3, 15);
    const strokes = decomposeStrokes(squelettiser(b, W, H), W, H);

    const longs = strokes.filter((t: Pt[]) => t.length >= 10);
    expect(longs).toHaveLength(2);

    // One spans vertically, the other horizontally: the path kept going
    // straight at the crossing instead of turning.
    const extents = longs.map((t: Pt[]) => ({
      dx: Math.max(...t.map((p) => p.x)) - Math.min(...t.map((p) => p.x)),
      dy: Math.max(...t.map((p) => p.y)) - Math.min(...t.map((p) => p.y)),
    }));
    expect(extents.some((e: { dx: number; dy: number }) => e.dy > e.dx)).toBe(true);
    expect(extents.some((e: { dx: number; dy: number }) => e.dx > e.dy)).toBe(true);
  });

  it('returns a single stroke for an isolated bar', () => {
    const b = paint(empty(), 4, 9, 13, 3);
    const strokes = decomposeStrokes(squelettiser(b, W, H), W, H);
    expect(strokes.filter((t: Pt[]) => t.length >= 3)).toHaveLength(1);
  });

  it('separates two strokes that do not touch', () => {
    const b = empty();
    paint(b, 3, 4, 10, 3);
    paint(b, 3, 15, 10, 3);
    const strokes = decomposeStrokes(squelettiser(b, W, H), W, H);
    expect(strokes.filter((t: Pt[]) => t.length >= 3)).toHaveLength(2);
  });

  it('loses no ink pixel', () => {
    const b = empty();
    paint(b, 3, 9, 15, 3);
    paint(b, 9, 3, 3, 15);
    const sk = squelettiser(b, W, H);
    const strokes = decomposeStrokes(sk, W, H, 1);

    expect(covered(strokes)).toEqual(ink(sk));
  });

  it('never goes over the same edge twice', () => {
    const b = empty();
    paint(b, 3, 9, 15, 3);
    paint(b, 9, 3, 3, 15);
    const strokes = decomposeStrokes(squelettiser(b, W, H), W, H, 1);

    const edges = new Set<string>();
    for (const t of strokes) {
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1].y * W + t[i - 1].x;
        const c = t[i].y * W + t[i].x;
        const key = a < c ? `${a}-${c}` : `${c}-${a}`;
        expect(edges.has(key)).toBe(false);
        edges.add(key);
      }
    }
  });

  it('picks up a closed loop, which has no end', () => {
    const b = empty();
    paint(b, 5, 5, 11, 2);
    paint(b, 5, 14, 11, 2);
    paint(b, 5, 5, 2, 11);
    paint(b, 14, 5, 2, 11);
    const strokes = decomposeStrokes(squelettiser(b, W, H), W, H);

    expect(strokes.length).toBeGreaterThan(0);
    expect(Math.max(...strokes.map((t: Pt[]) => t.length))).toBeGreaterThan(10);
  });

  it('returns an empty list for an empty image', () => {
    expect(decomposeStrokes(empty(), W, H)).toEqual([]);
  });

  it('drops crumbs below the requested length', () => {
    const b = empty();
    paint(b, 4, 9, 13, 3);
    b[2 * W + 2] = 1;
    b[2 * W + 3] = 1;
    const strokes = decomposeStrokes(squelettiser(b, W, H), W, H, 5);
    expect(strokes.every((t: Pt[]) => t.length >= 5)).toBe(true);
  });
});
