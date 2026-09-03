import { describe, expect, it } from "vitest";

const { resoudreTransition, nomsTransitions } = require("./transitions");

const W = 1000;
const H = 500;
const SORTANTE = { nom: "sortante" } as never;
const ENTRANTE = { nom: "entrante" } as never;

/** Contexte espion : enregistre les dessins au lieu de les peindre. */
function ctxEspion() {
  const appels: { img: string; x: number; y: number; alpha: number }[] = [];
  let alpha = 1;
  return {
    appels,
    get globalAlpha() { return alpha; },
    set globalAlpha(v: number) { alpha = v; },
    save() {},
    restore() { alpha = 1; },
    drawImage(img: { nom: string }, x: number, y: number) {
      // `|| 0` ramene le zero NEGATIF a zero : a t = 0, -Math.round(H * 0)
      // vaut -0, que toEqual distingue de 0 alors que le rendu est identique.
      appels.push({ img: img.nom, x: x || 0, y: y || 0, alpha });
    },
  };
}

const jouer = (nom: string, t: number) => {
  const fn = resoudreTransition(nom);
  const ctx = ctxEspion();
  fn(ctx, SORTANTE, ENTRANTE, t, W, H);
  return ctx.appels;
};

describe("resoudreTransition", () => {
  it("expose les six transitions attendues", () => {
    expect(nomsTransitions().sort()).toEqual(
      ["cut", "fade", "slidedown", "slideleft", "slideright", "slideup"].sort(),
    );
  });

  it("rend null pour 'none' et pour l'absence de nom", () => {
    expect(resoudreTransition("none")).toBeNull();
    expect(resoudreTransition("")).toBeNull();
    expect(resoudreTransition(undefined)).toBeNull();
  });

  it("retombe sur le fondu pour un nom inconnu", () => {
    expect(resoudreTransition("explode")).toBe(resoudreTransition("fade"));
  });

  it("normalise la casse et les espaces", () => {
    expect(resoudreTransition("Slide Up")).toBe(resoudreTransition("slideup"));
  });
});

describe("cut", () => {
  it("montre la sortante avant la moitie, l'entrante apres", () => {
    expect(jouer("cut", 0.2)).toEqual([{ img: "sortante", x: 0, y: 0, alpha: 1 }]);
    expect(jouer("cut", 0.8)).toEqual([{ img: "entrante", x: 0, y: 0, alpha: 1 }]);
  });
});

describe("fade", () => {
  it("superpose l'entrante avec une opacite egale a t", () => {
    expect(jouer("fade", 0)).toEqual([
      { img: "sortante", x: 0, y: 0, alpha: 1 },
      { img: "entrante", x: 0, y: 0, alpha: 0 },
    ]);
    expect(jouer("fade", 0.5)).toEqual([
      { img: "sortante", x: 0, y: 0, alpha: 1 },
      { img: "entrante", x: 0, y: 0, alpha: 0.5 },
    ]);
    expect(jouer("fade", 1)).toEqual([
      { img: "sortante", x: 0, y: 0, alpha: 1 },
      { img: "entrante", x: 0, y: 0, alpha: 1 },
    ]);
  });
});

describe("glissements", () => {
  it("slideup : la sortante monte, l'entrante la suit par le bas", () => {
    expect(jouer("slideup", 0.5)).toEqual([
      { img: "sortante", x: 0, y: -250, alpha: 1 },
      { img: "entrante", x: 0, y: 250, alpha: 1 },
    ]);
  });

  it("slidedown : symetrique du precedent", () => {
    expect(jouer("slidedown", 0.5)).toEqual([
      { img: "sortante", x: 0, y: 250, alpha: 1 },
      { img: "entrante", x: 0, y: -250, alpha: 1 },
    ]);
  });

  it("slideleft : deplacement horizontal, pas vertical", () => {
    expect(jouer("slideleft", 0.5)).toEqual([
      { img: "sortante", x: -500, y: 0, alpha: 1 },
      { img: "entrante", x: 500, y: 0, alpha: 1 },
    ]);
  });

  it("slideright : symetrique du precedent", () => {
    expect(jouer("slideright", 0.5)).toEqual([
      { img: "sortante", x: 500, y: 0, alpha: 1 },
      { img: "entrante", x: -500, y: 0, alpha: 1 },
    ]);
  });

  it("part de la sortante en place et finit sur l'entrante en place", () => {
    for (const nom of ["slideup", "slidedown", "slideleft", "slideright"]) {
      const debut = jouer(nom, 0);
      const fin = jouer(nom, 1);
      expect(debut[0]).toEqual({ img: "sortante", x: 0, y: 0, alpha: 1 });
      expect(fin[1]).toEqual({ img: "entrante", x: 0, y: 0, alpha: 1 });
    }
  });
});
