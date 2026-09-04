import { describe, expect, it } from "vitest";
import { rectContenu } from "./canvas-size";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { rectContenu: rectContenuJS } = require("./canvas-size-runtime");

/**
 * Le worker est un process Node nu : il ne sait pas charger canvas-size.ts.
 * La copie CommonJS est donc inevitable — ce test interdit qu'elle derive.
 */
describe("parite rectContenu TypeScript / CommonJS", () => {
  const cas: [number, number, number, number][] = [
    [1280, 720, 1920, 1080],
    [1280, 720, 720, 1280],
    [720, 1280, 1920, 1080],
    [720, 720, 1000, 500],
    [1920, 1080, 1000, 1000],
    [1280, 720, 1280, 720],
    [1280, 720, 0, 0],
    [1080, 1920, 3, 7],
  ];

  it.each(cas)("canvas %ix%i, source %ix%i", (cw, ch, sw, sh) => {
    expect(rectContenuJS(cw, ch, sw, sh)).toEqual(rectContenu(cw, ch, sw, sh));
  });
});
