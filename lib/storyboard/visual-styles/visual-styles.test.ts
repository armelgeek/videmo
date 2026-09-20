import { describe, expect, it } from "vitest";
import {
  BUILT_IN_VISUAL_STYLES,
  DEFAULT_VISUAL_STYLE_ID,
  builtInVisualStyle,
  isBuiltInVisualStyle,
} from "./built-in";
import { untraceableTermIn, visualStyleInputSchema } from "./schema";

describe("shipped visual styles", () => {
  it("have unique ids", () => {
    const ids = BUILT_IN_VISUAL_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("include the default", () => {
    expect(isBuiltInVisualStyle(DEFAULT_VISUAL_STYLE_ID)).toBe(true);
  });

  it("never ask for something the pen cannot trace", () => {
    // Every shipped style must pass the same rule a user's style has to.
    const offending = BUILT_IN_VISUAL_STYLES.filter((s) => untraceableTermIn(s.artDirection));
    expect(offending.map((s) => s.id)).toEqual([]);
  });

  it("fall back to the default for an unknown id", () => {
    expect(builtInVisualStyle("removed").id).toBe(DEFAULT_VISUAL_STYLE_ID);
    expect(builtInVisualStyle(undefined).id).toBe(DEFAULT_VISUAL_STYLE_ID);
  });
});

describe("visualStyleInputSchema", () => {
  const valid = {
    key: "my-style",
    label: "Mine",
    hint: "Thin and calm.",
    artDirection: "Thin precise pen drawing, clean geometric shapes",
    accentColors: ["blue"],
    vocabulary: ["arrows"],
    labels: "every-subject" as const,
  };

  it("accepts a style the engine can trace", () => {
    expect(visualStyleInputSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["watercolor painting", "photorealistic portrait", "soft shadows", "neon glow", "cinematic lighting"])(
    "refuses %s, which becomes noise once traced",
    (artDirection) => {
      const result = visualStyleInputSchema.safeParse({ ...valid, artDirection });
      expect(result.success).toBe(false);
    },
  );

  it("says which word to remove", () => {
    const result = visualStyleInputSchema.safeParse({ ...valid, artDirection: "Soft watercolor washes on paper" });
    expect(result.success ? "" : result.error.issues[0].message).toContain("watercolor");
  });

  it("refuses a key that is not a slug", () => {
    expect(visualStyleInputSchema.safeParse({ ...valid, key: "My Style" }).success).toBe(false);
  });

  it("allows no accent colour at all", () => {
    expect(visualStyleInputSchema.safeParse({ ...valid, accentColors: [] }).success).toBe(true);
  });
});
