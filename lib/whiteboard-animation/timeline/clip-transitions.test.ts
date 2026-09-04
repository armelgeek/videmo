import { describe, expect, it } from "vitest";
import { transitionAt, type ClipWindow } from "./clip-transitions";

/** A finit a 1000, B commence a 1300 : le blanc disponible vaut 300 ms. */
const paire = (): ClipWindow[] => [
  { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 2300 } },
  { startMs: 1300, endMs: 2000 },
];

describe("transitionAt", () => {
  it("plafonne la duree au blanc disponible", () => {
    // 2300 ms demandes, 300 ms disponibles. A mi-blanc (1150), t doit valoir
    // 0.5 ; si la duree demandee etait honoree, t vaudrait ~0.065.
    expect(transitionAt(paire(), 1150)).toEqual({ name: "fade", t: 0.5 });
  });

  it("demarre a 0 des la fin du clip sortant", () => {
    expect(transitionAt(paire(), 1000)).toEqual({ name: "fade", t: 0 });
  });

  it("s'arrete avant le debut du clip entrant", () => {
    expect(transitionAt(paire(), 1299)).not.toBeNull();
    expect(transitionAt(paire(), 1300)).toBeNull();
  });

  it("ne rend rien a l'interieur d'un clip", () => {
    expect(transitionAt(paire(), 500)).toBeNull();
  });

  it("ignore un clip marque none", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "none", durationMs: 300 } },
      { startMs: 1300, endMs: 2000 },
    ];
    expect(transitionAt(clips, 1150)).toBeNull();
  });

  it("ignore deux clips jointifs, faute de blanc", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "fade", durationMs: 300 } },
      { startMs: 1000, endMs: 2000 },
    ];
    expect(transitionAt(clips, 1000)).toBeNull();
  });

  it("ne rend rien apres le dernier clip", () => {
    expect(transitionAt(paire(), 2500)).toBeNull();
  });

  it("utilise la totalite du blanc disponible pour la transition", () => {
    const clips: ClipWindow[] = [
      { startMs: 0, endMs: 1000, transition: { type: "slideup", durationMs: 100 } },
      { startMs: 1300, endMs: 2000 },
    ];
    expect(transitionAt(clips, 1150)).toEqual({ name: "slideup", t: 0.5 });
    expect(transitionAt(clips, 1300)).toBeNull();
  });
});
