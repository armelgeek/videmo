import { describe, expect, it } from "vitest";
import {
  PETIT_COTE,
  cssAspectRatio,
  rectContenu,
  reprojeterRegion,
  tailleCanvas,
} from "./canvas-size";

describe("tailleCanvas", () => {
  it("garde le petit cote constant sur les trois formats", () => {
    // La resolution est un choix d'export : seule la FORME change entre les
    // ratios, pas la densite de l'apercu.
    for (const r of ["16:9", "9:16", "1:1"] as const) {
      const { width, height } = tailleCanvas(r);
      expect(Math.min(width, height)).toBe(PETIT_COTE);
    }
  });

  it("donne les dimensions conventionnelles", () => {
    expect(tailleCanvas("16:9")).toEqual({ width: 1280, height: 720 });
    expect(tailleCanvas("9:16")).toEqual({ width: 720, height: 1280 });
    expect(tailleCanvas("1:1")).toEqual({ width: 720, height: 720 });
  });

  it("retombe sur 16:9 pour un ratio inconnu ou absent", () => {
    expect(tailleCanvas(undefined)).toEqual({ width: 1280, height: 720 });
    expect(tailleCanvas("4:3")).toEqual({ width: 1280, height: 720 });
  });

  it("expose un aspect-ratio CSS coherent avec le canvas", () => {
    expect(cssAspectRatio("9:16")).toBe("720 / 1280");
    expect(cssAspectRatio("16:9")).toBe("1280 / 720");
  });
});

describe("rectContenu", () => {
  it("remplit exactement un canvas de meme ratio", () => {
    expect(rectContenu(1280, 720, 1280, 720)).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });

  it("centre l'artwork sans le deformer en portrait", () => {
    // Scene 16:9 dans un canvas 9:16 : elle occupe toute la largeur et se
    // centre verticalement. L'ancien rendu l'ecrasait sur toute la hauteur.
    const r = rectContenu(720, 1280, 1280, 720);
    expect(r.w).toBe(720);
    expect(r.h).toBe(405);
    expect(r.x).toBe(0);
    expect(r.y).toBe(Math.round((1280 - 405) / 2));
    expect(r.w / r.h).toBeCloseTo(1280 / 720, 2);
  });

  it("preserve le ratio source sur les trois formats", () => {
    for (const ratio of ["16:9", "9:16", "1:1"] as const) {
      const { width, height } = tailleCanvas(ratio);
      const r = rectContenu(width, height, 1280, 720);
      expect(r.w / r.h).toBeCloseTo(1280 / 720, 2);
      expect(r.w).toBeLessThanOrEqual(width);
      expect(r.h).toBeLessThanOrEqual(height);
    }
  });

  it("ne divise pas par zero sur une source degeneree", () => {
    expect(rectContenu(1280, 720, 0, 0)).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });
});

describe("reprojeterRegion", () => {
  const paysage = rectContenu(1280, 720, 1280, 720);
  const portrait = rectContenu(720, 1280, 1280, 720);

  it("garde la region au meme endroit RELATIF a l'artwork", () => {
    // Une region qui couvre le quart haut-gauche doit le couvrir encore.
    const region = { x: 0, y: 0, width: 640, height: 360 };
    const r = reprojeterRegion(region, paysage, portrait);
    expect(r.width / portrait.w).toBeCloseTo(0.5, 2);
    expect(r.height / portrait.h).toBeCloseTo(0.5, 2);
    expect(r.x).toBe(portrait.x);
    expect(r.y).toBe(portrait.y);
  });

  it("ne deforme pas : les deux axes suivent la meme echelle", () => {
    const region = { x: 100, y: 100, width: 200, height: 200 };
    const r = reprojeterRegion(region, paysage, portrait);
    expect(r.width).toBe(r.height);
  });

  it("fait un aller-retour sans deriver", () => {
    const region = { x: 120, y: 80, width: 300, height: 150 };
    const aller = reprojeterRegion(region, paysage, portrait);
    const retour = reprojeterRegion(aller, portrait, paysage);
    for (const k of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(retour[k] - region[k])).toBeLessThanOrEqual(2);
    }
  });

  it("laisse la region intacte si le rectangle de depart est degenere", () => {
    const region = { x: 1, y: 2, width: 3, height: 4 };
    expect(reprojeterRegion(region, { x: 0, y: 0, w: 0, h: 0 }, portrait)).toEqual(region);
  });
});
