import { describe, expect, it } from 'vitest';

const AnnotationManager = require('./AnnotationManager');

const B = (from: number, to: number) => ({
  region: { x: 0, y: 0, width: 10, height: 10 },
  reveal: { from, to },
});

describe('AnnotationManager.endMs', () => {
  it('rend le dernier `to` de la planification', () => {
    const m = new AnnotationManager({ annotations: [B(0, 1600), B(2000, 2600)] }, null);
    expect(m.endMs()).toBe(2600);
    expect(m.isFinished()).toBe(false);
    m.elapsedMs = 2600;
    expect(m.isFinished()).toBe(true);
  });

  it('suit une planification posee apres coup', () => {
    // Le resultat est retenu d'un appel a l'autre ; il doit se caler sur la
    // liste courante, et non sur celle vue a la construction — des appelants
    // (harnais, rejeu) montent l'objet puis lui donnent sa planification.
    const m = new AnnotationManager({ annotations: [B(0, 1000)] }, null);
    expect(m.endMs()).toBe(1000);

    m.schedule = m.buildSchedule.call({ annotations: [B(0, 500), B(900, 4200)] });
    expect(m.endMs()).toBe(4200);
  });

  it('rend 0 pour une planification vide', () => {
    const m = new AnnotationManager({ annotations: [] }, null);
    expect(m.endMs()).toBe(0);
  });
});
