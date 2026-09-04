import { describe, it, expect } from 'vitest';
import Animation from '/home/armel/dev/Hayzar/boilerplate/nextjs_boilerplate/lib/whiteboard-animation/lib/Animation';

function region(phases: number, total: number, durationMs = 1000, deltaMs = 16.67) {
  const anim: any = new Animation({
    state: { canvasW: 10, canvasH: 10, contentBounds: { x: 0, y: 0, w: 10, h: 10 } },
    ctx: { drawImage() {} }, hctx: {}, offscreen: null,
  });
  anim._frames = Math.round(durationMs / deltaMs);
  anim._regionDuration = durationMs;
  anim._paceCarry = null;

  const emitted = new Array(phases).fill(0);
  // Phase p only starts once phase p-1 has emitted everything (how the
  // sequential fill styles actually drive their passes).
  for (let t = deltaMs; t < durationMs; t += deltaMs) {
    anim._regionElapsed = t;
    for (let p = 0; p < phases; p++) {
      if (p > 0 && emitted[p - 1] < total) break;
      emitted[p] += anim.paceStep(total, 1, phases, p + 1);
    }
  }
  return emitted;
}

describe('paceStep completion within a region', () => {
  it('single phase completes', () => {
    expect(region(1, 500)).toEqual([500]);
  });
  it('two phases both complete before the region ends', () => {
    expect(region(2, 500)).toEqual([500, 500]);
  });
  it('three phases all complete before the region ends', () => {
    expect(region(3, 500)).toEqual([500, 500, 500]);
  });
});
