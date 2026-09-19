import { describe, expect, it } from 'vitest';

const {
  sweepWeight, chooseFill, brushWidth,
  brushStrokes, frontSweep, revealedPolygon,
} = require('./brush-fill-strokes');

type Box = { x: number; y: number; w: number; h: number };
const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

const aire = (poly: { x: number; y: number }[]) => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
};

describe('sweepWeight', () => {
  it('reste entre 0 et 1', () => {
    for (const r of [0, 0.01, 0.2, 0.5, 1]) {
      const p = sweepWeight(r * 1000, 1000);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('croit avec la taille de la zone', () => {
    const petit = sweepWeight(100, 10000);
    const moyen = sweepWeight(2000, 10000);
    const grand = sweepWeight(8000, 10000);
    expect(moyen).toBeGreaterThan(petit);
    expect(grand).toBeGreaterThan(moyen);
  });

  it('ne divise pas par une region vide', () => {
    expect(sweepWeight(100, 0)).toBe(0);
  });

  it('bascule en douceur : deux zones voisines se remplissent pareil', () => {
    const a = sweepWeight(1790, 10000);
    const b = sweepWeight(1810, 10000);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });
});

describe('chooseFill', () => {
  it('hachure les petites zones et balaye les grandes', () => {
    expect(chooseFill(100, 10000)).toBe('brosse');
    expect(chooseFill(6000, 10000)).toBe('sweep');
  });
});

describe('brushWidth', () => {
  it('grandit avec la zone, entre deux bornes', () => {
    const fine = brushWidth(box(0, 0, 30, 30));
    const large = brushWidth(box(0, 0, 600, 600));
    expect(large).toBeGreaterThan(fine);
    expect(fine).toBeGreaterThanOrEqual(6);
    expect(large).toBeLessThanOrEqual(28);
  });
});

describe('brushStrokes', () => {
  it('couvre toute la hauteur de la zone', () => {
    const coups = brushStrokes(box(0, 0, 100, 60), 20);
    expect(coups.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...coups.map((c: any) => c.y0))).toBeLessThanOrEqual(60);
  });

  it('serpente : chaque coup repart ou le precedent s est arrete', () => {
    const coups = brushStrokes(box(0, 0, 100, 80), 20);
    for (let i = 1; i < coups.length; i++) {
      expect(coups[i].x0).toBe(coups[i - 1].x1);
      expect(coups[i].sens).toBe(-coups[i - 1].sens);
    }
  });

  it('rend au moins un coup, meme sur une zone plate', () => {
    expect(brushStrokes(box(0, 0, 100, 1), 20).length).toBeGreaterThanOrEqual(1);
  });
});

describe('frontSweep / revealedPolygon', () => {
  const b = box(10, 20, 100, 60);

  it('ne revele rien a 0, tout a 1', () => {
    expect(aire(revealedPolygon(b, frontSweep(b, 0)))).toBeCloseTo(0, 6);
    expect(aire(revealedPolygon(b, frontSweep(b, 1)))).toBeCloseTo(100 * 60, 6);
  });

  it('revele de facon monotone', () => {
    let precedent = -1;
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const a = aire(revealedPolygon(b, frontSweep(b, p)));
      expect(a).toBeGreaterThanOrEqual(precedent);
      precedent = a;
    }
  });

  it('coupe en biais : le front n est ni horizontal ni vertical', () => {
    const poly = revealedPolygon(b, frontSweep(b, 0.5, 35));
    const xs = new Set(poly.map((p: any) => Math.round(p.x)));
    const ys = new Set(poly.map((p: any) => Math.round(p.y)));
    expect(xs.size).toBeGreaterThan(1);
    expect(ys.size).toBeGreaterThan(1);
  });

  it('borne la progression hors de [0,1]', () => {
    expect(aire(revealedPolygon(b, frontSweep(b, -3)))).toBeCloseTo(0, 6);
    expect(aire(revealedPolygon(b, frontSweep(b, 9)))).toBeCloseTo(100 * 60, 6);
  });
});
