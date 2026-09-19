import { describe, it, expect, vi } from 'vitest';
const SkeletonTrace = require('./SkeletonTrace');
const styles = require('./index');

describe('SkeletonTrace style', () => {
  it('is exported from lib/styles/index.js as SkeletonTrace', () => {
    expect(styles.SkeletonTrace).toBeDefined();
  });

  it('runs setup and initializes waypoints without error', () => {
    const W = 50, H = 50;
    const offscreen = {
      width: W,
      height: H,
      getContext: () => ({
        getImageData: () => ({
          data: new Uint8ClampedArray(W * H * 4)
        })
      })
    };
    const ctx = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      globalCompositeOperation: 'source-over'
    };
    const hctx = {
      clearRect: vi.fn()
    };
    const state: any = {
      canvasW: W,
      canvasH: H,
      contentBounds: { x: 0, y: 0, w: W, h: H },
      handSpeed: 5,
      hand: null
    };

    const anim = new SkeletonTrace({
      state,
      ctx,
      hctx,
      offscreen,
      callbacks: {
        drawHand: vi.fn(),
        finishAnim: vi.fn(),
        resScale: () => 1
      }
    });

    // Mock buildPresenceMap to return an empty map
    anim.buildPresenceMap = () => new Uint8Array(W * H);
    anim.setup();

    expect(state.skeletonStrokes).toBeDefined();
    expect(state.skeletonStrokes.length).toBe(0);

    // Mock tick() with 0 strokes calls finishAnim immediately
    anim.tick(10);
    expect(anim.finishAnim).toHaveBeenCalled();
  });
});
