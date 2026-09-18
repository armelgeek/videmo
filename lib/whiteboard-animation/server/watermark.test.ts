import { createCanvas } from "canvas";
import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createWatermarkStamp } = require("./watermark");

const W = 640;
const H = 360;

function whiteFrame(): Buffer {
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  return c.toBuffer("raw");
}

const pixel = (buf: Buffer, x: number, y: number) =>
  Array.from(buf.subarray((y * W + x) * 4, (y * W + x) * 4 + 4));

describe("createWatermarkStamp", () => {
  const stamp = createWatermarkStamp({ width: W, height: H, text: "Made with Test" });

  it("laisse la frame d'origine intacte, le puits la garde pour les fondus", () => {
    const frame = whiteFrame();
    const copy = Buffer.from(frame);
    stamp(frame);
    expect(frame.equals(copy)).toBe(true);
  });

  it("marque le coin bas-droit et rien d'autre", () => {
    const frame = whiteFrame();
    const out: Buffer = stamp(frame);
    expect(pixel(out, 5, 5)).toEqual(pixel(frame, 5, 5));
    expect(pixel(out, W / 2, H / 2)).toEqual(pixel(frame, W / 2, H / 2));

    let changedInCorner = 0;
    for (let y = Math.floor(H * 0.8); y < H; y++) {
      for (let x = Math.floor(W * 0.5); x < W; x++) {
        if (pixel(out, x, y).join() !== pixel(frame, x, y).join()) changedInCorner++;
      }
    }
    expect(changedInCorner).toBeGreaterThan(100);
  });
});
