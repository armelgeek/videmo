import { describe, expect, it } from 'vitest';

const { squelettiser, transitions } = require('./squelette');

const W = 21;
const H = 21;

const empty = () => new Uint8Array(W * H);
const fill = (b: Uint8Array, x0: number, y0: number, w: number, h: number) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) b[y * W + x] = 1;
  return b;
};
const count = (b: Uint8Array) => b.reduce((a: number, c: number) => a + c, 0);

/** Number of 8-connected components: topology must survive. */
function components(b: Uint8Array) {
  const seen = new Uint8Array(W * H);
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!b[i] || seen[i]) continue;
    n++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop() as number;
      const px = p % W;
      const py = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (b[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
  }
  return n;
}

describe('transitions', () => {
  it('equals 1 for a single-piece neighbourhood', () => {
    expect(transitions([1, 1, 1, 0, 0, 0, 0, 0])).toBe(1);
  });

  it('equals 2 when the neighbours form two groups', () => {
    expect(transitions([1, 1, 0, 0, 1, 1, 0, 0])).toBe(2);
  });
});

describe('squelettiser', () => {
  it('reduces a thick bar to a one-pixel stroke', () => {
    const b = fill(empty(), 4, 8, 13, 5);
    const s = squelettiser(b, W, H);

    expect(count(s)).toBeLessThan(count(b) / 3);
    // A single occupied row: the stroke sits on its axis.
    const rows = new Set<number>();
    for (let i = 0; i < s.length; i++) if (s[i]) rows.add((i / W) | 0);
    expect(rows.size).toBe(1);
  });

  it('does not modify the input array', () => {
    const b = fill(empty(), 4, 8, 13, 5);
    const before = count(b);
    squelettiser(b, W, H);
    expect(count(b)).toBe(before);
  });

  it('keeps the crossing of a connected cross', () => {
    const b = empty();
    fill(b, 3, 9, 15, 3);
    fill(b, 9, 3, 3, 15);
    const s = squelettiser(b, W, H);

    expect(components(s)).toBe(1);
    expect(count(s)).toBeLessThan(count(b) / 2);
  });

  it('keeps an open ring: topology survives', () => {
    const b = empty();
    fill(b, 4, 4, 13, 3);
    fill(b, 4, 14, 13, 3);
    fill(b, 4, 4, 3, 13);
    fill(b, 14, 4, 3, 13);
    const s = squelettiser(b, W, H);

    expect(components(s)).toBe(1);
    // A thinned ring stays hollow: the centre must not fill in.
    expect(s[10 * W + 10]).toBe(0);
  });

  it('preserves two separate strokes', () => {
    const b = empty();
    fill(b, 2, 3, 8, 3);
    fill(b, 2, 15, 8, 3);
    expect(components(squelettiser(b, W, H))).toBe(2);
  });

  it('leaves an empty image empty', () => {
    expect(count(squelettiser(empty(), W, H))).toBe(0);
  });

  it('terminates on dense noise without erasing everything', () => {
    const b = fill(empty(), 2, 2, 17, 17);
    const s = squelettiser(b, W, H);
    expect(count(s)).toBeGreaterThan(0);
    expect(count(s)).toBeLessThan(count(b) / 4);
  });
});
