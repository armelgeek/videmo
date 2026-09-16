import { describe, expect, it } from 'vitest';

const { poidsRegions, repartirDurees } = require('./poids-region');

type Annot = { text?: string; region?: { width: number; height: number } };

const annot = (text: string, width: number, height: number): Annot => ({
  text,
  region: { width, height },
});

const total = (xs: number[]) => xs.reduce((t, x) => t + x, 0);

describe('poidsRegions', () => {
  it('rend un poids par annotation, de somme 1', () => {
    const poids = poidsRegions([
      annot('un titre', 100, 100),
      annot('une legende beaucoup plus longue', 400, 300),
      annot('', 200, 200),
    ]);

    expect(poids).toHaveLength(3);
    expect(total(poids)).toBeCloseTo(1, 10);
  });

  it('donne plus de temps a la region qui a le plus a lire et a tracer', () => {
    const [petite, grande] = poidsRegions([
      annot('bref', 50, 50),
      annot('un texte nettement plus long a lire', 500, 400),
    ]);

    expect(grande).toBeGreaterThan(petite);
  });

  it('classe par aire quand aucune region n a de texte', () => {
    const [petite, grande] = poidsRegions([
      annot('', 100, 100),
      annot('', 300, 300),
    ]);

    expect(grande).toBeGreaterThan(petite);
  });

  it('classe par texte quand aucune region n a de dimensions', () => {
    const poids = poidsRegions([
      { text: 'court' },
      { text: 'un texte bien plus long que le precedent' },
    ]);

    expect(poids[1]).toBeGreaterThan(poids[0]);
  });

  it('reste uniforme sans texte ni dimensions : rien ne departage', () => {
    expect(poidsRegions([{}, {}, {}])).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('ne laisse aucune region tomber a zero', () => {
    const poids = poidsRegions([
      annot('', 0, 0),
      annot('un texte qui prend tout le budget', 900, 900),
    ]);

    expect(poids[0]).toBeGreaterThan(0);
    expect(total(poids)).toBeCloseTo(1, 10);
  });

  it('privilegie le texte sur l aire, conformement au 70/30', () => {
    // A gauche tout le texte, a droite toute la surface. Le texte pese 70%,
    // il doit donc l'emporter.
    const [texte, surface] = poidsRegions([
      annot('beaucoup de texte ici meme', 10, 10),
      annot('', 1000, 1000),
    ]);

    expect(texte).toBeGreaterThan(surface);
  });

  it('rend une liste vide pour une liste vide', () => {
    expect(poidsRegions([])).toEqual([]);
  });
});

describe('repartirDurees', () => {
  it('distribue le budget demande', () => {
    const durees = repartirDurees(
      [annot('un', 100, 100), annot('deux mots', 200, 200)],
      10000,
    );

    expect(total(durees)).toBeGreaterThan(9900);
    expect(total(durees)).toBeLessThan(10100);
  });

  it('respecte le plancher par region', () => {
    const durees = repartirDurees(
      [annot('', 1, 1), annot('un texte tres long qui occupe tout', 900, 900)],
      1000,
      200,
    );

    expect(Math.min(...durees)).toBeGreaterThanOrEqual(200);
  });

  it('paie le plancher sur les autres regions, sans gonfler le budget', () => {
    // La petite region tombe sous le plancher et doit etre relevee. Ce temps
    // se prend sur la grande : sans cela la video s'allonge en silence.
    const durees = repartirDurees(
      [annot('', 1, 1), annot('un texte tres long qui occupe tout', 900, 900)],
      2000,
      200,
    );

    expect(total(durees)).toBe(2000);
    expect(Math.min(...durees)).toBeGreaterThanOrEqual(200);
  });

  it('tombe au plancher partout quand le budget ne peut pas le tenir', () => {
    const durees = repartirDurees([annot('a', 10, 10), annot('b', 10, 10)], 100, 200);

    expect(durees).toEqual([200, 200]);
  });
});
