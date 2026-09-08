import { describe, expect, it } from "vitest";

import { deriveTimeline } from "./derive-timeline";
import { sansAttenteInitiale } from "./sans-attente-initiale";

const annotation = (id: string, durationMs: number, gapBeforeMs: number) =>
  ({
    id,
    region: { x: 0, y: 0, w: 10, h: 10 },
    reveal: { durationMs, gapBeforeMs },
  }) as any;

describe("sansAttenteInitiale", () => {
  it("fait demarrer le trace a zero", () => {
    const derive = deriveTimeline(
      sansAttenteInitiale([annotation("a", 5000, 1300)]),
    );
    expect(derive.annotations[0].reveal.from).toBe(0);
  });

  it("laisse les intervalles entre annotations intacts", () => {
    const derive = deriveTimeline(
      sansAttenteInitiale([
        annotation("a", 1000, 1300),
        annotation("b", 1000, 400),
      ]),
    );
    expect(derive.annotations[1].reveal.from).toBe(1400);
  });

  /**
   * Les cinq clips du projet mesure. Avant correction, la duree du trace
   * depassait la fenetre exactement de l'attente initiale : le clip se
   * terminait avant la fin du dessin.
   */
  it.each([
    ["clip 2", 1300, 18168],
    ["clip 3", 0, 15264],
    ["clip 4", 1868, 12500],
    ["clip 5", 2092, 26520],
    ["clip 6", 1940, 36648],
  ])("%s : la duree du trace epouse la fenetre", (_nom, attente, fenetre) => {
    const derive = deriveTimeline(
      sansAttenteInitiale([annotation("a", fenetre, attente)]),
    );
    expect(derive.totalDurationMs).toBe(fenetre);
  });

  it("rend la sequence telle quelle sans attente initiale", () => {
    const sequence = [annotation("a", 1000, 0)];
    expect(sansAttenteInitiale(sequence)).toBe(sequence);
  });

  it("supporte une sequence vide", () => {
    expect(sansAttenteInitiale([])).toEqual([]);
  });
});
