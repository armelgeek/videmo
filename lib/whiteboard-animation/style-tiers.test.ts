import { describe, expect, it } from "vitest";
import { isPremiumStyle, premiumStylesIn } from "./style-tiers";

describe("isPremiumStyle", () => {
  it("laisse passer les quatre styles gratuits, quelle que soit leur graphie", () => {
    for (const s of ["chunkjump", "chunk-jump", "Contour", "scanner", "outlineonly"]) {
      expect(isPremiumStyle(s)).toBe(false);
    }
  });

  it("traite tout autre style comme premium, meme inconnu", () => {
    for (const s of ["scribble", "illust-fill", "spec-text", "nouveau-style"]) {
      expect(isPremiumStyle(s)).toBe(true);
    }
  });

  it("n'exige rien quand aucun style n'est choisi", () => {
    expect(isPremiumStyle(undefined)).toBe(false);
    expect(isPremiumStyle("")).toBe(false);
  });
});

describe("premiumStylesIn", () => {
  it("trouve un style premium cache dans une annotation de calque", () => {
    const project = {
      animStyle: "contour",
      scenes: [
        { animStyle: "scanner", layers: [{ animStyle: "contour", annotations: [{ animStyle: "scribble" }] }] },
        { annotations: [{ animStyle: "chunk-jump" }, { animStyle: "gesture" }] },
      ],
    };
    expect(premiumStylesIn(project).sort()).toEqual(["gesture", "scribble"]);
  });

  it("ne signale rien pour un projet tout en styles gratuits", () => {
    expect(premiumStylesIn({ scenes: [{ animStyle: "outlineonly" }] })).toEqual([]);
  });
});
