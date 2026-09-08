import { describe, expect, it } from 'vitest';

const {
  decouperGroupeCouleur,
  waypointsGroupeCouleur,
  wcFill,
} = require('./AnimationUtils');

const W = 40;
const H = 30;

const creerCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Image source : un carre rouge opaque, le reste transparent. */
function sourceAvecCarre(x0: number, y0: number, w: number, h: number) {
  const c = creerCanvas(W, H);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(255, 0, 0)';
  ctx.fillRect(x0, y0, w, h);
  return ctx.getImageData(0, 0, W, H);
}

function pixelsDuCarre(x0: number, y0: number, w: number, h: number) {
  const pixels: { x: number; y: number }[] = [];
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) pixels.push({ x, y });
  }
  return pixels;
}

const lire = (ctx: CanvasRenderingContext2D, x: number, y: number) =>
  Array.from(ctx.getImageData(x, y, 1, 1).data);

describe('decouperGroupeCouleur', () => {
  it('alloue le canvas au cadre du groupe, pas a la scene', () => {
    const grp: any = { pixels: pixelsDuCarre(10, 8, 6, 4) };
    const canvas = decouperGroupeCouleur(grp, sourceAvecCarre(10, 8, 6, 4), W, creerCanvas);

    expect(grp.box).toEqual({ x: 10, y: 8, w: 6, h: 4 });
    expect([canvas.width, canvas.height]).toEqual([6, 4]);
  });

  it('conserve la couleur des pixels du groupe', () => {
    const grp: any = { pixels: pixelsDuCarre(10, 8, 6, 4) };
    const canvas = decouperGroupeCouleur(grp, sourceAvecCarre(10, 8, 6, 4), W, creerCanvas);
    const ctx = canvas.getContext('2d')!;

    // Coin haut-gauche du groupe, devenu l'origine de son propre canvas.
    expect(lire(ctx, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(lire(ctx, 5, 3)).toEqual([255, 0, 0, 255]);
  });
});

describe('wcFill', () => {
  /** Recompose un groupe decoupe sur un canvas plein cadre. */
  const poser = (revealH: number) => {
    const grp: any = { pixels: pixelsDuCarre(10, 8, 6, 4) };
    const src = decouperGroupeCouleur(grp, sourceAvecCarre(10, 8, 6, 4), W, creerCanvas);
    const cible = creerCanvas(W, H);
    const ctx = cible.getContext('2d')!;
    wcFill(ctx, src, { x: 0, y: 0, w: W, h: H }, revealH, grp.box);
    return ctx;
  };

  it("repose le groupe a sa place d'origine", () => {
    const ctx = poser(H);
    expect(lire(ctx, 10, 8)).toEqual([255, 0, 0, 255]);
    expect(lire(ctx, 15, 11)).toEqual([255, 0, 0, 255]);
    // Juste en dehors du carre : rien.
    expect(lire(ctx, 9, 8)[3]).toBe(0);
    expect(lire(ctx, 16, 11)[3]).toBe(0);
  });

  it('ne depose que la bande deja devoilee', () => {
    // Devoile jusqu'a y = 10 : les deux premieres lignes du carre seulement.
    const ctx = poser(10);
    expect(lire(ctx, 10, 8)).toEqual([255, 0, 0, 255]);
    expect(lire(ctx, 10, 9)).toEqual([255, 0, 0, 255]);
    expect(lire(ctx, 10, 10)[3]).toBe(0);
    expect(lire(ctx, 10, 11)[3]).toBe(0);
  });

  it("ne dessine rien tant que le front n'a pas atteint le groupe", () => {
    const ctx = poser(5);
    expect(lire(ctx, 10, 8)[3]).toBe(0);
  });

  it('reste compatible avec une source pleine page (sans cadre)', () => {
    const src = creerCanvas(W, H);
    const sctx = src.getContext('2d')!;
    sctx.fillStyle = 'rgb(0, 0, 255)';
    sctx.fillRect(10, 8, 6, 4);

    const cible = creerCanvas(W, H);
    const ctx = cible.getContext('2d')!;
    wcFill(ctx, src, { x: 0, y: 0, w: W, h: H }, H, undefined);

    expect(lire(ctx, 10, 8)).toEqual([0, 0, 255, 255]);
  });
});

describe('waypointsGroupeCouleur', () => {
  it('rend un point par ligne, alternativement a droite et a gauche', () => {
    const wps = waypointsGroupeCouleur(pixelsDuCarre(10, 8, 6, 4));
    expect(wps).toEqual([
      { x: 15, y: 8 },
      { x: 10, y: 9 },
      { x: 15, y: 10 },
      { x: 10, y: 11 },
    ]);
  });
});
