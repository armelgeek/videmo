import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnimationFactory = require("./index");

const W = 400;
const H = 300;

const ctx = () =>
  new Proxy(
    {},
    {
      get: (_t, p) => {
        if (p === "getImageData")
          return (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4).fill(20),
          });
        return () => undefined;
      },
    },
  ) as never;

/**
 * Region de 98px de haut : bandH vaut 48, donc la derniere rangee ne fait que
 * 2px. C'est la geometrie exacte de la region du titre de la scene de
 * reference, celle qui faisait sortir la main du cadre.
 */
const REGION = { x: 40, y: 60, width: 300, height: 98 };

function tipsDuBalayage() {
  const tips: { x: number; y: number }[] = [];
  const state: any = {
    canvasW: W,
    canvasH: H,
    speed: 40,
    handSpeed: 5,
    hand: "custom1",
    contentBounds: { x: 0, y: 0, w: W, h: H },
    annotations: [{ region: REGION, reveal: { from: 0, to: 2000 } }],
  };

  const anim = AnimationFactory.create("scanner", {
    state,
    ctx: ctx(),
    hctx: ctx(),
    offscreen: { width: W, height: H, getContext: () => ctx() },
    callbacks: {
      fillBg: () => undefined,
      drawHand: (...args: any[]) => {
        const [a, b, c] = args;
        const x = typeof a === "number" ? a : b;
        const y = typeof a === "number" ? b : c;
        if (typeof x === "number" && typeof y === "number") tips.push({ x, y });
      },
      setProgress: () => undefined,
      finishAnim: () => undefined,
      resScale: () => 1,
      resPointScale: () => 1,
    },
  });

  anim.setup?.();
  for (let i = 0; i < 150; i++) anim.tick?.(40, 20);
  return tips;
}

describe("Scanner : la pointe reste dans l'annotation", () => {
  const bas = REGION.y + REGION.height;
  const droite = REGION.x + REGION.width;

  it("balaie effectivement la region", () => {
    expect(tipsDuBalayage().length).toBeGreaterThan(10);
  });

  it("ne descend jamais sous le bord bas", () => {
    // La derniere rangee ne fait que 2px : une demi-bande pleine (24px) y
    // posait la pointe 22px sous l'annotation, pendant tout le balayage final.
    const debordent = tipsDuBalayage().filter((t) => t.y > bas);
    expect(debordent).toEqual([]);
  });

  it("ne depasse jamais le bord droit", () => {
    expect(tipsDuBalayage().filter((t) => t.x > droite)).toEqual([]);
  });

  it("reste sous le bord haut et a droite du bord gauche", () => {
    const tips = tipsDuBalayage();
    expect(tips.every((t) => t.y >= REGION.y && t.x >= REGION.x)).toBe(true);
  });
});
