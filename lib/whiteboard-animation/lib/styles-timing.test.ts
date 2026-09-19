import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AnimationFactory = require("./index");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { calculerDureeNaturelle } = require("./rythme-naturel");

/**
 * Chaque style doit finir son trace a la duree NATURELLE du geste, puis tenir
 * le dessin jusqu'a la fin de la fenetre. Un style cadence sur la fenetre
 * entiere finissait sur la derniere frame, sans maintien ; d'autres finissaient
 * a mi-chemin.
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

function dessin() {
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

function finDuTrace(style: string, fenetreMs: number) {
  const state: any = {
    canvasW: W, canvasH: H, speed: 40, handSpeed: 5, hand: "custom1", tileSlider: 30,
    animStyle: style,
    contentBounds: { x: 0, y: 0, w: W, h: H },
    annotations: [{ region: { x: 0, y: 0, width: W, height: H }, reveal: { from: 0, to: fenetreMs } }],
  };
  const anim = AnimationFactory.create(style, {
    state,
    ctx: canvas().getContext("2d"),
    hctx: canvas().getContext("2d"),
    offscreen: dessin(),
    callbacks: {},
  });
  anim.setup();
  const maxTicks = Math.ceil(fenetreMs / DT) + 5;
  for (let i = 0; i < maxTicks; i++) {
    anim.tick(state.speed, DT);
    if (anim._regionDone) return anim.annotationManager.elapsedMs;
  }
  return Infinity;
}

describe("cadence des styles : geste naturel puis maintien", () => {
  const tolerance = 2 * DT;

  it.each(STYLES)("%s finit a la duree naturelle dans une fenetre longue", (style) => {
    const fenetre = 4000;
    const naturelle = calculerDureeNaturelle({ w: W, h: H }, fenetre);
    expect(naturelle).toBeLessThan(fenetre - 1000);
    const fin = finDuTrace(style, fenetre);
    expect(Math.abs(fin - naturelle)).toBeLessThanOrEqual(tolerance);
  });

  it.each(STYLES)("%s occupe toute une fenetre plus courte que le geste", (style) => {
    const fenetre = 600;
    const fin = finDuTrace(style, fenetre);
    expect(fin).toBeGreaterThanOrEqual(fenetre - tolerance);
    expect(fin).toBeLessThanOrEqual(fenetre + DT);
  });
});
