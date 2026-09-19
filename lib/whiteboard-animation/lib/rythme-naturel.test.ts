import { describe, it, expect } from 'vitest';

const { calculerDureeNaturelle } = require('./rythme-naturel');

describe('calculerDureeNaturelle', () => {
  // ---------------------------------------------------------------
  // AC-1 : Petite région avec longue fenêtre audio → durée courte
  // ---------------------------------------------------------------
  it('petite région (100×50) avec fenêtre 5000ms → résultat entre 300ms et 1500ms', () => {
    const result = calculerDureeNaturelle({ width: 100, height: 50 }, 5000);
    expect(result).toBeGreaterThanOrEqual(300);
    expect(result).toBeLessThanOrEqual(1500);
  });

  // ---------------------------------------------------------------
  // AC-2 : Grande région mais fenêtre audio courte → plafonnée à la fenêtre
  // ---------------------------------------------------------------
  it('grande région nécessitant >700ms mais audio 700ms → résultat ≤ 700ms', () => {
    const result = calculerDureeNaturelle({ width: 2000, height: 1500 }, 700);
    expect(result).toBeLessThanOrEqual(700);
    expect(result).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // AC-3 : La durée ne dépasse jamais la fenêtre allouée
  // ---------------------------------------------------------------
  it('la durée ne dépasse jamais durationMs', () => {
    const durations = [200, 500, 1000, 3000, 8000];
    for (const d of durations) {
      const result = calculerDureeNaturelle({ width: 300, height: 200 }, d);
      expect(result).toBeLessThanOrEqual(d);
    }
  });

  // ---------------------------------------------------------------
  // AC-4 : Plancher minimum de 300ms (sauf si fenêtre < 300ms)
  // ---------------------------------------------------------------
  it('plancher de 300ms pour une durée >= 300ms', () => {
    const result = calculerDureeNaturelle({ width: 10, height: 10 }, 5000);
    expect(result).toBeGreaterThanOrEqual(300);
  });

  it('si la fenêtre est < 300ms, le plancher est la fenêtre elle-même', () => {
    // durationMs=150 → le min(300, 150)=150 est le plancher
    const result = calculerDureeNaturelle({ width: 10, height: 10 }, 150);
    expect(result).toBeLessThanOrEqual(150);
    expect(result).toBeGreaterThanOrEqual(100); // dureeFenetre floor=100
  });

  // ---------------------------------------------------------------
  // AC-5 : Rôle texte avec long texte → bonus caractères
  // ---------------------------------------------------------------
  it('rôle "text" avec 30 caractères → durée supérieure au calcul par aire seule', () => {
    const sansTexte = calculerDureeNaturelle({ width: 200, height: 40 }, 5000);
    const avecTexte = calculerDureeNaturelle({ width: 200, height: 40 }, 5000, {
      role: 'text',
      text: 'Ceci est un texte assez long !',
    });
    expect(avecTexte).toBeGreaterThanOrEqual(sansTexte);
  });

  // ---------------------------------------------------------------
  // AC-6 : Rôle title → même logique de bonus texte
  // ---------------------------------------------------------------
  it('rôle "title" avec texte utilise le bonus caractères', () => {
    const avecTitre = calculerDureeNaturelle({ width: 150, height: 40 }, 5000, {
      role: 'title',
      text: 'Introduction au chapitre',
    });
    // 23 caractères × 40ms = 920ms + 300ms = 1220ms, arrondi ≥ 1200ms
    expect(avecTitre).toBeGreaterThanOrEqual(1200);
  });

  // ---------------------------------------------------------------
  // AC-7 : revealType "fill" → multiplicateur ×1.15
  // ---------------------------------------------------------------
  it('revealType "fill" → durée supérieure au même calcul sans fill', () => {
    const sansFill = calculerDureeNaturelle({ width: 400, height: 300 }, 5000);
    const avecFill = calculerDureeNaturelle({ width: 400, height: 300 }, 5000, {
      revealType: 'fill',
    });
    expect(avecFill).toBeGreaterThan(sansFill);
  });

  // ---------------------------------------------------------------
  // AC-8 : Plafond naturel de 2.5s → jamais > 2500ms
  // ---------------------------------------------------------------
  it('même une énorme région ne dépasse pas 2500ms de geste naturel', () => {
    const result = calculerDureeNaturelle({ width: 10000, height: 10000 }, 20000);
    expect(result).toBeLessThanOrEqual(2500);
  });

  // ---------------------------------------------------------------
  // AC-9 : Support { w, h } en plus de { width, height }
  // ---------------------------------------------------------------
  it('accepte { w, h } comme format alternatif', () => {
    const a = calculerDureeNaturelle({ width: 300, height: 200 }, 3000);
    const b = calculerDureeNaturelle({ w: 300, h: 200 }, 3000);
    expect(a).toBe(b);
  });

  // ---------------------------------------------------------------
  // AC-10 : Cas limites — region null/undefined → fallback
  // ---------------------------------------------------------------
  it('region null → utilise les valeurs par défaut (100×100) sans crash', () => {
    expect(() => calculerDureeNaturelle(null, 2000)).not.toThrow();
    const result = calculerDureeNaturelle(null, 2000);
    expect(result).toBeGreaterThanOrEqual(300);
    expect(result).toBeLessThanOrEqual(2000);
  });

  it('durationMs omis → utilise 1000ms par défaut', () => {
    const result = calculerDureeNaturelle({ width: 100, height: 100 });
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1000);
  });
});
