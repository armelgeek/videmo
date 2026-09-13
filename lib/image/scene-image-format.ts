import sharp from "sharp";

export interface EncodedSceneImage {
  body: Uint8Array;
  contentType: string;
  extension: string;
}

/** WebP files start with "RIFF", four size bytes, then "WEBP". */
export function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

/**
 * Scene artwork is stored as LOSSLESS WebP: on a real scene the generated PNG
 * went from 1.56 MB to 706 KB with every pixel identical. Lossy was measured
 * too — 28x lighter, but it pushed 7 146 pixels across the white threshold and
 * 2 438 across the ink one, and the reveal reads exactly those pixels.
 *
 * Encoding is an optimisation, never a reason to lose the image: on failure,
 * or if WebP comes out heavier, the PNG is kept.
 */
export async function encodeSceneImage(png: Uint8Array): Promise<EncodedSceneImage> {
  try {
    const webp = await sharp(png).webp({ lossless: true, effort: 4 }).toBuffer();
    if (webp.length < png.length) {
      return { body: new Uint8Array(webp), contentType: "image/webp", extension: "webp" };
    }
  } catch (error) {
    console.error("WebP encoding failed, keeping PNG:", error);
  }
  return { body: png, contentType: "image/png", extension: "png" };
}

/** For readers that only take PNG: node-canvas, the OpenAI edits endpoint. */
export async function ensurePng(bytes: Uint8Array): Promise<Uint8Array> {
  if (!isWebp(bytes)) return bytes;
  return new Uint8Array(await sharp(bytes).png().toBuffer());
}
