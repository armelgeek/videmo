import { describe, expect, it } from "vitest";
import { contrastToBackground, subjectRegions } from "./subject-regions";

/** A flat page on which rectangles that stand out are placed. */
function page(width: number, height: number, background = 0) {
  const contrast = new Uint8Array(width * height).fill(background);
  return {
    contrast,
    width,
    height,
    trace(x: number, y: number, w: number, h: number, value = 255) {
      for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) contrast[j * width + i] = value;
      }
      return this;
    },
  };
}

/** A flat RGBA image on which rectangles of another color are painted. */
function canvas(width: number, height: number, background: [number, number, number]) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = background[0];
    rgba[i * 4 + 1] = background[1];
    rgba[i * 4 + 2] = background[2];
    rgba[i * 4 + 3] = 255;
  }
  return {
    rgba,
    width,
    height,
    paint(x: number, y: number, w: number, h: number, c: [number, number, number]) {
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
  it("returns a subject's exact rectangle, without the surrounding background", () => {
    const p = page(400, 400).trace(100, 50, 80, 120);

    const [region] = subjectRegions({
      contrast: p.contrast,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(region).toMatchObject({ x: 100, y: 50, width: 80, height: 120 });
  });

  it("separates two distant subjects", () => {
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

  it("merges two neighboring strokes: an outline and its slit are one subject", () => {
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

  it("discards a background speck", () => {
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

  it("returns the most-drawn subject first", () => {
    const p = page(400, 400).trace(20, 20, 30, 30).trace(200, 200, 120, 120);

    const regions = subjectRegions({
      contrast: p.contrast,
      width: 400,
      height: 400,
      gap: 10,
    });

    expect(regions[0]).toMatchObject({ x: 200, width: 120 });
  });

  it("returns an empty list on a flat image", () => {
    const p = page(200, 200);

    expect(
      subjectRegions({ contrast: p.contrast, width: 200, height: 200 }),
    ).toEqual([]);
  });

  it("does not mistake a slight background variation for a subject", () => {
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
  it("reads the background on the edge, and measures contrast to that color", () => {
    const t = canvas(100, 100, [255, 255, 255]).paint(20, 20, 30, 30, [0, 0, 0]);

    const { background, contrast } = contrastToBackground(t);

    expect(background).toEqual([255, 255, 255]);
    expect(contrast[25 * 100 + 25]).toBe(255);
    expect(contrast[90 * 100 + 90]).toBe(0);
  });

  it("sees a light subject on a dark background", () => {
    const t = canvas(100, 100, [10, 10, 10]).paint(30, 30, 20, 20, [240, 240, 240]);

    const { background, contrast } = contrastToBackground(t);

    expect(background).toEqual([10, 10, 10]);
    expect(contrast[35 * 100 + 35]).toBe(230);
  });

  it("sees a colored subject with the same lightness as the background", () => {
    // Red on green: same luminance, so invisible while only grayscale was
    // considered. This case limited the method to the whiteboard.
    const t = canvas(100, 100, [0, 200, 0]).paint(30, 30, 20, 20, [200, 0, 0]);

    const { contrast } = contrastToBackground(t);
    const regions = subjectRegions({ contrast, width: 100, height: 100, gap: 5 });

    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ x: 30, y: 30, width: 20, height: 20 });
  });

  it("is not shifted by a subject touching the edge", () => {
    const t = canvas(100, 100, [250, 250, 250]).paint(0, 0, 20, 100, [0, 0, 0]);

    expect(contrastToBackground(t).background).toEqual([250, 250, 250]);
  });

  it("returns a single all-covering subject on an image without a flat background", () => {
    // A full-page painting: the intended fallback, an area too large rather
    // than no annotation.
    const t = canvas(60, 60, [255, 255, 255]);
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
