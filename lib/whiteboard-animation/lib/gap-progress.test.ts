import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Animation = require("./Animation");

/** 2D canvas reduced to the calls withAnnotationAwareness makes. */
const stubCtx = () =>
  new Proxy({}, { get: () => () => undefined }) as CanvasRenderingContext2D;

const region = (x: number) => ({ x, y: 0, width: 40, height: 40 });

/**
 * Two annotations separated by a 200 ms gap:
 * [0, 100[ ... gap ... [300, 400[
 */
function runThroughGap() {
  const published: number[] = [];
  const state: any = {
    canvasW: 200,
    canvasH: 100,
    speed: Animation.DEFAULT_SPEED,
    contentBounds: { x: 0, y: 0, w: 200, h: 100 },
    annotations: [
      { region: region(0), reveal: { from: 0, to: 100 } },
      { region: region(100), reveal: { from: 300, to: 400 } },
    ],
  };

  const anim = new Animation({
    state,
    ctx: stubCtx(),
    hctx: stubCtx(),
    offscreen: { width: 200, height: 100, getContext: () => stubCtx() },
    callbacks: { setProgress: (p: number) => published.push(p) },
  });

  // 20 ticks of 20 ms: the clock crosses the gap [100, 300[.
  const samples: { elapsed: number; progress: number | null }[] = [];
  for (let i = 0; i < 20; i++) {
    const before = published.length;
    anim.withAnnotationAwareness(20, () => undefined);
    samples.push({
      elapsed: anim.annotationManager.elapsedMs,
      progress: published.length > before ? published[published.length - 1] : null,
    });
  }
  return samples;
}

describe("progress during a gap between annotations", () => {
  it("publishes the position on every tick of the gap", () => {
    // Otherwise the clock advances without anyone publishing it: the cursor
    // freezes during the gap then jumps to the start of the next annotation.
    const inGap = runThroughGap().filter(
      (s) => s.elapsed > 100 && s.elapsed <= 300,
    );

    expect(inGap.length).toBeGreaterThan(0);
    expect(inGap.every((s) => s.progress !== null)).toBe(true);
  });

  it("advances the position during the gap", () => {
    const inGap = runThroughGap()
      .filter((s) => s.elapsed > 100 && s.elapsed <= 300)
      .map((s) => s.progress as number);

    for (let i = 1; i < inGap.length; i++) {
      expect(inGap[i]).toBeGreaterThan(inGap[i - 1]);
    }
  });

  it("reports the position over the whole timeline, not the region", () => {
    // elapsed = 200 ms on a 400 ms timeline -> 0.5, not 1.0 because the
    // first region is finished.
    const at200 = runThroughGap().find((s) => s.elapsed === 200);
    expect(at200?.progress).toBeCloseTo(0.5, 5);
  });
});
