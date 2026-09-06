import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildNarrationFilter } = require("./narration-mix");

describe("buildNarrationFilter", () => {
  it("retarde chaque temps de son debut absolu, puis les melange", () => {
    const { filter, sortie } = buildNarrationFilter([
      { startMs: 0 },
      { startMs: 4656 },
    ]);

    expect(filter).toBe(
      "[1:a]adelay=0:all=1[n0];[2:a]adelay=4656:all=1[n1];" +
        "[n0][n1]amix=inputs=2:normalize=0[narration]",
    );
    expect(sortie).toBe("[narration]");
  });

  it("garde le volume : sans normalize=0, amix le divise par le nombre d'entrees", () => {
    const { filter } = buildNarrationFilter([{ startMs: 0 }, { startMs: 1 }, { startMs: 2 }]);

    expect(filter).toContain("amix=inputs=3:normalize=0");
  });

  it("ne fabrique aucun filtre pour un seul temps qui part de zero", () => {
    expect(buildNarrationFilter([{ startMs: 0 }])).toBeNull();
  });

  it("en fabrique un des qu'un seul temps commence plus tard", () => {
    expect(buildNarrationFilter([{ startMs: 800 }])).not.toBeNull();
  });

  it("rend null sans aucun temps", () => {
    expect(buildNarrationFilter([])).toBeNull();
    expect(buildNarrationFilter(null)).toBeNull();
  });

  it("decale les index quand la video n'occupe pas la premiere entree", () => {
    const { filter } = buildNarrationFilter([{ startMs: 0 }, { startMs: 500 }], 3);

    expect(filter).toContain("[3:a]");
    expect(filter).toContain("[4:a]");
  });
});
