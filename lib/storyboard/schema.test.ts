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

  /**
   * z.object retire ce qu'il ne declare pas : sans ce champ, la voix produite
   * par temps disparaissait au premier enregistrement, sans erreur.
   */
  it("conserve les temps de narration et leur voix", () => {
    const parsed = storyboardPanelSchema.parse({
      ...panneau,
      beats: [
        {
          narration: "n",
          durationSec: 5,
          audioUrl: "https://bac/0-0.mp3",
          audioDurationMs: 6552,
        },
      ],
    });

    expect(parsed.beats?.[0].audioUrl).toBe("https://bac/0-0.mp3");
    expect(parsed.beats?.[0].audioDurationMs).toBe(6552);
  });

  it("accepte un panneau sans temps — les projets anterieurs restent valides", () => {
    expect(storyboardPanelSchema.parse(panneau).beats).toBeUndefined();
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
