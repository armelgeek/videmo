import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnimationFactory = require("./index");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeNaturalDuration } = require("./natural-pacing");

/**
 * Each style must finish its drawing at the NATURAL gesture duration, then
 * hold the drawing until the end of the window. A style paced on the whole
 * window finished on the last frame, with no hold; others finished halfway.
 */
const STYLES = [
  "chunkjump", "contour", "scanner", "outlineonly", "illustfill", "outlinefill",
  "brushfill", "outlinechunks", "scribble", "nervous", "topanchor", "gesture", "skeletontrace",
];

const W = 200, H = 120, FPS = 15, DT = 1000 / FPS;

function canvas() {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return c;
}

function drawing() {
  const c = canvas();
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, W, H);
  x.lineWidth = 4;
  x.strokeStyle = "#111";
  x.fillStyle = "#e8b400";
  x.beginPath();
  x.arc(100, 60, 35, 0, Math.PI * 2);
  x.fill();
  x.stroke();
  x.fillStyle = "#2f6fd0";
  x.fillRect(20, 90, 50, 20);
  x.strokeRect(20, 90, 50, 20);
  return c;
}

function traceEnd(style: string, windowMs: number) {
  const state: any = {
    canvasW: W, canvasH: H, speed: 40, handSpeed: 5, hand: "custom1", tileSlider: 30,
    animStyle: style,
    contentBounds: { x: 0, y: 0, w: W, h: H },
    annotations: [{ region: { x: 0, y: 0, width: W, height: H }, reveal: { from: 0, to: windowMs } }],
  };
  const anim = AnimationFactory.create(style, {
    state,
    ctx: canvas().getContext("2d"),
    hctx: canvas().getContext("2d"),
    offscreen: drawing(),
    callbacks: {},
  });
  anim.setup();
  const maxTicks = Math.ceil(windowMs / DT) + 5;
  for (let i = 0; i < maxTicks; i++) {
    anim.tick(state.speed, DT);
    if (anim._regionDone) return anim.annotationManager.elapsedMs;
  }
  return Infinity;
}

describe("style pacing: natural gesture then hold", () => {
  const tolerance = 2 * DT;

  it.each(STYLES)("%s finishes at the natural duration in a long window", (style) => {
    const windowLen = 4000;
    const natural = computeNaturalDuration({ w: W, h: H }, windowLen);
    expect(natural).toBeLessThan(windowLen - 1000);
    const end = traceEnd(style, windowLen);
    expect(Math.abs(end - natural)).toBeLessThanOrEqual(tolerance);
  });

  it.each(STYLES)("%s fills a whole window shorter than the gesture", (style) => {
    const windowLen = 600;
    const end = traceEnd(style, windowLen);
    expect(end).toBeGreaterThanOrEqual(windowLen - tolerance);
    expect(end).toBeLessThanOrEqual(windowLen + DT);
  });
});
