import { describe, expect, it } from "vitest";
import {
  narrationEndMs,
  nextNarrationAction,
  partAt,
  scheduleParts,
} from "./narration-schedule";

const parts = [
  { url: "/0.mp3", startMs: 0, durationMs: 1000 },
  { url: "/1.mp3", startMs: 1000, durationMs: 2000 },
];

describe("partAt", () => {
  it("rend le morceau qui couvre l'instant, et la position dedans", () => {
    expect(partAt(parts, 1500)).toEqual({
      index: 1,
      part: parts[1],
      offsetMs: 500,
    });
  });

  it("bascule sur le suivant des la frontiere, sans rejouer la fin", () => {
    expect(partAt(parts, 1000)?.index).toBe(1);
    expect(partAt(parts, 999)?.index).toBe(0);
  });

  it("ne joue rien apres le dernier morceau", () => {
    expect(partAt(parts, 3000)).toBeNull();
  });

  it("ne joue rien dans le trou laisse par un temps muet", () => {
    const avecTrou = [
      { url: "/0.mp3", startMs: 0, durationMs: 1000 },
      { url: "/2.mp3", startMs: 3000, durationMs: 1000 },
    ];

    expect(partAt(avecTrou, 2000)).toBeNull();
    expect(partAt(avecTrou, 3500)?.index).toBe(1);
  });

  it("ne joue rien avant le premier morceau", () => {
    expect(partAt([{ url: "/a.mp3", startMs: 500, durationMs: 100 }], 200)).toBeNull();
  });

  it("ne joue rien quand il n'y a aucun morceau", () => {
    expect(partAt([], 0)).toBeNull();
  });
});

describe("narrationEndMs", () => {
  it("rend la fin du dernier morceau", () => {
    expect(narrationEndMs(parts)).toBe(3000);
  });

  it("rend zero sans morceau", () => {
    expect(narrationEndMs([])).toBe(0);
  });
});

describe("scheduleParts", () => {
  it("pose les morceaux bout a bout", () => {
    expect(
      scheduleParts([
        { url: "/a.mp3", durationMs: 1100 },
        { url: "/b.mp3", durationMs: 2200 },
      ]),
    ).toEqual([
      { url: "/a.mp3", startMs: 0, durationMs: 1100 },
      { url: "/b.mp3", startMs: 1100, durationMs: 2200 },
    ]);
  });

  it("laisse un temps muet avancer le curseur sans rien poser", () => {
    expect(
      scheduleParts([
        { url: null, durationMs: 2000 },
        { url: "/b.mp3", durationMs: 1000 },
      ]),
    ).toEqual([{ url: "/b.mp3", startMs: 2000, durationMs: 1000 }]);
  });
});

describe("nextNarrationAction", () => {
  it("charge le morceau du moment quand aucun n'est en place", () => {
    expect(nextNarrationAction({ index: null, offsetMs: 0 }, parts, 1500)).toEqual({
      type: "charger",
      index: 1,
      part: parts[1],
      offsetMs: 500,
    });
  });

  it("ne fait rien tant que le bon morceau suit sa position", () => {
    expect(
      nextNarrationAction({ index: 1, offsetMs: 480 }, parts, 1500),
    ).toEqual({ type: "rien" });
  });

  it("recale sans recharger quand la position a derive", () => {
    expect(
      nextNarrationAction({ index: 1, offsetMs: 100 }, parts, 1500),
    ).toEqual({ type: "recaler", index: 1, offsetMs: 500 });
  });

  it("change de morceau a la frontiere", () => {
    const action = nextNarrationAction({ index: 0, offsetMs: 990 }, parts, 1010);

    expect(action).toMatchObject({ type: "charger", index: 1, offsetMs: 10 });
  });

  it("se tait dans un trou, sans decharger inutilement ensuite", () => {
    const avecTrou = [
      { url: "/0.mp3", startMs: 0, durationMs: 1000 },
      { url: "/2.mp3", startMs: 3000, durationMs: 1000 },
    ];

    expect(nextNarrationAction({ index: 0, offsetMs: 999 }, avecTrou, 2000)).toEqual({
      type: "taire",
    });
    // Une fois tu, on ne redemande pas de se taire a chaque frame.
    expect(nextNarrationAction({ index: null, offsetMs: 0 }, avecTrou, 2000)).toEqual({
      type: "rien",
    });
  });

  it("tolere une derive plus large si on le demande", () => {
    expect(
      nextNarrationAction({ index: 1, offsetMs: 100 }, parts, 1500, 1000),
    ).toEqual({ type: "rien" });
  });
});
