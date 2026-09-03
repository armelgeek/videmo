import { describe, expect, it } from "vitest";
import { storyboardPanelSchema } from "./schema";

const panneau = {
  id: "p1",
  imageUrl: "/a.png",
  prompt: "un sac",
};

describe("storyboardPanelSchema", () => {
  it("accepte un panneau sans transition — les projets existants restent valides", () => {
    const parsed = storyboardPanelSchema.parse(panneau);
    expect(parsed.transition).toBeUndefined();
  });

  it("accepte une transition complete", () => {
    const parsed = storyboardPanelSchema.parse({
      ...panneau,
      transition: { type: "slideup", durationMs: 300 },
    });
    expect(parsed.transition).toEqual({ type: "slideup", durationMs: 300 });
  });

  it("refuse un nom de transition inconnu", () => {
    expect(() =>
      storyboardPanelSchema.parse({
        ...panneau,
        transition: { type: "explode", durationMs: 300 },
      }),
    ).toThrow();
  });

  it("refuse une duree negative", () => {
    expect(() =>
      storyboardPanelSchema.parse({
        ...panneau,
        transition: { type: "fade", durationMs: -1 },
      }),
    ).toThrow();
  });
});
