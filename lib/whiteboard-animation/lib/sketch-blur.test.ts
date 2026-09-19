import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sketchPixels } = require("./sketch-blur");

const W = 40, H = 40;

function image(fn: (x: number, y: number) => number[]) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d.set([...fn(x, y), 255], (y * W + x) * 4);
  return d;
}

const px = (d: Uint8ClampedArray, x: number, y: number) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));

describe("sketchPixels", () => {
  it("keeps the paper white", () => {
    const d = image(() => [255, 255, 255]);
    sketchPixels(d, W, H);
    expect(px(d, 20, 20)).toEqual([255, 255, 255, 184]);
  });

  it("fades ink without erasing it", () => {
    const d = image(() => [0, 0, 0]);
    sketchPixels(d, W, H);
    const [r] = px(d, 20, 20);
    expect(r).toBeGreaterThan(60);
    expect(r).toBeLessThan(90);
  });

  it("blurs a sharp edge", () => {
    const d = image((x) => (x < 20 ? [0, 0, 0] : [255, 255, 255]));
    sketchPixels(d, W, H);
    const [a] = px(d, 17, 20), [b] = px(d, 22, 20);
    expect(a).toBeGreaterThan(80);
    expect(b).toBeLessThan(250);
  });

  it("desaturates colour", () => {
    const d = image(() => [255, 0, 0]);
    sketchPixels(d, W, H);
    const [r, g] = px(d, 20, 20);
    expect(r - g).toBeLessThan(130);
  });
});
