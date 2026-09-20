import { describe, expect, it } from 'vitest';

const { attachPoints } = require('./attach-points');

describe('attachPoints', () => {
  it('AC-5: rattache le point d un ? immediatement apres son glyphe', () => {
    const bouclePointInterrogation = {
      id: 'interrogation-loop',
      left: 100,
      top: 50,
      right: 140,
      bottom: 120, // w=40, h=70, area=2800
      area: 2800,
    };
    const autreMot = {
      id: 'mot-1',
      left: 160,
      top: 60,
      right: 250,
      bottom: 110,
      area: 4500,
    };
    const pointInterrogation = {
      id: 'interrogation-dot',
      left: 115,
      top: 130,
      right: 125,
      bottom: 140, // w=10, h=10, area=100. cx=120, gap = 130 - 120 = 10 <= 4*10
      area: 100,
    };

    // Ordre initial : boucle, autre mot, puis le point plus tard
    const initial = [bouclePointInterrogation, autreMot, pointInterrogation];
    const ordonnes = attachPoints(initial);

    // Ordre attendu : boucle, point, puis autre mot
    expect(ordonnes).toHaveLength(3);
    expect(ordonnes[0].id).toBe('interrogation-loop');
    expect(ordonnes[1].id).toBe('interrogation-dot');
    expect(ordonnes[2].id).toBe('mot-1');
  });

  it('rattache le point sur un i (situe au-dessus)', () => {
    const barreDuI = {
      id: 'i-stem',
      left: 50,
      top: 50,
      right: 60,
      bottom: 100, // cx=55, area=500
      area: 500,
    };
    const lettreSuivante = {
      id: 'lettre-suivante',
      left: 70,
      top: 50,
      right: 90,
      bottom: 100,
      area: 1000,
    };
    const pointDuI = {
      id: 'i-dot',
      left: 51,
      top: 35,
      right: 59,
      bottom: 43, // cx=55, h=8, area=64, gap = 50 - 43 = 7 <= 4*8
      area: 64,
    };

    const initial = [barreDuI, lettreSuivante, pointDuI];
    const ordonnes = attachPoints(initial);

    expect(ordonnes[0].id).toBe('i-stem');
    expect(ordonnes[1].id).toBe('i-dot');
    expect(ordonnes[2].id).toBe('lettre-suivante');
  });

  it('gere plusieurs glyphes avec leurs points respectifs sans melange', () => {
    const p1Glyphe = { id: 'g1', left: 20, top: 10, right: 40, bottom: 60, area: 1000 };
    const p2Glyphe = { id: 'g2', left: 100, top: 10, right: 120, bottom: 60, area: 1000 };
    const mot = { id: 'mot', left: 200, top: 10, right: 300, bottom: 60, area: 5000 };
    const p1Point = { id: 'd1', left: 26, top: 66, right: 34, bottom: 74, area: 64 };
    const p2Point = { id: 'd2', left: 106, top: 66, right: 114, bottom: 74, area: 64 };

    const initial = [p1Glyphe, p2Glyphe, mot, p1Point, p2Point];
    const ordonnes = attachPoints(initial);

    expect(ordonnes.map((c: { id: string }) => c.id)).toEqual(['g1', 'd1', 'g2', 'd2', 'mot']);
  });

  it('ne modifie pas les formes sans points ou les aplats', () => {
    const forme1 = { left: 10, top: 10, right: 80, bottom: 80, area: 4900 };
    const forme2 = { left: 90, top: 10, right: 160, bottom: 80, area: 4900 };
    expect(attachPoints([forme1, forme2])).toEqual([forme1, forme2]);
  });

  it('gere les tableaux de 0 ou 1 element sans erreur', () => {
    expect(attachPoints([])).toEqual([]);
    const c = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(attachPoints([c])).toEqual([c]);
  });
});
