import { describe, expect, it } from 'vitest';

const { squelettiser, transitions } = require('./squelette');

const W = 21;
const H = 21;

const vide = () => new Uint8Array(W * H);
const pose = (b: Uint8Array, x0: number, y0: number, w: number, h: number) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) b[y * W + x] = 1;
  return b;
};
const compte = (b: Uint8Array) => b.reduce((a: number, c: number) => a + c, 0);

/** Nombre de composantes 8-connexes : la topologie doit survivre. */
function composantes(b: Uint8Array) {
  const vu = new Uint8Array(W * H);
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!b[i] || vu[i]) continue;
    n++;
    const pile = [i];
    vu[i] = 1;
    while (pile.length) {
      const p = pile.pop() as number;
      const px = p % W;
      const py = (p / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (b[q] && !vu[q]) { vu[q] = 1; pile.push(q); }
      }
    }
  }
  return n;
}

describe('transitions', () => {
  it('vaut 1 pour un voisinage d un seul tenant', () => {
    expect(transitions([1, 1, 1, 0, 0, 0, 0, 0])).toBe(1);
  });

  it('vaut 2 quand les voisins forment deux groupes', () => {
    expect(transitions([1, 1, 0, 0, 1, 1, 0, 0])).toBe(2);
  });
});

describe('squelettiser', () => {
  it('ramene une barre epaisse a un trait d un pixel', () => {
    const b = pose(vide(), 4, 8, 13, 5);
    const s = squelettiser(b, W, H);

    expect(compte(s)).toBeLessThan(compte(b) / 3);
    // Une seule rangee occupee : le trait est bien sur son axe.
    const rangees = new Set<number>();
    for (let i = 0; i < s.length; i++) if (s[i]) rangees.add((i / W) | 0);
    expect(rangees.size).toBe(1);
  });

  it('ne modifie pas le tableau d entree', () => {
    const b = pose(vide(), 4, 8, 13, 5);
    const avant = compte(b);
    squelettiser(b, W, H);
    expect(compte(b)).toBe(avant);
  });

  it('garde le croisement d une croix connexe', () => {
    const b = vide();
    pose(b, 3, 9, 15, 3);
    pose(b, 9, 3, 3, 15);
    const s = squelettiser(b, W, H);

    expect(composantes(s)).toBe(1);
    expect(compte(s)).toBeLessThan(compte(b) / 2);
  });

  it('garde un anneau ouvert : la topologie survit', () => {
    const b = vide();
    pose(b, 4, 4, 13, 3);
    pose(b, 4, 14, 13, 3);
    pose(b, 4, 4, 3, 13);
    pose(b, 14, 4, 3, 13);
    const s = squelettiser(b, W, H);

    expect(composantes(s)).toBe(1);
    // Un anneau aminci reste creux : le centre ne doit pas se remplir.
    expect(s[10 * W + 10]).toBe(0);
  });

  it('preserve deux traits separes', () => {
    const b = vide();
    pose(b, 2, 3, 8, 3);
    pose(b, 2, 15, 8, 3);
    expect(composantes(squelettiser(b, W, H))).toBe(2);
  });

  it('laisse une image vide vide', () => {
    expect(compte(squelettiser(vide(), W, H))).toBe(0);
  });

  it('termine sur du bruit dense sans tout effacer', () => {
    const b = pose(vide(), 2, 2, 17, 17);
    const s = squelettiser(b, W, H);
    expect(compte(s)).toBeGreaterThan(0);
    expect(compte(s)).toBeLessThan(compte(b) / 4);
  });
});
