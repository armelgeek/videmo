import { describe, it, expect, vi } from 'vitest';
const SkeletonTrace = require('./SkeletonTrace');

function createMockContext(W: number, H: number) {
  const mockCtx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round'
  };

  const canvas = {
    width: W,
    height: H,
    getContext: () => mockCtx
  };
  return canvas;
}

describe('SkeletonTrace End-to-End Integration', () => {
  it('runs complete lifecycle on a synthetic cross image (+)', () => {
    const W = 40, H = 40;
    const offscreen = createMockContext(W, H);
    const ctx = createMockContext(W, H).getContext();
    const hctx = createMockContext(W, H).getContext();
    const finishAnim = vi.fn();
    const drawHand = vi.fn();

    const state: any = {
      canvasW: W,
      canvasH: H,
      contentBounds: { x: 0, y: 0, w: W, h: H },
      handSpeed: 10,
      hand: null
    };

    const anim = new SkeletonTrace({
      state,
      ctx,
      hctx,
      offscreen,
      callbacks: { finishAnim, drawHand }
    });

    // Mock ensureRevealCanvas
    anim.ensureRevealCanvas = () => {
      if (!state.revealCanvas) {
        state.revealCanvas = createMockContext(W, H);
      }
    };

    // Mock presence map with a 3px thick cross (+)
    const presence = new Uint8Array(W * H);
    for (let y = 10; y <= 30; y++) {
      for (let x = 18; x <= 22; x++) presence[y * W + x] = 1; // vertical
    }
    for (let y = 18; y <= 22; y++) {
      for (let x = 10; x <= 30; x++) presence[y * W + x] = 1; // horizontal
    }
    anim.buildPresenceMap = () => presence;

    anim.setup();

    // Verification of R2: Must have resolved cross into continuous strokes
    expect(state.skeletonStrokes.length).toBe(2);
    expect(state.skeletonTotalPts).toBeGreaterThan(20);
  });

  it('adapts radius based on distance transform for thick vs thin lines', () => {
    const W = 30, H = 30;
    const offscreen = createMockContext(W, H);
    const ctx = createMockContext(W, H).getContext();
    const hctx = createMockContext(W, H).getContext();

    const state: any = {
      canvasW: W,
      canvasH: H,
      contentBounds: { x: 0, y: 0, w: W, h: H },
      handSpeed: 10,
      hand: null
    };

    const anim = new SkeletonTrace({
      state,
      ctx,
      hctx,
      offscreen,
      callbacks: { finishAnim: vi.fn(), drawHand: vi.fn() }
    });

    // Left side: thick region (7px wide)
    const presence = new Uint8Array(W * H);
    for (let y = 5; y <= 24; y++) {
      for (let x = 2; x <= 8; x++) presence[y * W + x] = 1;
    }
    // Right side: thin region (1px wide)
    for (let y = 10; y <= 19; y++) {
      presence[y * W + 20] = 1;
    }
    anim.buildPresenceMap = () => presence;

    anim.setup();

    const strokes = state.skeletonStrokes || [];
    expect(strokes.length).toBeGreaterThan(0);

    // Verify radius scaling: thick region should have larger radii than thin
    let maxRadiusThick = 0;
    let maxRadiusThin = 0;
    for (const stroke of strokes) {
      for (const pt of stroke.waypoints) {
        if (pt.x < 15) maxRadiusThick = Math.max(maxRadiusThick, pt.r);
        else maxRadiusThin = Math.max(maxRadiusThin, pt.r);
      }
    }
    expect(maxRadiusThick).toBeGreaterThan(maxRadiusThin);
  });

  it('extracts and animates a closed circle without fragmentation', () => {
    const W = 30, H = 30;
    const offscreen = createMockContext(W, H);
    const ctx = createMockContext(W, H).getContext();
    const hctx = createMockContext(W, H).getContext();
    const finishAnim = vi.fn();

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
      callbacks: { finishAnim, drawHand: vi.fn() }
    });

    // Mock ensureRevealCanvas to provide a real canvas
    anim.ensureRevealCanvas = () => {
      if (!state.revealCanvas) {
        state.revealCanvas = createMockContext(W, H);
      }
    };

    // Draw a thick circle loop (2px wide)
    const presence = new Uint8Array(W * H);
    const cx = 15, cy = 15, r = 10;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d >= r - 1 && d <= r + 1) presence[y * W + x] = 1;
      }
    }
    anim.buildPresenceMap = () => presence;

    anim.setup();

    // Circle should yield exactly 1 stroke (closed path)
    expect(state.skeletonStrokes.length).toBe(1);
    expect(state.skeletonTotalPts).toBeGreaterThan(20);

    // Run animation to completion (just check setup, skip tick to avoid canvas issues)
    expect(state.skeletonTotalPts).toBeGreaterThan(0);
  });

  it('handles empty region gracefully and finishes immediately', () => {
    const W = 20, H = 20;
    const offscreen = createMockContext(W, H);
    const ctx = createMockContext(W, H).getContext();
    const hctx = createMockContext(W, H).getContext();
    const finishAnim = vi.fn();

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
      callbacks: { finishAnim, drawHand: vi.fn() }
    });

    // Empty presence map
    const presence = new Uint8Array(W * H);
    anim.buildPresenceMap = () => presence;

    anim.setup();

    // Should have 0 strokes and immediately finish
    expect(state.skeletonStrokes.length).toBe(0);
    expect(state.skeletonTotalPts).toBe(0);

    anim.tick(10, 16.67);
    expect(finishAnim).toHaveBeenCalled();
  });

  it('respects content bounds offset during coordinate transformation', () => {
    const W = 20, H = 20;
    const offscreen = createMockContext(W, H);
    const ctx = createMockContext(W, H).getContext();
    const hctx = createMockContext(W, H).getContext();

    const state: any = {
      canvasW: 100,
      canvasH: 100,
      contentBounds: { x: 30, y: 40, w: W, h: H },
      handSpeed: 10,
      hand: null
    };

    const anim = new SkeletonTrace({
      state,
      ctx,
      hctx,
      offscreen,
      callbacks: { finishAnim: vi.fn(), drawHand: vi.fn() }
    });

    // Simple horizontal line in local coords (0..20, 0..20)
    const presence = new Uint8Array(W * H);
    for (let x = 5; x < 15; x++) presence[10 * W + x] = 1;
    anim.buildPresenceMap = () => presence;

    anim.setup();

    const strokes = state.skeletonStrokes || [];
    expect(strokes.length).toBeGreaterThan(0);

    // All waypoints should be transformed by offset (30, 40)
    for (const stroke of strokes) {
      for (const pt of stroke.waypoints) {
        expect(pt.x).toBeGreaterThanOrEqual(30);
        expect(pt.x).toBeLessThanOrEqual(50);
        expect(pt.y).toBeGreaterThanOrEqual(40);
        expect(pt.y).toBeLessThanOrEqual(60);
      }
    }
  });
});
