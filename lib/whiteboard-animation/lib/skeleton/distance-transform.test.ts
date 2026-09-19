import { describe, it, expect } from 'vitest';
const { distanceTransformChamfer } = require('./distance-transform');

describe('distanceTransformChamfer', () => {
  it('returns 0 for background pixels', () => {
    const W = 8, H = 8;
    const mask = new Uint8Array(W * H);
    const dist = distanceTransformChamfer(mask, W, H);
    expect(dist.every((v: number) => v === 0)).toBe(true);
  });

  it('assigns radius = 1 to a 1-pixel wide line', () => {
    const W = 10, H = 5;
    const mask = new Uint8Array(W * H);
    for (let x = 1; x < 9; x++) mask[2 * W + x] = 1; // 1px horizontal line
    const dist = distanceTransformChamfer(mask, W, H);
    for (let x = 2; x < 8; x++) {
      expect(dist[2 * W + x]).toBeCloseTo(1, 0.5);
    }
  });

  it('computes larger radius at center of thick stripe', () => {
    const W = 15, H = 15;
    const mask = new Uint8Array(W * H);
    // Draw 7px thick square in center (y from 4 to 10, x from 4 to 10)
    for (let y = 4; y <= 10; y++) {
      for (let x = 4; x <= 10; x++) {
        mask[y * W + x] = 1;
      }
    }
    const dist = distanceTransformChamfer(mask, W, H);
    const centerRadius = dist[7 * W + 7];
    const edgeRadius = dist[4 * W + 7];
    expect(centerRadius).toBeGreaterThan(edgeRadius);
    expect(centerRadius).toBeGreaterThanOrEqual(3);
  });

  it('handles edge boundaries cleanly without out-of-bounds errors', () => {
    const W = 4, H = 4;
    const mask = new Uint8Array(W * H).fill(1);
    const dist = distanceTransformChamfer(mask, W, H);
    expect(dist.length).toBe(16);
    expect(dist[0]).toBeGreaterThanOrEqual(1.0);
  });
});
