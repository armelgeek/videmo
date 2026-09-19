/**
 * Prepares an artwork sheet off the main thread.
 *
 * Mirrors the renderer's prepareOffscreen + white-background + presence-map, which
 * together cost ~110 ms on the main thread and landed at scene handovers.
 * Receives the decoded artwork as an ImageBitmap and the rectangle it occupies,
 * returns the prepared sheet as an ImageBitmap plus its presence map.
 *
 * The presence threshold must stay in sync with presence-map.js (hasInk);
 * presence-map.test.ts guards it.
 */

const { whitenBackground } = require('./white-background');

self.onmessage = (event) => {
  const { id, bitmap, width, height, rect } = event.data;
  try {
    const sheet = new OffscreenCanvas(width, height);
    const ctx = sheet.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h);
    bitmap.close();
    whitenBackground(ctx, width, height, rect);

    const image = ctx.getImageData(0, 0, width, height);
    const d = image.data;
    const map = new Uint8Array(width * height);
    for (let p = 0, i = 0; p < map.length; p++, i += 4) {
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
