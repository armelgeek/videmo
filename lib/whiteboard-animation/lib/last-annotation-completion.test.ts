import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnimationFactory = require("./index");

const W = 200;
const H = 120;

function fakeCtx() {
  return new Proxy({} as any, {
    get: (_t, prop) => {
      if (prop === "getImageData")
        return (_x: number, _y: number, w: number, h: number) => ({
          width: w, height: h,
          data: new Uint8ClampedArray(w * h * 4).fill(20),
        });
      if (prop === "measureText") return () => ({ width: 10 });
      if (prop === "createImageData")
        return (w: number, h: number) => ({
          width: w, height: h, data: new Uint8ClampedArray(w * h * 4),
        });
      if (prop === "canvas") return { width: W, height: H };
      return () => undefined;
    },
    set: () => true,
  });
}

const fakeCanvas = () => ({ width: W, height: H, getContext: () => fakeCtx() });

/**
 * Ce qui restait a emettre quand la derniere annotation s'acheve. Chaque cle de
 * _paceCarry encode son total ("total:phases:tag"), donc le reste se lit sans
 * instrumenter les styles.
 */
function resteALaFin(style: string) {
  const state: any = {
    canvasW: W, canvasH: H, speed: 40, handSpeed: 5, hand: "custom1",
    tileSlider: 30,
    contentBounds: { x: 0, y: 0, w: W, h: H },
    annotations: [
      { region: { x: 0, y: 0, width: 90, height: 60 }, reveal: { from: 0, to: 400 } },
      { region: { x: 100, y: 60, width: 90, height: 60 }, reveal: { from: 600, to: 1000 } },
    ],
  };

  const anim: any = AnimationFactory.create(style, {
    state, ctx: fakeCtx(), hctx: fakeCtx(), offscreen: fakeCanvas(),
    callbacks: {
      fillBg: () => undefined, drawHand: () => undefined,
      setProgress: () => undefined, finishAnim: () => undefined,
      resScale: () => 1, resPointScale: () => 1,
    },
  });
  anim.setup?.();

  let reste = 0;
  const mesurer = () => {
    reste = 0;
    for (const inst of [anim, ...Object.values(anim._annotStyleCache || {})] as any[]) {
      const carry = inst?._paceCarry;
      if (!carry) continue;
      for (const key of Object.keys(carry)) {
        const total = Number(key.split(":")[0]);
        if (!Number.isFinite(total) || total <= 0) continue;
        reste = Math.max(reste, total - carry[key].emitted);
      }
    }
  };

  // 20 ms/tick. La derniere annotation court de 600 a 1000 ms : on releve juste
  // avant que isFinished ne declenche _flushRegion (qui masquerait le reste).
  for (let t = 20; t <= 980; t += 20) {
    anim.tick?.(40, 20);
    if (t >= 980) mesurer();
  }
  return reste;
}

const STYLES = ["chunkjump", "contour", "gesture", "illust", "nervous",
  "outlinechunks", "outlinefill", "scribble", "specialized", "topanchor"];

describe("la derniere annotation va au bout de son trace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // jsdom rend null sur getContext('2d') : les styles s'allouent des canvas
    // de travail, il leur en faut un utilisable.
    const real = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
      tag === "canvas" ? fakeCanvas() : real(tag)) as never);
  });

  it.each(STYLES)("%s ne laisse rien a estampiller a la fin", (style) => {
    expect(resteALaFin(style)).toBe(0);
  });
});
