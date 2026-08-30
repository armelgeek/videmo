import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Animation = require("./Animation");

/** Canvas 2D reduit aux appels que withAnnotationAwareness effectue. */
const stubCtx = () =>
  new Proxy({}, { get: () => () => undefined }) as CanvasRenderingContext2D;

const region = (x: number) => ({ x, y: 0, width: 40, height: 40 });

/**
 * Deux annotations separees par une pause de 200 ms :
 * [0, 100[ ... pause ... [300, 400[
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

  // 20 ticks de 20 ms : l'horloge traverse la pause [100, 300[.
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

describe("progression pendant une pause entre annotations", () => {
  it("publie la position sur chaque tick de la pause", () => {
    // Sans cela l'horloge avance sans que personne ne la publie : le curseur
    // se fige pendant la pause puis saute au debut de l'annotation suivante.
    const inGap = runThroughGap().filter(
      (s) => s.elapsed > 100 && s.elapsed <= 300,
    );

    expect(inGap.length).toBeGreaterThan(0);
    expect(inGap.every((s) => s.progress !== null)).toBe(true);
  });

  it("fait progresser la position pendant la pause", () => {
    const inGap = runThroughGap()
      .filter((s) => s.elapsed > 100 && s.elapsed <= 300)
      .map((s) => s.progress as number);

    for (let i = 1; i < inGap.length; i++) {
      expect(inGap[i]).toBeGreaterThan(inGap[i - 1]);
    }
  });

  it("rapporte la position sur la timeline entiere, pas sur la region", () => {
    // elapsed = 200 ms sur une timeline de 400 ms -> 0.5, et non 1.0 parce que
    // la premiere region est finie.
    const at200 = runThroughGap().find((s) => s.elapsed === 200);
    expect(at200?.progress).toBeCloseTo(0.5, 5);
  });
});
