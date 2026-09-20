import { describe, expect, it } from "vitest";
import { storyboardPanelSchema } from "./schema";

const panneau = {
  id: "p1",
  imageUrl: "/a.png",
  prompt: "un sac",
};

describe("storyboardPanelSchema", () => {
  it("accepts a panel without transition — existing projects stay valid", () => {
    const parsed = storyboardPanelSchema.parse(panneau);
    expect(parsed.transition).toBeUndefined();
  });

  it("accepts a complete transition", () => {
    const parsed = storyboardPanelSchema.parse({
      ...panneau,
      transition: { type: "slideup", durationMs: 300 },
    });
    expect(parsed.transition).toEqual({ type: "slideup", durationMs: 300 });
  });

  it("rejects an unknown transition name", () => {
    expect(() =>
      storyboardPanelSchema.parse({
        ...panneau,
        transition: { type: "explode", durationMs: 300 },
      }),
    ).toThrow();
  });

  /**
   * z.object strips what it does not declare: without this field, the voice produced
   * per beat vanished on the first save, without any error.
   */
  it("keeps the narration beats and their voice", () => {
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

  it("accepts a panel without beats — older projects stay valid", () => {
    expect(storyboardPanelSchema.parse(panneau).beats).toBeUndefined();
  });

  it("rejects a negative duration", () => {
    expect(() =>
      storyboardPanelSchema.parse({
        ...panneau,
        transition: { type: "fade", durationMs: -1 },
      }),
    ).toThrow();
  });
});
