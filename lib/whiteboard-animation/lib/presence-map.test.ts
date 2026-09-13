import { describe, expect, it } from 'vitest';

const { presenceMapFor, isCacheable } = require('./presence-map');

const W = 60;
const H = 40;

/** A sheet with ink, anti-aliased edges, a near-white area and a transparent hole. */
function makeSheet() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(254, 254, 254)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgb(20, 20, 20)';
  ctx.fillRect(8, 6, 20, 14);
  ctx.fillStyle = 'rgba(200, 30, 30, 0.5)';
  ctx.fillRect(30, 18, 18, 12);
  ctx.clearRect(50, 0, 10, 10);
  return c;
}

/** The original per-region scan, kept verbatim from Animation.buildPresenceMap. */
function scanRegion(sheet: HTMLCanvasElement, cb: { x: number; y: number; w: number; h: number }) {
  const d = sheet.getContext('2d')!.getImageData(cb.x, cb.y, cb.w, cb.h).data;
  const map = new Uint8Array(cb.w * cb.h);
  for (let y = 0; y < cb.h; y++) {
    for (let x = 0; x < cb.w; x++) {
      const i = (y * cb.w + x) * 4;
      const a = d[i + 3];
      if (a > 20 && (a < 250 || d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) {
        map[y * cb.w + x] = 1;
      }
    }
  }
  return map;
}

describe('presenceMapFor', () => {
  const regions = [
    { name: 'the whole sheet', cb: { x: 0, y: 0, w: W, h: H } },
    { name: 'a region inside', cb: { x: 5, y: 4, w: 30, h: 20 } },
    { name: 'a region crossing the right and bottom edges', cb: { x: 45, y: 30, w: 25, h: 20 } },
    { name: 'a region crossing the left and top edges', cb: { x: -6, y: -3, w: 20, h: 15 } },
  ];

  for (const { name, cb } of regions) {
    it(`matches a direct scan of ${name}`, () => {
      const sheet = Object.assign(makeSheet(), { __immutable: true });
      expect(Array.from(presenceMapFor(sheet, cb))).toEqual(Array.from(scanRegion(sheet, cb)));
    });
  }

  it('only caches sheets the renderer marked as never redrawn', () => {
    expect(isCacheable(makeSheet())).toBe(false);
    expect(isCacheable(Object.assign(makeSheet(), { __immutable: true }))).toBe(true);
  });
});
