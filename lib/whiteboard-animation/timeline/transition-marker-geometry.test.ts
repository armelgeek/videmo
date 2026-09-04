import { describe, expect, it } from "vitest";
import { markerGeometry } from "./transition-marker-geometry";
import type { ClipWindow } from "./clip-transitions";

describe("markerGeometry", () => {
  it("place un marqueur dans le blanc, plafonne a sa largeur", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 2300 } },
      { startMs: 1300, endMs: 2000 }, // blanc de 300 ms
    ];
    // 1 px/ms pour des chiffres lisibles.
    expect(markerGeometry(clips, 1)).toEqual([{ panelIdx: 0, x: 1000, width: 300 }]);
  });

  it("occupe tout le blanc disponible entre les deux clips", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 100 } },
      { startMs: 1300, endMs: 2000 },
    ];
    expect(markerGeometry(clips, 1)).toEqual([{ panelIdx: 0, x: 1000, width: 300 }]);
  });

  it("ignore une frontiere sans transition ou marquee none", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000 },
      { startMs: 1300, endMs: 2000, transition: { type: "none", durationMs: 300 } },
      { startMs: 2300, endMs: 3000 },
    ];
    expect(markerGeometry(clips, 1)).toEqual([]);
  });

  it("ignore une frontiere sans blanc (clips jointifs)", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 300 } },
      { startMs: 1000, endMs: 2000 },
    ];
    expect(markerGeometry(clips, 1)).toEqual([]);
  });

  it("rend un marqueur par frontiere transitionnee, dans l'ordre", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 300 } },
      { startMs: 1300, endMs: 2300, transition: { type: "slideup", durationMs: 200 } },
      { startMs: 2500, endMs: 3500 },
    ];
    expect(markerGeometry(clips, 1)).toEqual([
      { panelIdx: 0, x: 1000, width: 300 },
      { panelIdx: 1, x: 2300, width: 200 },
    ]);
  });

  it("respecte l'echelle px/ms passee", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 300 } },
      { startMs: 1300, endMs: 2000 },
    ];
    expect(markerGeometry(clips, 0.5)).toEqual([{ panelIdx: 0, x: 500, width: 150 }]);
  });
});
