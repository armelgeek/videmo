import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createCanvas } = require("canvas");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { whitenBackground } = require("./white-background");

function paint(colors: number[][]) {
  const c = createCanvas(colors.length, 1);
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(colors.length, 1);
  colors.forEach(([r, g, b], i) => {
    img.data.set([r, g, b, 255], i * 4);
  });
  ctx.putImageData(img, 0, 0);
  return { c, ctx };
}

function read(ctx: { getImageData: (a: number, b: number, c: number, d: number) => ImageData }, n: number) {
  const d = ctx.getImageData(0, 0, n, 1).data;
  return Array.from({ length: n }, (_, i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
}

describe("whitenBackground", () => {
  it("brings an almost-white background to pure white", () => {
    const { ctx } = paint([[254, 254, 254], [253, 253, 253], [250, 250, 250]]);
    whitenBackground(ctx, 3, 1);
    expect(read(ctx, 3)).toEqual([[255, 255, 255], [255, 255, 255], [255, 255, 255]]);
  });

  it("leaves strokes and their antialiasing intact", () => {
    const { ctx } = paint([[0, 0, 0], [128, 128, 128], [249, 249, 249]]);
    whitenBackground(ctx, 3, 1);
    expect(read(ctx, 3)).toEqual([[0, 0, 0], [128, 128, 128], [249, 249, 249]]);
  });

  it("does not whiten a light but saturated color", () => {
    const { ctx } = paint([[255, 252, 120]]);
    whitenBackground(ctx, 1, 1);
    expect(read(ctx, 1)).toEqual([[255, 252, 120]]);
  });
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { whitenPixels } = require("./white-background");

const W = 80, H = 60;

function image(background: (x: number, y: number) => number[]) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) d.set([...background(x, y), 255], (y * W + x) * 4);
  }
  return d;
}

function stroke(d: Uint8ClampedArray, x0: number, x1: number, y0: number, y1: number, rgb: number[]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d.set(rgb, (y * W + x) * 4);
}

const px = (d: Uint8ClampedArray, x: number, y: number) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 3));

describe("whitenPixels: tinted background", () => {
  it("whitens a cream background and keeps black ink", () => {
    const d = image(() => [245, 238, 225]);
    stroke(d, 20, 60, 28, 32, [20, 20, 20]);
    expect(whitenPixels(d, W, H)).toBe(true);
    expect(px(d, 5, 5)).toEqual([255, 255, 255]);
    expect(px(d, 40, 30)).toEqual([21, 21, 23]);
  });

  it("follows a vertical grey gradient", () => {
    const d = image((_, y) => { const g = 225 + Math.round((y / (H - 1)) * 25); return [g, g, g]; });
    whitenPixels(d, W, H);
    for (const y of [0, 20, 40, 59]) expect(px(d, 40, y)).toEqual([255, 255, 255]);
  });

  it("tolerates a stroke touching the edge", () => {
    const d = image(() => [240, 236, 228]);
    stroke(d, 30, 36, 0, 25, [30, 30, 30]);
    stroke(d, 0, 20, 40, 45, [30, 30, 30]);
    expect(whitenPixels(d, W, H)).toBe(true);
    expect(px(d, 50, 40)).toEqual([255, 255, 255]);
    expect(px(d, 33, 2)[0]).toBeLessThan(60);
  });

  it("gives up on a full-bleed frame", () => {
    const d = image(() => [240, 236, 228]);
    stroke(d, 0, W, 0, 3, [30, 30, 30]);
    stroke(d, 0, W, H - 3, H, [30, 30, 30]);
    stroke(d, 0, 3, 0, H, [30, 30, 30]);
    stroke(d, W - 3, W, 0, H, [30, 30, 30]);
    expect(whitenPixels(d, W, H)).toBe(false);
  });

  it("does not touch an image without a solid background", () => {
    const d = image((x, y) => [(x * 37 + y * 11) % 256, (x * 13) % 256, (y * 29) % 256]);
    const before = d.slice();
    expect(whitenPixels(d, W, H)).toBe(false);
    expect(d).toEqual(before.map((v, i) => (i % 4 === 3 ? v : v)));
  });

  it("does not touch an intentional dark background", () => {
    const d = image(() => [30, 45, 40]);
    stroke(d, 20, 60, 28, 32, [240, 240, 240]);
    expect(whitenPixels(d, W, H)).toBe(false);
    expect(px(d, 5, 5)).toEqual([30, 45, 40]);
  });

  it("changes nothing visible on an already white background", () => {
    const d = image(() => [255, 255, 255]);
    stroke(d, 20, 60, 28, 32, [128, 128, 128]);
    whitenPixels(d, W, H);
    expect(px(d, 40, 30)).toEqual([128, 128, 128]);
  });
});

describe("whitenBackground: letterbox", () => {
  it("estimates the background only inside the artwork rectangle", () => {
    const c = createCanvas(100, 60);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgb(245,238,225)";
    ctx.fillRect(20, 0, 60, 60);
    whitenBackground(ctx, 100, 60, { x: 20, y: 0, w: 60, h: 60 });
    expect(Array.from(ctx.getImageData(50, 30, 1, 1).data.slice(0, 3))).toEqual([255, 255, 255]);
  });
});
