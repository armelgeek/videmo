import { describe, expect, it } from 'vitest';

const { regionWeights, repartirDurees } = require('./poids-region');

type Annot = { text?: string; region?: { width: number; height: number } };

const annot = (text: string, width: number, height: number): Annot => ({
  text,
  region: { width, height },
});

const total = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

describe('regionWeights', () => {
  it('returns one weight per annotation, summing to 1', () => {
    const weights = regionWeights([
      annot('un titre', 100, 100),
      annot('une legende beaucoup plus longue', 400, 300),
      annot('', 200, 200),
    ]);

    expect(weights).toHaveLength(3);
    expect(total(weights)).toBeCloseTo(1, 10);
  });

  it('gives more time to the region with the most to read and draw', () => {
    const [small, large] = regionWeights([
      annot('bref', 50, 50),
      annot('un texte nettement plus long a lire', 500, 400),
    ]);

    expect(large).toBeGreaterThan(small);
  });

  it('ranks by area when no region has text', () => {
    const [small, large] = regionWeights([
      annot('', 100, 100),
      annot('', 300, 300),
    ]);

    expect(large).toBeGreaterThan(small);
  });

  it('ranks by text when no region has dimensions', () => {
    const weights = regionWeights([
      { text: 'court' },
      { text: 'un texte bien plus long que le precedent' },
    ]);

    expect(weights[1]).toBeGreaterThan(weights[0]);
  });

  it('stays uniform without text or dimensions: nothing breaks the tie', () => {
    expect(regionWeights([{}, {}, {}])).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('never lets a region drop to zero', () => {
    const weights = regionWeights([
      annot('', 0, 0),
      annot('un texte qui prend tout le budget', 900, 900),
    ]);

    expect(weights[0]).toBeGreaterThan(0);
    expect(total(weights)).toBeCloseTo(1, 10);
  });

  it('favours text over area, per the 70/30 split', () => {
    // All the text on the left, all the surface on the right. Text weighs 70%,
    // so it must win.
    const [text, surface] = regionWeights([
      annot('beaucoup de texte ici meme', 10, 10),
      annot('', 1000, 1000),
    ]);

    expect(text).toBeGreaterThan(surface);
  });

  it('returns an empty list for an empty list', () => {
    expect(regionWeights([])).toEqual([]);
  });
});

describe('repartirDurees', () => {
  it('distributes the requested budget', () => {
    const durations = repartirDurees(
      [annot('un', 100, 100), annot('deux mots', 200, 200)],
      10000,
    );

    expect(total(durations)).toBeGreaterThan(9900);
    expect(total(durations)).toBeLessThan(10100);
  });

  it('respects the per-region floor', () => {
    const durations = repartirDurees(
      [annot('', 1, 1), annot('un texte tres long qui occupe tout', 900, 900)],
      1000,
      200,
    );

    expect(Math.min(...durations)).toBeGreaterThanOrEqual(200);
  });

  it('pays for the floor from the other regions, without inflating the budget', () => {
    // The small region falls below the floor and must be raised. That time is
    // taken from the large one: otherwise the video silently grows longer.
    const durations = repartirDurees(
      [annot('', 1, 1), annot('un texte tres long qui occupe tout', 900, 900)],
      2000,
      200,
    );

    expect(total(durations)).toBe(2000);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(200);
  });

  it('drops to the floor everywhere when the budget cannot hold it', () => {
    const durations = repartirDurees([annot('a', 10, 10), annot('b', 10, 10)], 100, 200);

    expect(durations).toEqual([200, 200]);
  });
});
