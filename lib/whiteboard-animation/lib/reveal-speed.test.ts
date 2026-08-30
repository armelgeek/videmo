import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Animation = require("./Animation");

const stub = () => new Proxy({}, { get: () => () => undefined }) as never;

function engine() {
  const state: any = {
    canvasW: 200,
    canvasH: 100,
    speed: Animation.DEFAULT_SPEED,
    contentBounds: { x: 0, y: 0, w: 200, h: 100 },
    annotations: [
      { region: { x: 0, y: 0, width: 100, height: 100 }, reveal: { from: 0, to: 10000 } },
    ],
  };
  const anim = new Animation({
    state,
    ctx: stub(),
    hctx: stub(),
    offscreen: { width: 200, height: 100, getContext: () => stub() },
    callbacks: {},
  });
  return { anim, state };
}

/** Ms d'horloge moteur consommes par un tick de `deltaMs`. */
function clockStep(anim: any, deltaMs: number) {
  const before = anim.annotationManager.elapsedMs;
  anim.withAnnotationAwareness(deltaMs, () => undefined);
  return anim.annotationManager.elapsedMs - before;
}

describe("reveal speed", () => {
  it("vaut 1x a la valeur par defaut du curseur", () => {
    // 40 = 1x : la fenetre de l'annotation est honoree en temps reel.
    const { anim } = engine();
    expect(clockStep(anim, 20)).toBeCloseTo(20, 5);
  });

  it("multiplie la cadence de l'horloge", () => {
    const { anim, state } = engine();
    state.speed = 80;
    expect(clockStep(anim, 20)).toBeCloseTo(40, 5);
    state.speed = 20;
    expect(clockStep(anim, 20)).toBeCloseTo(10, 5);
  });

  it("prend effet en cours de lecture, sans reconstruire le moteur", () => {
    // state.speed est relu a chaque tick : c'est ce qui permet au hook de
    // pousser la nouvelle valeur dans l'instance vivante plutot que d'en
    // rebatir une, ce qui repartirait du debut.
    const { anim, state } = engine();
    clockStep(anim, 20);
    const avant = anim.annotationManager.elapsedMs;

    state.speed = 100;
    const pas = clockStep(anim, 20);

    expect(pas).toBeCloseTo(50, 5);
    // L'horloge a continue, elle n'est pas repartie de zero.
    expect(anim.annotationManager.elapsedMs).toBeGreaterThan(avant);
  });

  it("borne le ralenti pour que l'horloge avance toujours", () => {
    const { anim, state } = engine();
    state.speed = 0;
    expect(clockStep(anim, 20)).toBeGreaterThan(0);
  });
});
