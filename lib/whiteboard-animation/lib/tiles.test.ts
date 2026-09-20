import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tuilesPourRegion } = require("./AnimationUtils");

/** Reproduces the buildTileWaypoints grid to read its stroke radius. */
function strokeRadius(w: number, h: number, n: number) {
  const cols = Math.max(2, Math.round(Math.sqrt(n * (w / h))));
  const rows = Math.max(2, Math.round(n / cols));
  return Math.max(5, Math.round(Math.min(w / cols, h / rows) * 0.18));
}

/** The four regions of the reference scene, in canvas pixels. */
const REGIONS: [string, number, number][] = [
  ["title", 567, 98],
  ["bag", 583, 206],
  ["label", 180, 240],
  ["question mark", 190, 320],
];

describe("tuilesPourRegion", () => {
  it("gives the same stroke radius on every region", () => {
    // With a fixed tile COUNT (the old Chunks slider at 30) the radius
    // ranged from 6 to 12: the pen thickness changed from one region to another.
    const radii = REGIONS.map(([, w, h]) =>
      strokeRadius(w, h, tuilesPourRegion({ w, h })),
    );
    expect(new Set(radii).size).toBe(1);
  });

  it("old fixed setting: the radius really did drift", () => {
    const radii = REGIONS.map(([, w, h]) => strokeRadius(w, h, 30));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(1);
  });

  it("asks for more tiles for a larger region", () => {
    expect(tuilesPourRegion({ w: 600, h: 400 })).toBeGreaterThan(
      tuilesPourRegion({ w: 200, h: 150 }),
    );
  });

  it("stays within usable bounds at the extremes", () => {
    // A tiny region must not drop to 0 tiles, a full-canvas region must not
    // blow up the waypoint count.
    expect(tuilesPourRegion({ w: 4, h: 4 })).toBeGreaterThanOrEqual(4);
    expect(tuilesPourRegion({ w: 1920, h: 1080 })).toBeLessThanOrEqual(400);
  });

  it("handles degenerate dimensions without throwing", () => {
    expect(() => tuilesPourRegion({ w: 0, h: 0 })).not.toThrow();
    expect(tuilesPourRegion({ w: 0, h: 0 })).toBeGreaterThanOrEqual(4);
  });
});
