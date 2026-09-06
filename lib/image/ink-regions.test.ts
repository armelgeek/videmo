import { describe, expect, it } from "vitest";
import { inkRegions } from "./ink-regions";

/** Une page blanche ou l'on pose des rectangles d'encre. */
function page(width: number, height: number) {
  const luminance = new Uint8Array(width * height).fill(255);
  return {
    luminance,
    width,
    height,
    trace(x: number, y: number, w: number, h: number) {
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) luminance[j * width + i] = 0;
      }
      return this;
    },
  };
}

describe("inkRegions", () => {
  it("rend le rectangle exact d'un sujet, sans le papier autour", () => {
    const p = page(400, 400).trace(100, 50, 80, 120);

    const [region] = inkRegions({
      luminance: p.luminance,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(region).toMatchObject({ x: 100, y: 50, width: 80, height: 120 });
  });

  it("separe deux sujets eloignes", () => {
    const p = page(400, 400).trace(20, 20, 60, 60).trace(300, 300, 60, 60);

    const regions = inkRegions({
      luminance: p.luminance,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(regions).toHaveLength(2);
    expect(regions.map((r) => r.x).sort((a, b) => a - b)).toEqual([20, 300]);
  });

  it("reunit deux traits voisins : un contour et sa fente valent un sujet", () => {
    const p = page(400, 400).trace(100, 100, 40, 40).trace(145, 100, 40, 40);

    const regions = inkRegions({
      luminance: p.luminance,
      width: 400,
      height: 400,
      gap: 20,
    });

    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 100, y: 100, width: 85, height: 40 });
  });

  it("ecarte une poussiere du papier", () => {
    const p = page(400, 400).trace(100, 100, 100, 100).trace(380, 10, 2, 2);

    const regions = inkRegions({
      luminance: p.luminance,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(regions).toHaveLength(1);
    expect(regions[0].width).toBe(100);
  });

  it("donne le sujet le plus dessine en premier", () => {
    const p = page(400, 400).trace(20, 20, 30, 30).trace(200, 200, 120, 120);

    const regions = inkRegions({
      luminance: p.luminance,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(regions[0]).toMatchObject({ x: 200, width: 120 });
  });

  it("rend une liste vide sur une page blanche", () => {
    const p = page(200, 200);

    expect(
      inkRegions({ luminance: p.luminance, width: 200, height: 200 }),
    ).toEqual([]);
  });

  it("ne prend pas un gris clair pour de l'encre", () => {
    const p = page(200, 200).trace(50, 50, 60, 60);
    p.luminance.fill(200, 0, 200); // une premiere ligne grisatre

    const regions = inkRegions({
      luminance: p.luminance,
      width: 200,
      height: 200,
      gap: 10,
    });

    expect(regions).toHaveLength(1);
    expect(regions[0].y).toBe(50);
  });
});
