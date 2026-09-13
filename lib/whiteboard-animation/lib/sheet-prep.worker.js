/**
 * Prepares an artwork sheet off the main thread.
 *
 * Mirrors the renderer's prepareOffscreen + fond-blanc + presence-map, which
 * together cost ~110 ms on the main thread and landed at scene handovers.
 * Receives the decoded artwork as an ImageBitmap and the rectangle it occupies,
 * returns the prepared sheet as an ImageBitmap plus its presence map.
 *
 * The two thresholds must stay in sync with fond-blanc.js (SEUIL_BLANC) and
 * presence-map.js (hasInk); presence-map.test.ts guards the latter.
 */

const SEUIL_BLANC = 250;

self.onmessage = (event) => {
  const { id, bitmap, width, height, rect } = event.data;
  try {
    const sheet = new OffscreenCanvas(width, height);
    const ctx = sheet.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h);
    bitmap.close();

    const image = ctx.getImageData(0, 0, width, height);
    const d = image.data;
    const map = new Uint8Array(width * height);
    for (let p = 0, i = 0; p < map.length; p++, i += 4) {
      if (d[i] >= SEUIL_BLANC && d[i + 1] >= SEUIL_BLANC && d[i + 2] >= SEUIL_BLANC) {
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
      }
      const a = d[i + 3];
      if (a > 20 && (a < 250 || d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) map[p] = 1;
    }
    ctx.putImageData(image, 0, 0);

    const prepared = sheet.transferToImageBitmap();
    self.postMessage({ id, sheet: prepared, map }, [prepared, map.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error && error.message ? error.message : error) });
  }
};
