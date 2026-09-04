import { describe, expect, it } from "vitest";
import { planSeek } from "./plan-seek";

// Trois regions de 400 ms, avec une pause de 200 ms entre chacune.
const SCHEDULE = [
  { startMs: 0, endMs: 400 },
  { startMs: 600, endMs: 1000 },
  { startMs: 1200, endMs: 1600 },
];

describe("planSeek", () => {
  it("rejoue depuis zero sans annotations", () => {
    expect(planSeek([], 900)).toEqual({
      stampRegions: [], stampAll: false, primeAt: 0, advance: { from: 0, to: 900 },
    });
  });

  it("n'anime que la region courante et estampille les precedentes", () => {
    expect(planSeek(SCHEDULE, 1300)).toEqual({
      stampRegions: [0, 1], stampAll: false, primeAt: 1200,
      advance: { from: 1200, to: 1300 },
    });
  });

  it("borne le rejeu a la duree d'UNE region ou que l'on cherche", () => {
    const duree = (ms: number) => {
      const p = planSeek(SCHEDULE, ms);
      return p.advance ? p.advance.to - p.advance.from : 0;
    };
    // Sans le correctif ces valeurs seraient 200, 800 et 1500 : croissantes.
    expect([duree(200), duree(800), duree(1500)]).toEqual([200, 200, 300]);
    for (const ms of [0, 137, 399, 700, 999, 1201, 1599]) {
      expect(duree(ms)).toBeLessThanOrEqual(400);
    }
  });

  it("dans une pause : rien a animer, la main disparait", () => {
    expect(planSeek(SCHEDULE, 500)).toEqual({
      stampRegions: [0], stampAll: false, primeAt: 500, advance: null,
    });
  });

  it("au-dela de la derniere region : estampiller toute l'image", () => {
    expect(planSeek(SCHEDULE, 2000)).toEqual({
      stampRegions: [], stampAll: true, primeAt: 2000, advance: null,
    });
  });

  it("a la frontiere exacte d'une region, on entre dans celle-ci", () => {
    expect(planSeek(SCHEDULE, 600)).toEqual({
      stampRegions: [0], stampAll: false, primeAt: 600,
      advance: { from: 600, to: 600 },
    });
  });

  it("borne a zero une position negative", () => {
    expect(planSeek(SCHEDULE, -50).primeAt).toBe(0);
  });
});
