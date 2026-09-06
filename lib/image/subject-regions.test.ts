import { describe, expect, it } from "vitest";
import { contrastToBackground, subjectRegions } from "./subject-regions";

/** Une page unie ou l'on pose des rectangles qui s'en detachent. */
function page(width: number, height: number, fond = 0) {
  const contrast = new Uint8Array(width * height).fill(fond);
  return {
    contrast,
    width,
    height,
    trace(x: number, y: number, w: number, h: number, ecart = 255) {
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) contrast[j * width + i] = ecart;
      }
      return this;
    },
  };
}

/** Une image RGBA unie, ou l'on peint des rectangles d'une autre couleur. */
function toile(width: number, height: number, fond: [number, number, number]) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = fond[0];
    rgba[i * 4 + 1] = fond[1];
    rgba[i * 4 + 2] = fond[2];
    rgba[i * 4 + 3] = 255;
  }
  return {
    rgba,
    width,
    height,
    peindre(x: number, y: number, w: number, h: number, c: [number, number, number]) {
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
          const p = (j * width + i) * 4;
          rgba[p] = c[0];
          rgba[p + 1] = c[1];
          rgba[p + 2] = c[2];
        }
      }
      return this;
    },
  };
}

describe("subjectRegions", () => {
  it("rend le rectangle exact d'un sujet, sans le fond autour", () => {
    const p = page(400, 400).trace(100, 50, 80, 120);

    const [region] = subjectRegions({
      contrast: p.contrast,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(region).toMatchObject({ x: 100, y: 50, width: 80, height: 120 });
  });

  it("separe deux sujets eloignes", () => {
    const p = page(400, 400).trace(20, 20, 60, 60).trace(300, 300, 60, 60);

    const regions = subjectRegions({
      contrast: p.contrast,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(regions).toHaveLength(2);
    expect(regions.map((r) => r.x).sort((a, b) => a - b)).toEqual([20, 300]);
  });

  it("reunit deux traits voisins : un contour et sa fente valent un sujet", () => {
    const p = page(400, 400).trace(100, 100, 40, 40).trace(145, 100, 40, 40);

    const regions = subjectRegions({
      contrast: p.contrast,
      width: 400,
      height: 400,
      gap: 20,
    });

    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 100, y: 100, width: 85, height: 40 });
  });

  it("ecarte une poussiere du fond", () => {
    const p = page(400, 400).trace(100, 100, 100, 100).trace(380, 10, 2, 2);

    const regions = subjectRegions({
      contrast: p.contrast,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(regions).toHaveLength(1);
    expect(regions[0].width).toBe(100);
  });

  it("donne le sujet le plus dessine en premier", () => {
    const p = page(400, 400).trace(20, 20, 30, 30).trace(200, 200, 120, 120);

    const regions = subjectRegions({
      contrast: p.contrast,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(regions[0]).toMatchObject({ x: 200, width: 120 });
  });

  it("rend une liste vide sur une image unie", () => {
    const p = page(200, 200);

    expect(
      subjectRegions({ contrast: p.contrast, width: 200, height: 200 }),
    ).toEqual([]);
  });

  it("ne prend pas une variation legere du fond pour un sujet", () => {
    const p = page(200, 200).trace(0, 0, 200, 4, 40).trace(50, 50, 60, 60);

    const regions = subjectRegions({
      contrast: p.contrast,
      width: 200,
      height: 200,
      gap: 10,
    });

    expect(regions).toHaveLength(1);
    expect(regions[0].y).toBe(50);
  });
});

describe("contrastToBackground", () => {
  it("lit le fond sur le bord, et mesure l'ecart a cette couleur", () => {
    const t = toile(100, 100, [255, 255, 255]).peindre(20, 20, 30, 30, [0, 0, 0]);

    const { background, contrast } = contrastToBackground(t);

    expect(background).toEqual([255, 255, 255]);
    expect(contrast[25 * 100 + 25]).toBe(255);
    expect(contrast[90 * 100 + 90]).toBe(0);
  });

  it("voit un sujet clair sur un fond sombre", () => {
    const t = toile(100, 100, [10, 10, 10]).peindre(30, 30, 20, 20, [240, 240, 240]);

    const { background, contrast } = contrastToBackground(t);

    expect(background).toEqual([10, 10, 10]);
    expect(contrast[35 * 100 + 35]).toBe(230);
  });

  it("voit un sujet colore de meme clarte que le fond", () => {
    // Rouge sur vert : meme luminance, donc invisible tant qu'on ne regardait
    // que le gris. C'est ce cas qui limitait la methode au whiteboard.
    const t = toile(100, 100, [0, 200, 0]).peindre(30, 30, 20, 20, [200, 0, 0]);

    const { contrast } = contrastToBackground(t);
    const regions = subjectRegions({ contrast, width: 100, height: 100, gap: 5 });

    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 30, y: 30, width: 20, height: 20 });
  });

  it("ne se laisse pas deplacer par un sujet qui touche le bord", () => {
    const t = toile(100, 100, [250, 250, 250]).peindre(0, 0, 20, 100, [0, 0, 0]);

    expect(contrastToBackground(t).background).toEqual([250, 250, 250]);
  });

  it("rend un seul sujet couvrant tout sur une image sans fond uni", () => {
    // Une peinture pleine page : le repli voulu, une zone trop large plutot
    // qu'aucune annotation.
    const t = toile(60, 60, [255, 255, 255]);
    for (let i = 0; i < 60 * 60; i++) {
      t.rgba[i * 4] = (i * 7) % 256;
      t.rgba[i * 4 + 1] = (i * 13) % 256;
      t.rgba[i * 4 + 2] = (i * 29) % 256;
    }

    const { contrast } = contrastToBackground(t);
    const regions = subjectRegions({ contrast, width: 60, height: 60, gap: 10 });

    expect(regions).toHaveLength(1);
    expect(regions[0].width).toBeGreaterThan(50);
  });
});
