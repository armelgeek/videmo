import { describe, expect, it } from 'vitest';

const { squelettiser } = require('./squelette');
const { decomposerTraits, construireDegres } = require('./decomposer-traits');

const W = 21;
const H = 21;
type Pt = { x: number; y: number };

const vide = () => new Uint8Array(W * H);
const pose = (b: Uint8Array, x0: number, y0: number, w: number, h: number) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) b[y * W + x] = 1;
  return b;
};

/** Les pixels d'encre effectivement touches par les traits. */
const couverts = (traits: Pt[][]) => {
  const s = new Set<number>();
  traits.forEach((t) => t.forEach((p) => s.add(p.y * W + p.x)));
  return s;
};

const encre = (b: Uint8Array) => {
  const s = new Set<number>();
  for (let i = 0; i < b.length; i++) if (b[i]) s.add(i);
  return s;
};

describe('construireDegres', () => {
  it('distingue bouts, passages et jonctions', () => {
    const b = vide();
    for (let x = 5; x <= 15; x++) b[10 * W + x] = 1;
    for (let y = 5; y <= 15; y++) b[y * W + 10] = 1;
    const d = construireDegres(b, W, H);

    expect(d[10 * W + 5]).toBe(1);   // bout gauche
    expect(d[10 * W + 7]).toBe(2);   // passage
    expect(d[10 * W + 10]).toBe(4);  // le croisement
  });
});

describe('decomposerTraits', () => {
  it('trace chaque barre d une croix d un seul geste', () => {
    const b = vide();
    pose(b, 3, 9, 15, 3);
    pose(b, 9, 3, 3, 15);
    const traits = decomposerTraits(squelettiser(b, W, H), W, H);

    const longs = traits.filter((t: Pt[]) => t.length >= 10);
    expect(longs).toHaveLength(2);

    // L'un traverse en hauteur, l'autre en largeur : le parcours a continue
    // tout droit au croisement au lieu de tourner.
    const etendues = longs.map((t: Pt[]) => ({
      dx: Math.max(...t.map((p) => p.x)) - Math.min(...t.map((p) => p.x)),
      dy: Math.max(...t.map((p) => p.y)) - Math.min(...t.map((p) => p.y)),
    }));
    expect(etendues.some((e: { dx: number; dy: number }) => e.dy > e.dx)).toBe(true);
    expect(etendues.some((e: { dx: number; dy: number }) => e.dx > e.dy)).toBe(true);
  });

  it('rend un seul trait pour une barre isolee', () => {
    const b = pose(vide(), 4, 9, 13, 3);
    const traits = decomposerTraits(squelettiser(b, W, H), W, H);
    expect(traits.filter((t: Pt[]) => t.length >= 3)).toHaveLength(1);
  });

  it('separe deux traits qui ne se touchent pas', () => {
    const b = vide();
    pose(b, 3, 4, 10, 3);
    pose(b, 3, 15, 10, 3);
    const traits = decomposerTraits(squelettiser(b, W, H), W, H);
    expect(traits.filter((t: Pt[]) => t.length >= 3)).toHaveLength(2);
  });

  it('ne perd aucun pixel d encre', () => {
    const b = vide();
    pose(b, 3, 9, 15, 3);
    pose(b, 9, 3, 3, 15);
    const sq = squelettiser(b, W, H);
    const traits = decomposerTraits(sq, W, H, 1);

    expect(couverts(traits)).toEqual(encre(sq));
  });

  it('ne repasse jamais deux fois sur la meme arrete', () => {
    const b = vide();
    pose(b, 3, 9, 15, 3);
    pose(b, 9, 3, 3, 15);
    const traits = decomposerTraits(squelettiser(b, W, H), W, H, 1);

    const arretes = new Set<string>();
    for (const t of traits) {
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1].y * W + t[i - 1].x;
        const c = t[i].y * W + t[i].x;
        const cle = a < c ? `${a}-${c}` : `${c}-${a}`;
        expect(arretes.has(cle)).toBe(false);
        arretes.add(cle);
      }
    }
  });

  it('reprend une boucle fermee, qui n a aucun bout', () => {
    const b = vide();
    pose(b, 5, 5, 11, 2);
    pose(b, 5, 14, 11, 2);
    pose(b, 5, 5, 2, 11);
    pose(b, 14, 5, 2, 11);
    const traits = decomposerTraits(squelettiser(b, W, H), W, H);

    expect(traits.length).toBeGreaterThan(0);
    expect(Math.max(...traits.map((t: Pt[]) => t.length))).toBeGreaterThan(10);
  });

  it('rend une liste vide pour une image vide', () => {
    expect(decomposerTraits(vide(), W, H)).toEqual([]);
  });

  it('jette les miettes sous la longueur demandee', () => {
    const b = vide();
    pose(b, 4, 9, 13, 3);
    b[2 * W + 2] = 1;
    b[2 * W + 3] = 1;
    const traits = decomposerTraits(squelettiser(b, W, H), W, H, 5);
    expect(traits.every((t: Pt[]) => t.length >= 5)).toBe(true);
  });
});
