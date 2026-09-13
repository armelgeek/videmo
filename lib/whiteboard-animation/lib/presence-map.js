/**
 * Which pixels of an artwork carry ink, computed once per sheet.
 *
 * Every region entry used to read its rectangle back with getImageData and
 * scan it — up to 45 ms for a large region, paid again at each annotation and
 * at every replay. A prepared sheet never changes once built, so its full map
 * is scanned a single time and each region slices its rectangle out of it.
 *
 * Only sheets flagged `__immutable` are cached: the renderer marks the ones it
 * builds and never redraws. Anything else (server render, test doubles) keeps
 * reading its pixels directly, as before.
 */

const cache = new WeakMap();

/** Same rule as the original per-region scan: visible and not near-white. */
function hasInk(d, i) {
  const a = d[i + 3];
  return a > 20 && (a < 250 || d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240);
}

function fullPresenceMap(sheet) {
  const cached = cache.get(sheet);
  if (cached && cached.width === sheet.width && cached.height === sheet.height) {
    return cached;
  }
  const { width, height } = sheet;
  const d = sheet.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
  const map = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < map.length; p++, i += 4) {
    if (hasInk(d, i)) map[p] = 1;
  }
  const entry = { width, height, map };
  cache.set(sheet, entry);
  return entry;
}

/** The region's map, W×H, identical to scanning that rectangle of the sheet. */
function presenceMapFor(sheet, cb) {
  const full = fullPresenceMap(sheet);
  const W = cb.w, H = cb.h;
  const region = new Uint8Array(W * H);
  // Pixels outside the sheet read back transparent from getImageData: they stay 0.
  const x0 = Math.max(0, cb.x), x1 = Math.min(full.width, cb.x + W);
  const y0 = Math.max(0, cb.y), y1 = Math.min(full.height, cb.y + H);
  for (let y = y0; y < y1; y++) {
    const src = y * full.width;
    const dst = (y - cb.y) * W - cb.x;
    region.set(full.map.subarray(src + x0, src + x1), dst + x0);
  }
  return region;
}

/** Registers a map computed off the main thread for `sheet`. */
function seedPresenceMap(sheet, map) {
  if (map && map.length === sheet.width * sheet.height) {
    cache.set(sheet, { width: sheet.width, height: sheet.height, map });
  }
}

function isCacheable(sheet) {
  return !!(sheet && sheet.__immutable && sheet.width > 0 && sheet.height > 0);
}

module.exports = { presenceMapFor, warmPresenceMap: fullPresenceMap, seedPresenceMap, isCacheable };
