import { describe, expect, it } from 'vitest';

const AnnotationManager = require('./AnnotationManager');

type Annot = {
  text?: string;
  region?: { width: number; height: number };
  reveal?: Record<string, number>;
};

const petite: Annot = { text: 'bref', region: { width: 60, height: 60 } };
const grande: Annot = {
  text: 'une explication nettement plus longue a lire',
  region: { width: 600, height: 400 },
};

const manager = (annotations: Annot[], extra: Record<string, unknown> = {}) =>
  new AnnotationManager({ annotations, ...extra }, null);

describe('AnnotationManager — durees ponderees', () => {
  it('garde 1000 ms par region tant que l option est absente', () => {
    const { schedule } = manager([petite, grande]);

    expect(schedule.map((s: any) => s.durationMs)).toEqual([1000, 1000]);
  });

  it('donne plus de temps a la region dense une fois l option active', () => {
    const { schedule } = manager([petite, grande], { dureesPonderees: true });

    expect(schedule[1].durationMs).toBeGreaterThan(schedule[0].durationMs);
  });

  it('conserve la duree totale : le temps est redistribue, pas ajoute', () => {
    const avant = manager([petite, grande]);
    const apres = manager([petite, grande], { dureesPonderees: true });

    expect(apres.endMs()).toBeCloseTo(avant.endMs(), -1);
  });

  it('respecte un budget explicite', () => {
    const { schedule } = manager([petite, grande], {
      dureesPonderees: true,
      budgetMs: 8000,
    });

    const total = schedule.reduce((t: number, s: any) => t + s.durationMs, 0);
    expect(total).toBeGreaterThan(7900);
    expect(total).toBeLessThan(8100);
  });

  it('ne touche pas aux regions dont la narration a fixe les bornes', () => {
    const cale: Annot = { ...grande, reveal: { from: 0, to: 2500 } };
    const { schedule } = manager([cale, petite], { dureesPonderees: true });

    expect(schedule[0].startMs).toBe(0);
    expect(schedule[0].endMs).toBe(2500);
    expect(schedule[0].explicite).toBe(true);
  });

  it('laisse une region seule inchangee : il n y a rien a repartir', () => {
    const { schedule } = manager([grande], { dureesPonderees: true });

    expect(schedule[0].durationMs).toBe(1000);
  });

  it('enchaine les regions sans trou ni chevauchement', () => {
    const { schedule } = manager([petite, grande, petite], {
      dureesPonderees: true,
    });

    expect(schedule[1].startMs).toBe(schedule[0].endMs);
    expect(schedule[2].startMs).toBe(schedule[1].endMs);
    expect(schedule.some((s: any) => s.conflit)).toBe(false);
  });
});
