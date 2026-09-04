import { describe, it, expect, vi } from 'vitest';
import Animation from './Animation';

function makeHarness() {
  const ctx = { drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), clearRect: vi.fn() };
  const hctx = { clearRect: vi.fn() };
  const offscreen = { width: 800, height: 600 };
  const state: any = {
    canvasW: 800,
    canvasH: 600,
    contentBounds: { x: 0, y: 0, w: 800, h: 600 },
    annotations: [],
  };
  return { ctx, hctx, offscreen, state };
}

describe('_flushRegion', () => {
  it('stamps nothing when no region has been entered yet', () => {
    const { ctx, hctx, offscreen, state } = makeHarness();
    const anim = new Animation({ state, ctx, hctx, offscreen });

    anim._flushRegion();

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('stamps only the active region once one has been entered', () => {
    const { ctx, hctx, offscreen, state } = makeHarness();
    const anim = new Animation({ state, ctx, hctx, offscreen });
    state._regionRect = { x: 10, y: 20, w: 100, h: 50 };

    anim._flushRegion();

    expect(ctx.drawImage).toHaveBeenCalledWith(offscreen, 10, 20, 100, 50, 10, 20, 100, 50);
  });

  it('does not replay a stale revealCanvas left by a previous run', () => {
    const { ctx, hctx, offscreen, state } = makeHarness();
    state.revealCanvas = { width: 800, height: 600 };
    const anim = new Animation({ state, ctx, hctx, offscreen });

    anim._flushRegion();

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
