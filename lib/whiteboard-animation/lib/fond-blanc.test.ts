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
