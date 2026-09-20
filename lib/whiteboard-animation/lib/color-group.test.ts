import { describe, expect, it } from 'vitest';

const {
  decouperGroupeCouleur,
  waypointsGroupeCouleur,
  wcFill,
} = require('./AnimationUtils');

const W = 40;
const H = 30;

const createCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Source image: an opaque red square, the rest transparent. */
function sourceWithSquare(x0: number, y0: number, w: number, h: number) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(255, 0, 0)';
  ctx.fillRect(x0, y0, w, h);
  return ctx.getImageData(0, 0, W, H);
}

function squarePixels(x0: number, y0: number, w: number, h: number) {
  const pixels: { x: number; y: number }[] = [];
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) pixels.push({ x, y });
  }
  return pixels;
}

const read = (ctx: CanvasRenderingContext2D, x: number, y: number) =>
  Array.from(ctx.getImageData(x, y, 1, 1).data);

describe('decouperGroupeCouleur', () => {
  it('sizes the canvas to the group box, not the scene', () => {
    const grp: any = { pixels: squarePixels(10, 8, 6, 4) };
    const canvas = decouperGroupeCouleur(grp, sourceWithSquare(10, 8, 6, 4), W, createCanvas);

    expect(grp.box).toEqual({ x: 10, y: 8, w: 6, h: 4 });
    expect([canvas.width, canvas.height]).toEqual([6, 4]);
  });

  it('keeps the color of the group pixels', () => {
    const grp: any = { pixels: squarePixels(10, 8, 6, 4) };
    const canvas = decouperGroupeCouleur(grp, sourceWithSquare(10, 8, 6, 4), W, createCanvas);
    const ctx = canvas.getContext('2d')!;

    // Top-left corner of the group, now the origin of its own canvas.
    expect(read(ctx, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(read(ctx, 5, 3)).toEqual([255, 0, 0, 255]);
  });
});

describe('wcFill', () => {
  /** Recomposes a cut-out group onto a full-frame canvas. */
  const place = (revealH: number) => {
    const grp: any = { pixels: squarePixels(10, 8, 6, 4) };
    const src = decouperGroupeCouleur(grp, sourceWithSquare(10, 8, 6, 4), W, createCanvas);
    const target = createCanvas(W, H);
    const ctx = target.getContext('2d')!;
    wcFill(ctx, src, { x: 0, y: 0, w: W, h: H }, revealH, grp.box);
    return ctx;
  };

  it('puts the group back at its original position', () => {
    const ctx = place(H);
    expect(read(ctx, 10, 8)).toEqual([255, 0, 0, 255]);
    expect(read(ctx, 15, 11)).toEqual([255, 0, 0, 255]);
    // Just outside the square: nothing.
    expect(read(ctx, 9, 8)[3]).toBe(0);
    expect(read(ctx, 16, 11)[3]).toBe(0);
  });

  it('only lays down the band already revealed', () => {
    // Revealed down to y = 10: only the first two rows of the square.
    const ctx = place(10);
    expect(read(ctx, 10, 8)).toEqual([255, 0, 0, 255]);
    expect(read(ctx, 10, 9)).toEqual([255, 0, 0, 255]);
    expect(read(ctx, 10, 10)[3]).toBe(0);
    expect(read(ctx, 10, 11)[3]).toBe(0);
  });

  it('draws nothing until the front reaches the group', () => {
    const ctx = place(5);
    expect(read(ctx, 10, 8)[3]).toBe(0);
  });

  it('stays compatible with a full-page source (no box)', () => {
    const src = createCanvas(W, H);
    const sctx = src.getContext('2d')!;
    sctx.fillStyle = 'rgb(0, 0, 255)';
    sctx.fillRect(10, 8, 6, 4);

    const target = createCanvas(W, H);
    const ctx = target.getContext('2d')!;
    wcFill(ctx, src, { x: 0, y: 0, w: W, h: H }, H, undefined);

    expect(read(ctx, 10, 8)).toEqual([0, 0, 255, 255]);
  });
});

describe('pixels as indices (grouperCouleurs)', () => {
  const squareIndices = (x0: number, y0: number, w: number, h: number) =>
    Int32Array.from(squarePixels(x0, y0, w, h), (p) => p.y * W + p.x);

  it('cuts the same box and the same colors as objects', () => {
    const src = sourceWithSquare(10, 8, 6, 4);
    const obj: any = { pixels: squarePixels(10, 8, 6, 4) };
    const idx: any = { pixels: squareIndices(10, 8, 6, 4) };
    const a = decouperGroupeCouleur(obj, src, W, createCanvas);
    const b = decouperGroupeCouleur(idx, src, W, createCanvas);

    expect(idx.box).toEqual(obj.box);
    const readAll = (c: HTMLCanvasElement) =>
      Array.from(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data);
    expect(readAll(b)).toEqual(readAll(a));
  });

  it('returns the same waypoints as objects', () => {
    expect(waypointsGroupeCouleur(squareIndices(10, 8, 6, 4), W)).toEqual(
      waypointsGroupeCouleur(squarePixels(10, 8, 6, 4)),
    );
  });

  it('groups by color, small groups apart, in scan order', () => {
    const { grouperCouleurs } = require('./AnimationUtils');
    const src = sourceWithSquare(10, 8, 6, 4);
    const cb = { x: 0, y: 0, w: W, h: H };
    const { groups, small } = grouperCouleurs(src.data, cb, W, 10);

    expect(groups).toHaveLength(1);
    expect([groups[0].r, groups[0].g, groups[0].b]).toEqual([240, 0, 0]);
    expect(Array.from(groups[0].pixels)).toEqual(Array.from(squareIndices(10, 8, 6, 4)));
    expect(small).toHaveLength(0);
    expect(grouperCouleurs(src.data, cb, W, 100).small).toHaveLength(24);
  });
});

describe('waypointsGroupeCouleur', () => {
  it('returns one point per row, alternating right and left', () => {
    const wps = waypointsGroupeCouleur(squarePixels(10, 8, 6, 4));
    expect(wps).toEqual([
      { x: 15, y: 8 },
      { x: 10, y: 9 },
      { x: 15, y: 10 },
      { x: 10, y: 11 },
    ]);
  });
});
