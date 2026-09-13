// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { encodeSceneImage, ensurePng, isWebp } from "./scene-image-format";

async function samplePng() {
  const width = 64;
  const height = 64;
  const raw = Buffer.alloc(width * height * 4, 254);
  for (let i = 0; i < raw.length; i += 4) {
    if ((i / 4) % 7 === 0) raw.fill(20, i, i + 3);
    raw[i + 3] = 255;
  }
  return {
    raw,
    png: new Uint8Array(await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer()),
  };
}

describe("scene image format", () => {
  it("stores scenes as WebP without changing a single pixel", async () => {
    const { raw, png } = await samplePng();
    const encoded = await encodeSceneImage(png);

    expect(encoded.contentType).toBe("image/webp");
    expect(encoded.extension).toBe("webp");
    expect(isWebp(encoded.body)).toBe(true);
    const decoded = await sharp(encoded.body).ensureAlpha().raw().toBuffer();
    expect(decoded.equals(raw)).toBe(true);
  });

  it("keeps the original when the bytes cannot be encoded", async () => {
    const garbage = new Uint8Array([1, 2, 3, 4]);
    const encoded = await encodeSceneImage(garbage);
    expect(encoded).toEqual({ body: garbage, contentType: "image/png", extension: "png" });
  });

  it("hands PNG-only readers a PNG", async () => {
    const { png } = await samplePng();
    const { body } = await encodeSceneImage(png);

    const back = await ensurePng(body);
    expect(isWebp(back)).toBe(false);
    expect((await sharp(back).metadata()).format).toBe("png");
    expect(await ensurePng(png)).toBe(png);
  });
});
