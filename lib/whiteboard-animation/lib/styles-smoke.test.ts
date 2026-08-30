import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnimationFactory = require("./index");

/**
 * Les valeurs proposees par le menu Animation Style de
 * components/whiteboard-config-panel.tsx. Un style expose dans l'UI mais
 * inconnu de la factory retombe silencieusement sur chunkjump : ce fichier
 * empeche cette derive.
 */
const UI_STYLES = [
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

/** Contexte 2D suffisant pour un tick : les styles lisent des pixels reels. */
function fakeCtx() {
  const ctx: any = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "getImageData") {
          return (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            // Opaque et sombre : compte comme du trait pour buildPresenceMap.
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
  // 1200 ms a 20 ms/tick : traverse les deux regions, la pause et la fin.
  for (let i = 0; i < 60; i++) anim.tick?.(40, 20);
  return { anim, finished };
}

describe("styles exposes dans l'UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom rend null sur getContext('2d') : plusieurs styles s'allouent des
    // canvas de travail, il leur en faut un utilisable.
    const real = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
      tag === "canvas" ? fakeCanvas() : real(tag)) as never);
  });

  it.each(UI_STYLES)("la factory connait %s", (style) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    run(style);
    // create() avertit et retombe sur ChunkJump quand le nom est inconnu.
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Unknown animation style"),
    );
  });

  it.each(UI_STYLES)("%s traverse une timeline annotee sans planter", (style) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => run(style)).not.toThrow();
  });

  it.each(UI_STYLES)("%s termine sa timeline", (style) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // Sans cela le rAF tournerait indefiniment apres le dernier `to`.
    expect(run(style).finished.called).toBe(true);
  });
});
