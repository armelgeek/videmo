import { describe, expect, it } from "vitest";
import { PETIT_COTE, cssAspectRatio, tailleCanvas } from "./canvas-size";

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
