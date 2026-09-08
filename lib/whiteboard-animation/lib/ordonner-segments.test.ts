import { describe, expect, it } from 'vitest';

const { ordonnerSegments, ordonnerSegmentsNaif } = require('./ordonner-segments');

type Pt = { x: number; y: number };

/** Generateur reproductible : un test qui echoue doit pouvoir etre rejoue. */
function alea(graine: number) {
  let s = graine >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function segmentsAleatoires(n: number, graine: number, grille = 1000): Pt[][] {
  const r = alea(graine);
  const segs: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const longueur = 1 + Math.floor(r() * 4);
    const x = Math.floor(r() * grille);
    const y = Math.floor(r() * grille);
    const seg: Pt[] = [];
    for (let k = 0; k < longueur; k++) seg.push({ x: x + k, y: y + k });
    segs.push(seg);
  }
  return segs;
}

const trace = (segs: Pt[][]) => segs.map((s) => s.map((p) => `${p.x},${p.y}`).join(' '));

describe('ordonnerSegments', () => {
  it('rend le meme ordre que le balayage complet', () => {
    for (const graine of [1, 7, 42, 1234]) {
      const segs = segmentsAleatoires(300, graine);
      const depart = { x: 0, y: 0 };
      expect(trace(ordonnerSegments(segs, depart))).toEqual(
        trace(ordonnerSegmentsNaif(segs, depart)),
      );
    }
  });

  it('rend le meme ordre quand beaucoup de points se superposent', () => {
    // Les egalites de distance sont le cas ou un departage different se voit :
    // une petite grille les multiplie.
    const segs = segmentsAleatoires(400, 99, 12);
    const depart = { x: 6, y: 6 };
    expect(trace(ordonnerSegments(segs, depart))).toEqual(
      trace(ordonnerSegmentsNaif(segs, depart)),
    );
  });

  it('conserve tous les segments', () => {
    const segs = segmentsAleatoires(200, 5);
    expect(ordonnerSegments(segs, { x: 0, y: 0 })).toHaveLength(segs.length);
  });

  it('passe par le balayage complet sous le seuil, avec le meme resultat', () => {
    const segs = segmentsAleatoires(10, 3);
    const depart = { x: 500, y: 500 };
    expect(trace(ordonnerSegments(segs, depart))).toEqual(
      trace(ordonnerSegmentsNaif(segs, depart)),
    );
  });

  it('accepte une liste vide', () => {
    expect(ordonnerSegments([], { x: 0, y: 0 })).toEqual([]);
  });

  it('coute nettement moins que le balayage complet a grande taille', () => {
    const segs = segmentsAleatoires(4000, 21, 4000);
    const depart = { x: 0, y: 0 };

    const t0 = performance.now();
    ordonnerSegmentsNaif(segs, depart);
    const naif = performance.now() - t0;

    const t1 = performance.now();
    ordonnerSegments(segs, depart);
    const grille = performance.now() - t1;

    expect(grille).toBeLessThan(naif / 2);
  });
});
