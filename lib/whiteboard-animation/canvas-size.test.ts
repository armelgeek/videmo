import { describe, expect, it } from "vitest";
import {
  PETIT_COTE,
  cssAspectRatio,
  rectContenu,
  reprojeterRegion,
  canvasSize,
} from "./canvas-size";

describe("canvasSize", () => {
  it("keeps the short side constant across the three formats", () => {
    // Resolution is an export choice: only the SHAPE changes between ratios,
    // not the preview density.
    for (const r of ["16:9", "9:16", "1:1"] as const) {
      const { width, height } = canvasSize(r);
      expect(Math.min(width, height)).toBe(PETIT_COTE);
    }
  });

  it("gives the conventional dimensions", () => {
    expect(canvasSize("16:9")).toEqual({ width: 1280, height: 720 });
    expect(canvasSize("9:16")).toEqual({ width: 720, height: 1280 });
    expect(canvasSize("1:1")).toEqual({ width: 720, height: 720 });
  });

  it("falls back to 16:9 for an unknown or missing ratio", () => {
    expect(canvasSize(undefined)).toEqual({ width: 1280, height: 720 });
    expect(canvasSize("4:3")).toEqual({ width: 1280, height: 720 });
  });

  it("exposes a CSS aspect-ratio consistent with the canvas", () => {
    expect(cssAspectRatio("9:16")).toBe("720 / 1280");
    expect(cssAspectRatio("16:9")).toBe("1280 / 720");
  });
});

describe("rectContenu", () => {
  it("exactly fills a canvas of the same ratio", () => {
    expect(rectContenu(1280, 720, 1280, 720)).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });

  it("centers the artwork without distorting it in portrait", () => {
    // 16:9 scene in a 9:16 canvas: it takes the full width and is centered
    // vertically. The old render squashed it over the full height.
    const r = rectContenu(720, 1280, 1280, 720);
    expect(r.w).toBe(720);
    expect(r.h).toBe(405);
    expect(r.x).toBe(0);
    expect(r.y).toBe(Math.round((1280 - 405) / 2));
    expect(r.w / r.h).toBeCloseTo(1280 / 720, 2);
  });

  it("preserves the source ratio across the three formats", () => {
    for (const ratio of ["16:9", "9:16", "1:1"] as const) {
      const { width, height } = canvasSize(ratio);
      const r = rectContenu(width, height, 1280, 720);
      expect(r.w / r.h).toBeCloseTo(1280 / 720, 2);
      expect(r.w).toBeLessThanOrEqual(width);
      expect(r.h).toBeLessThanOrEqual(height);
    }
  });

  it("does not divide by zero on a degenerate source", () => {
    expect(rectContenu(1280, 720, 0, 0)).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });
});

describe("reprojeterRegion", () => {
  const landscape = rectContenu(1280, 720, 1280, 720);
  const portrait = rectContenu(720, 1280, 1280, 720);

  it("keeps the region at the same place RELATIVE to the artwork", () => {
    // A region covering the top-left quarter must still cover it.
    const region = { x: 0, y: 0, width: 640, height: 360 };
    const r = reprojeterRegion(region, landscape, portrait);
    expect(r.width / portrait.w).toBeCloseTo(0.5, 2);
    expect(r.height / portrait.h).toBeCloseTo(0.5, 2);
    expect(r.x).toBe(portrait.x);
    expect(r.y).toBe(portrait.y);
  });

  it("does not distort: both axes follow the same scale", () => {
    const region = { x: 100, y: 100, width: 200, height: 200 };
    const r = reprojeterRegion(region, landscape, portrait);
    expect(r.width).toBe(r.height);
  });

  it("round-trips without drifting", () => {
    const region = { x: 120, y: 80, width: 300, height: 150 };
    const there = reprojeterRegion(region, landscape, portrait);
    const back = reprojeterRegion(there, portrait, landscape);
    for (const k of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(back[k] - region[k])).toBeLessThanOrEqual(2);
    }
  });

  it("leaves the region intact if the source rectangle is degenerate", () => {
    const region = { x: 1, y: 2, width: 3, height: 4 };
    expect(reprojeterRegion(region, { x: 0, y: 0, w: 0, h: 0 }, portrait)).toEqual(region);
  });
});
