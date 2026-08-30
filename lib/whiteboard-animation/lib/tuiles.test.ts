import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tuilesPourRegion } = require("./AnimationUtils");

/** Reproduit la grille de buildTileWaypoints pour en lire le rayon de trait. */
function rayonDuTrait(w: number, h: number, n: number) {
  const cols = Math.max(2, Math.round(Math.sqrt(n * (w / h))));
  const rows = Math.max(2, Math.round(n / cols));
  return Math.max(5, Math.round(Math.min(w / cols, h / rows) * 0.18));
}

/** Les quatre regions de la scene de reference, en pixels de canvas. */
const REGIONS: [string, number, number][] = [
  ["titre", 567, 98],
  ["sac", 583, 206],
  ["etiquette", 180, 240],
  ["point d'interrogation", 190, 320],
];

describe("tuilesPourRegion", () => {
  it("donne le meme rayon de trait sur toutes les regions", () => {
    // Avec un NOMBRE de tuiles fixe (l'ancien curseur Chunks a 30) le rayon
    // allait de 6 a 12 : le stylo changeait d'epaisseur d'une region a l'autre.
    const rayons = REGIONS.map(([, w, h]) =>
      rayonDuTrait(w, h, tuilesPourRegion({ w, h })),
    );
    expect(new Set(rayons).size).toBe(1);
  });

  it("ancien reglage fixe : le rayon derivait bel et bien", () => {
    const rayons = REGIONS.map(([, w, h]) => rayonDuTrait(w, h, 30));
    expect(Math.max(...rayons) - Math.min(...rayons)).toBeGreaterThan(1);
  });

  it("demande plus de tuiles pour une region plus grande", () => {
    expect(tuilesPourRegion({ w: 600, h: 400 })).toBeGreaterThan(
      tuilesPourRegion({ w: 200, h: 150 }),
    );
  });

  it("reste dans des bornes exploitables aux extremes", () => {
    // Une region minuscule ne doit pas tomber a 0 tuile, une region plein
    // canvas ne doit pas exploser le nombre de waypoints.
    expect(tuilesPourRegion({ w: 4, h: 4 })).toBeGreaterThanOrEqual(4);
    expect(tuilesPourRegion({ w: 1920, h: 1080 })).toBeLessThanOrEqual(400);
  });

  it("ignore des dimensions degenerees sans lever", () => {
    expect(() => tuilesPourRegion({ w: 0, h: 0 })).not.toThrow();
    expect(tuilesPourRegion({ w: 0, h: 0 })).toBeGreaterThanOrEqual(4);
  });
});
