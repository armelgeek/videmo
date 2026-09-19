import { describe, expect, it } from 'vitest';

const {
  normaliserBoite,
  normaliserComposant,
  extraireComposantsEnglobants,
  assignerComposantsAuxRegions,
} = require('./assigner-composants');

describe('assigner-composants', () => {
  describe('normaliserBoite', () => {
    it('normalise [x1, y1, x2, y2]', () => {
      const b = normaliserBoite([10, 20, 110, 220]);
      expect(b).toEqual({
        x1: 10,
        y1: 20,
        x2: 110,
        y2: 220,
        w: 100,
        h: 200,
        cx: 60,
        cy: 120,
        area: 20000,
        diag2: 10000 + 40000,
      });
    });

    it('normalise { x, y, width, height }', () => {
      const b = normaliserBoite({ x: 50, y: 60, width: 40, height: 30 });
      expect(b).toMatchObject({
        x1: 50,
        y1: 60,
        x2: 90,
        y2: 90,
        w: 40,
        h: 30,
        cx: 70,
        cy: 75,
        area: 1200,
      });
    });

    it('gère l inversion min/max', () => {
      const b = normaliserBoite([100, 200, 10, 20]);
      expect(b).toMatchObject({
        x1: 10,
        y1: 20,
        x2: 100,
        y2: 200,
      });
    });
  });

  describe('assignerComposantsAuxRegions', () => {
    it('AC-1: assigne par center containment', () => {
      const comp = { left: 50, top: 50, right: 70, bottom: 70 }; // cx=60, cy=60
      const regions = [
        { x: 0, y: 0, width: 100, height: 100 }, // R0 englobe
        { x: 200, y: 200, width: 100, height: 100 }, // R1 distant
      ];

      const { perRegion, unmatched } = assignerComposantsAuxRegions([comp], regions);
      expect(perRegion[0]).toEqual([comp]);
      expect(perRegion[1]).toEqual([]);
      expect(unmatched).toEqual([]);
    });

    it('AC-2: donne la priorite a la plus petite boite en cas d imbrication', () => {
      const comp = { left: 40, top: 40, right: 60, bottom: 60 }; // cx=50, cy=50, area=400
      const grande = { x: 0, y: 0, width: 200, height: 200 }; // area=40000
      const petite = { x: 30, y: 30, width: 50, height: 50 }; // area=2500

      const { perRegion } = assignerComposantsAuxRegions([comp], [grande, petite]);
      expect(perRegion[0]).toEqual([]); // pas la grande
      expect(perRegion[1]).toEqual([comp]); // la plus petite
    });

    it('AC-3: assigne par chevauchement >= 25% si le centre est hors de la boite', () => {
      // comp : [85..125, 40..60] -> w=40, h=20, area=800, cx=105, cy=50
      // boite : [0..100, 0..100] -> ix = 15 (85..100), iy = 20 (40..60) -> inter = 300
      // 300 / 800 = 37.5% >= 25%
      const comp = { left: 85, top: 40, right: 125, bottom: 60 };
      const boite = { x: 0, y: 0, width: 100, height: 100 };

      const { perRegion, unmatched } = assignerComposantsAuxRegions([comp], [boite]);
      expect(perRegion[0]).toEqual([comp]);
      expect(unmatched).toEqual([]);
    });

    it('assigne par proximite du centre si pas de chevauchement mais proche', () => {
      // boite [0..100, 0..100], centre (50, 50), diag2 = 20000
      // comp tout proche : [105..115, 45..55], cx=110, cy=50. dx=60, dy=0, d2=3600
      // limite2 = max(20000*0.55=11000, 8100) = 11000 >= 3600 -> matche !
      const comp = { left: 105, top: 45, right: 115, bottom: 55 };
      const boite = { x: 0, y: 0, width: 100, height: 100 };

      const { perRegion, unmatched } = assignerComposantsAuxRegions([comp], [boite]);
      expect(perRegion[0]).toEqual([comp]);
      expect(unmatched).toHaveLength(0);
    });

    it('laisse dans unmatched les composants trop eloignes', () => {
      const comp = { left: 800, top: 800, right: 850, bottom: 850 };
      const boite = { x: 0, y: 0, width: 100, height: 100 };

      const { perRegion, unmatched } = assignerComposantsAuxRegions([comp], [boite]);
      expect(perRegion[0]).toHaveLength(0);
      expect(unmatched).toEqual([comp]);
    });

    it('gere des entrees vides ou nulles sans crasher', () => {
      expect(assignerComposantsAuxRegions([], [])).toEqual({ perRegion: [], unmatched: [] });
      expect(assignerComposantsAuxRegions([{ x: 1, y: 1, width: 2, height: 2 }], [])).toEqual({
        perRegion: [],
        unmatched: [{ x: 1, y: 1, width: 2, height: 2 }],
      });
      expect(assignerComposantsAuxRegions([], [{ x: 0, y: 0, width: 10, height: 10 }])).toEqual({
        perRegion: [[]],
        unmatched: [],
      });
    });
  });

  describe('extraireComposantsEnglobants (Spanning)', () => {
    it('AC-4: extrait un cadre englobant et l affecte a la premiere region', () => {
      // Region 0: [10..90, 10..90], area = 6400
      // Region 1: [110..190, 10..90], area = 6400
      const r0 = { x: 10, y: 10, width: 80, height: 80 };
      const r1 = { x: 110, y: 10, width: 80, height: 80 };

      // Cadre englobant les deux : [0..200, 0..100]
      const cadre = { left: 0, top: 0, right: 200, bottom: 100 };
      // Trait interne a r0 : [20..30, 20..30]
      const traitR0 = { left: 20, top: 20, right: 30, bottom: 30 };

      const { spanning, rest } = extraireComposantsEnglobants([cadre, traitR0], [r0, r1]);

      expect(spanning).toHaveLength(1);
      expect(spanning[0]).toEqual({ comp: cadre, regionIndex: 0 }); // region 0 (la premiere)
      expect(rest).toEqual([traitR0]);
    });
  });
});
