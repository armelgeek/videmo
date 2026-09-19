import { describe, it, expect } from 'vitest';
const { thinZhangSuen } = require('./thinning');

describe('thinZhangSuen', () => {
  it('handles empty masks without error', () => {
    const mask = new Uint8Array(10 * 10);
    const skel = thinZhangSuen(mask, 10, 10);
    expect(skel.every((v: number) => v === 0)).toBe(true);
  });

  it('does not modify the input mask array', () => {
    const mask = new Uint8Array(10 * 10);
    mask[5 * 10 + 5] = 1;
    const clone = new Uint8Array(mask);
    thinZhangSuen(mask, 10, 10);
    expect(mask).toEqual(clone);
  });

  it('handles small masks without throwing', () => {
    const mask2x2 = new Uint8Array(2 * 2);
    mask2x2[0] = 1;
    expect(() => thinZhangSuen(mask2x2, 2, 2)).not.toThrow();
    const skel2x2 = thinZhangSuen(mask2x2, 2, 2);
    expect(skel2x2.length).toBe(4);
  });

  it('preserves an already 1-pixel wide line', () => {
    const W = 10, H = 10;
    const mask = new Uint8Array(W * H);
    for (let x = 2; x <= 7; x++) {
      mask[5 * W + x] = 1;
    }
    const skel = thinZhangSuen(mask, W, H);
    for (let x = 2; x <= 7; x++) {
      expect(skel[5 * W + x]).toBe(1);
    }
  });

  it('thins a solid 3x6 rectangle to a 1-pixel wide line', () => {
    const W = 10, H = 10;
    const mask = new Uint8Array(W * H);
    // Draw horizontal bar of height 3 (y = 4, 5, 6)
    for (let y = 4; y <= 6; y++) {
      for (let x = 2; x <= 7; x++) {
        mask[y * W + x] = 1;
      }
    }
    const skel = thinZhangSuen(mask, W, H);
    // Center row (y=5) retains the medial axis
    for (let x = 3; x <= 5; x++) {
      expect(skel[5 * W + x]).toBe(1);
    }
    // Outer rows should be thinned away
    for (let x = 0; x < W; x++) {
      expect(skel[4 * W + x]).toBe(0);
      expect(skel[6 * W + x]).toBe(0);
    }
    // Entire skeleton is strictly 1-pixel high on row 5
    const rows = new Set<number>();
    for (let i = 0; i < skel.length; i++) {
      if (skel[i]) rows.add(Math.floor(i / W));
    }
    expect(rows.size).toBe(1);
    expect(rows.has(5)).toBe(true);
  });

  it('preserves connectivity of a cross shape (+)', () => {
    const W = 15, H = 15;
    const mask = new Uint8Array(W * H);
    // Thick cross
    for (let y = 3; y <= 11; y++) {
      for (let x = 6; x <= 8; x++) mask[y * W + x] = 1;
    }
    for (let y = 6; y <= 8; y++) {
      for (let x = 3; x <= 11; x++) mask[y * W + x] = 1;
    }
    const skel = thinZhangSuen(mask, W, H);
    // Intersection center must be present
    expect(skel[7 * W + 7]).toBe(1);
    // Total skeleton pixels must be significantly less than original mask
    const originalCount = mask.reduce((s, v) => s + v, 0);
    const skelCount = skel.reduce((s: number, v: number) => s + v, 0);
    expect(skelCount).toBeLessThan(originalCount / 2);
  });

  it('preserves topology of an open ring (hole stays empty)', () => {
    const W = 15, H = 15;
    const mask = new Uint8Array(W * H);
    // 3-pixel wide frame/ring
    for (let y = 3; y <= 11; y++) {
      for (let x = 3; x <= 11; x++) {
        if (x <= 5 || x >= 9 || y <= 5 || y >= 9) {
          mask[y * W + x] = 1;
        }
      }
    }
    const skel = thinZhangSuen(mask, W, H);
    // Center hole must remain empty (topology preserved)
    expect(skel[7 * W + 7]).toBe(0);
    // The skeleton must contain thinned ring pixels
    const skelCount = skel.reduce((s: number, v: number) => s + v, 0);
    expect(skelCount).toBeGreaterThan(0);
  });
});
