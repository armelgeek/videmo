import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { toNaturalSpace } = require("./region-space");

describe("toNaturalSpace", () => {
  it("rend la region que la projection du serveur ramenera au meme endroit", () => {
    // L'apercu enregistre en pixels de canvas (1280x720). Le serveur projette
    // ensuite par layer.w / naturalWidth. Pour que le resultat retombe sur le
    // pixel voulu, on divise d'abord par l'echelle du canvas.
    const r = toNaturalSpace(
      { x: 640, y: 360, width: 200, height: 100 },
      { width: 1280, height: 720 },   // espace des annotations
      { width: 640, height: 360 },    // taille naturelle de l'image
    );
    expect(r).toEqual({ x: 320, y: 180, width: 100, height: 50 });

    // Aller-retour : la projection du serveur (x * canvasW / naturalW) doit
    // redonner la coordonnee d'origine.
    const canvasW = 1280, naturalW = 640;
    expect(r.x * (canvasW / naturalW)).toBe(640);
  });

  it("ne touche a rien quand l'espace vaut deja la taille naturelle", () => {
    const region = { x: 10, y: 20, width: 30, height: 40 };
    expect(
      toNaturalSpace(region, { width: 800, height: 600 }, { width: 800, height: 600 }),
    ).toEqual(region);
  });

  it("rend la region inchangee si l'espace est inconnu", () => {
    const region = { x: 10, y: 20, width: 30, height: 40 };
    expect(toNaturalSpace(region, null, { width: 800, height: 600 })).toEqual(region);
    expect(toNaturalSpace(region, { width: 0, height: 0 }, { width: 800, height: 600 })).toEqual(region);
  });
});
