import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnimationFactory = require("./index");

/**
 * The values offered by the Animation Style menu of
 * components/whiteboard-config-panel.tsx. A style exposed in the UI but
 * unknown to the factory silently falls back to chunkjump: this file
 * prevents that drift.
 */
const UI_STYLES = [
  "brushfill",
  "chunkjump",
  "contour",
  "gesture",
  "illust",
  "nervous",
  "outlinechunks",
  "outlinefill",
  "outlineonly",
  "scanner",
  "scribble",
  "spec-text",
  "specialized",
  "topanchor",
];

const W = 200;
const H = 120;

/** 2D context sufficient for a tick: styles read real pixels. */
function fakeCtx() {
  const ctx: any = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "getImageData") {
          return (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            // Opaque and dark: counts as stroke for buildPresenceMap.
            data: new Uint8ClampedArray(w * h * 4).fill(20),
          });
        }
        if (prop === "measureText") return () => ({ width: 10 });
        if (prop === "createImageData") {
          return (w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4),
          });
        }
        if (prop === "canvas") return { width: W, height: H };
        return () => undefined;
      },
      set: () => true,
    },
  );
  return ctx;
}

function fakeCanvas() {
  return { width: W, height: H, getContext: () => fakeCtx() };
}

function run(style: string) {
  const finished = { called: false };
  const state: any = {
    canvasW: W,
    canvasH: H,
    speed: 40,
    handSpeed: 5,
    hand: "custom1",
    tileSlider: 30,
    contentBounds: { x: 0, y: 0, w: W, h: H },
    annotations: [
      { region: { x: 0, y: 0, width: 90, height: 60 }, reveal: { from: 0, to: 400 } },
      { region: { x: 100, y: 60, width: 90, height: 60 }, reveal: { from: 600, to: 1000 } },
    ],
  };

  const anim = AnimationFactory.create(style, {
    state,
    ctx: fakeCtx(),
    hctx: fakeCtx(),
    offscreen: fakeCanvas(),
    callbacks: {
      fillBg: () => undefined,
      drawHand: () => undefined,
      setProgress: () => undefined,
      finishAnim: () => {
        finished.called = true;
      },
      resScale: () => 1,
      resPointScale: () => 1,
    },
  });

  anim.setup?.();
  // 1200 ms at 20 ms/tick: goes through both regions, the pause and the end.
  for (let i = 0; i < 60; i++) anim.tick?.(40, 20);
  return { anim, finished };
}

/** Number of `deltaMs` ticks before finishAnim is called. */
function ticksUntilFinish(globalStyle: string, annotStyles: (string | null)[]) {
  let ticks: number | null = null;
  const state: any = {
    canvasW: W,
    canvasH: H,
    speed: 40,
    handSpeed: 5,
    hand: "custom1",
    tileSlider: 30,
    contentBounds: { x: 0, y: 0, w: W, h: H },
    annotations: [
      { region: { x: 0, y: 0, width: 90, height: 60 }, reveal: { from: 0, to: 400 } },
      { region: { x: 100, y: 60, width: 90, height: 60 }, reveal: { from: 600, to: 1000 } },
    ],
  };
  annotStyles.forEach((st, i) => {
    if (st) state.annotations[i].animStyle = st;
  });

  const anim = AnimationFactory.create(globalStyle, {
    state,
    ctx: fakeCtx(),
    hctx: fakeCtx(),
    offscreen: fakeCanvas(),
    callbacks: {
      fillBg: () => undefined,
      drawHand: () => undefined,
      setProgress: () => undefined,
      finishAnim: () => undefined,
      resScale: () => 1,
      resPointScale: () => 1,
    },
  });
  anim.finishAnim = () => {
    if (ticks === null) ticks = seen;
  };

  anim.setup?.();
  let seen = 0;
  for (let i = 0; i < 120; i++) {
    seen = i + 1;
    anim.tick?.(40, 20);
  }
  return ticks;
}

describe("styles exposed in the UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom returns null for getContext('2d'): several styles allocate
    // working canvases, they need a usable one.
    const real = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
      tag === "canvas" ? fakeCanvas() : real(tag)) as never);
  });

  it.each(UI_STYLES)("the factory knows %s", (style) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    run(style);
    // create() warns and falls back to ChunkJump when the name is unknown.
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Unknown animation style"),
    );
  });

  it.each(UI_STYLES)("%s runs through an annotated timeline without crashing", (style) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => run(style)).not.toThrow();
  });

  it.each(UI_STYLES)("%s finishes its timeline", (style) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Without this the rAF would run forever after the last `to`.
    expect(run(style).finished.called).toBe(true);
  });

  it("supports different animation styles per annotation without crashing", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const finished = { called: false };
    const state: any = {
      canvasW: W,
      canvasH: H,
      speed: 40,
      handSpeed: 5,
      hand: "custom1",
      tileSlider: 30,
      contentBounds: { x: 0, y: 0, w: W, h: H },
      annotations: [
        { region: { x: 0, y: 0, width: 90, height: 60 }, reveal: { from: 0, to: 400 }, animStyle: "scribble" },
        { region: { x: 100, y: 60, width: 90, height: 60 }, reveal: { from: 600, to: 1000 }, animStyle: "contour" },
      ],
    };

    const anim = AnimationFactory.create("chunkjump", {
      state,
      ctx: fakeCtx(),
      hctx: fakeCtx(),
      offscreen: fakeCanvas(),
      callbacks: {
        fillBg: () => undefined,
        drawHand: () => undefined,
        setProgress: () => undefined,
        finishAnim: () => {
          finished.called = true;
        },
        resScale: () => 1,
        resPointScale: () => 1,
      },
    });

    anim.setup?.();
    expect(() => {
      for (let i = 0; i < 60; i++) anim.tick?.(40, 20);
    }).not.toThrow();
    expect(finished.called).toBe(true);
  });
  it("a per-annotation style does not advance the clock twice", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // The timeline lasts 1000 ms; at 20 ms/tick the end falls on tick 50.
    // When the borrowed instance replayed its own withAnnotationAwareness,
    // it re-incremented elapsedMs and the animation ended too early.
    const reference = ticksUntilFinish("chunkjump", [null, null]);
    expect(reference).toBe(50);
    expect(ticksUntilFinish("chunkjump", ["scribble", null])).toBe(reference);
    expect(ticksUntilFinish("chunkjump", ["scribble", "contour"])).toBe(reference);
    expect(ticksUntilFinish("nervous", [null, "gesture"])).toBe(reference);
  });
});
