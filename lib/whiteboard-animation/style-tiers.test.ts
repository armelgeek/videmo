import { describe, expect, it } from "vitest";
import { isPremiumStyle, premiumStylesIn } from "./style-tiers";

describe("isPremiumStyle", () => {
  it("lets the four free styles through, whatever their spelling", () => {
    for (const s of ["chunkjump", "chunk-jump", "Contour", "scanner", "outlineonly"]) {
      expect(isPremiumStyle(s)).toBe(false);
    }
  });

  it("treats any other style as premium, even unknown", () => {
    for (const s of ["scribble", "illust-fill", "spec-text", "nouveau-style"]) {
      expect(isPremiumStyle(s)).toBe(true);
    }
  });

  it("requires nothing when no style is chosen", () => {
    expect(isPremiumStyle(undefined)).toBe(false);
    expect(isPremiumStyle("")).toBe(false);
  });
});

describe("premiumStylesIn", () => {
  it("finds a premium style hidden in a layer annotation", () => {
    const project = {
      animStyle: "contour",
      scenes: [
        { animStyle: "scanner", layers: [{ animStyle: "contour", annotations: [{ animStyle: "scribble" }] }] },
        { annotations: [{ animStyle: "chunk-jump" }, { animStyle: "gesture" }] },
      ],
    };
    expect(premiumStylesIn(project).sort()).toEqual(["gesture", "scribble"]);
  });

  it("flags nothing for a project using only free styles", () => {
    expect(premiumStylesIn({ scenes: [{ animStyle: "outlineonly" }] })).toEqual([]);
  });
});
