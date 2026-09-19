import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCanvas } = require("canvas");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { blanchirFond } = require("./fond-blanc");

function peindre(couleurs: number[][]) {
  const c = createCanvas(couleurs.length, 1);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(couleurs.length, 1);
  couleurs.forEach(([r, v, b], i) => {
    img.data.set([r, v, b, 255], i * 4);
  });
  ctx.putImageData(img, 0, 0);
  return { c, ctx };
}

function lire(ctx: { getImageData: (a: number, b: number, c: number, d: number) => ImageData }, n: number) {
  const d = ctx.getImageData(0, 0, n, 1).data;
  return Array.from({ length: n }, (_, i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
}

describe("blanchirFond", () => {
  it("ramene le fond presque blanc a du blanc pur", () => {
    const { ctx } = peindre([[254, 254, 254], [253, 253, 253], [250, 250, 250]]);
    blanchirFond(ctx, 3, 1);
    expect(lire(ctx, 3)).toEqual([[255, 255, 255], [255, 255, 255], [255, 255, 255]]);
  });

  it("laisse les traits et leur antialiasing intacts", () => {
    const { ctx } = peindre([[0, 0, 0], [128, 128, 128], [249, 249, 249]]);
    blanchirFond(ctx, 3, 1);
    expect(lire(ctx, 3)).toEqual([[0, 0, 0], [128, 128, 128], [249, 249, 249]]);
  });

  it("ne blanchit pas une couleur claire mais saturee", () => {
    const { ctx } = peindre([[255, 252, 120]]);
    blanchirFond(ctx, 1, 1);
    expect(lire(ctx, 1)).toEqual([[255, 252, 120]]);
  });
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { blanchirPixels } = require("./fond-blanc");

const W = 80, H = 60;

function image(fond: (x: number, y: number) => number[]) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) d.set([...fond(x, y), 255], (y * W + x) * 4);
  }
  return d;
}

function trait(d: Uint8ClampedArray, x0: number, x1: number, y0: number, y1: number, rgb: number[]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d.set(rgb, (y * W + x) * 4);
}

const px = (d: Uint8ClampedArray, x: number, y: number) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 3));

describe("blanchirPixels : fond teinte", () => {
  it("blanchit un fond creme et garde l'encre noire", () => {
    const d = image(() => [245, 238, 225]);
    trait(d, 20, 60, 28, 32, [20, 20, 20]);
    expect(blanchirPixels(d, W, H)).toBe(true);
    expect(px(d, 5, 5)).toEqual([255, 255, 255]);
    expect(px(d, 40, 30)).toEqual([21, 21, 23]);
  });

  it("suit un degrade vertical gris", () => {
    const d = image((_, y) => { const g = 225 + Math.round((y / (H - 1)) * 25); return [g, g, g]; });
    blanchirPixels(d, W, H);
    for (const y of [0, 20, 40, 59]) expect(px(d, 40, y)).toEqual([255, 255, 255]);
  });

  it("tolere un trait qui touche le bord", () => {
    const d = image(() => [240, 236, 228]);
    trait(d, 30, 36, 0, 25, [30, 30, 30]);
    trait(d, 0, 20, 40, 45, [30, 30, 30]);
    expect(blanchirPixels(d, W, H)).toBe(true);
    expect(px(d, 50, 40)).toEqual([255, 255, 255]);
    expect(px(d, 33, 2)[0]).toBeLessThan(60);
  });

  it("renonce devant un cadre plein bord", () => {
    const d = image(() => [240, 236, 228]);
    trait(d, 0, W, 0, 3, [30, 30, 30]);
    trait(d, 0, W, H - 3, H, [30, 30, 30]);
    trait(d, 0, 3, 0, H, [30, 30, 30]);
    trait(d, W - 3, W, 0, H, [30, 30, 30]);
    expect(blanchirPixels(d, W, H)).toBe(false);
  });

  it("ne touche pas une image sans fond uni", () => {
    const d = image((x, y) => [(x * 37 + y * 11) % 256, (x * 13) % 256, (y * 29) % 256]);
    const avant = d.slice();
    expect(blanchirPixels(d, W, H)).toBe(false);
    expect(d).toEqual(avant.map((v, i) => (i % 4 === 3 ? v : v)));
  });

  it("ne touche pas un fond sombre voulu", () => {
    const d = image(() => [30, 45, 40]);
    trait(d, 20, 60, 28, 32, [240, 240, 240]);
    expect(blanchirPixels(d, W, H)).toBe(false);
    expect(px(d, 5, 5)).toEqual([30, 45, 40]);
  });

  it("ne change rien de visible a un fond deja blanc", () => {
    const d = image(() => [255, 255, 255]);
    trait(d, 20, 60, 28, 32, [128, 128, 128]);
    blanchirPixels(d, W, H);
    expect(px(d, 40, 30)).toEqual([128, 128, 128]);
  });
});

describe("blanchirFond : letterbox", () => {
  it("n'estime le fond que dans le rectangle de l'artwork", () => {
    const c = createCanvas(100, 60);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgb(245,238,225)";
    ctx.fillRect(20, 0, 60, 60);
    blanchirFond(ctx, 100, 60, { x: 20, y: 0, w: 60, h: 60 });
    expect(Array.from(ctx.getImageData(50, 30, 1, 1).data.slice(0, 3))).toEqual([255, 255, 255]);
  });
});
