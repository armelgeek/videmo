import { describe, expect, it } from "vitest";
import { narrationDurationMs, narrationParts } from "./narration-track";
import type { StoryboardPanel } from "@/lib/storyboard/schema";

const panel = (over: Partial<StoryboardPanel> = {}): StoryboardPanel =>
  ({ id: "p", imageUrl: "", prompt: "p", duration: 5, isGenerating: false, ...over }) as StoryboardPanel;

describe("narrationParts", () => {
  it("rend un enregistrement par image, dans l'ordre du film", () => {
    const parts = narrationParts([
      panel({ id: "a", audioUrl: "/a.mp3", audioDurationMs: 5112 }),
      panel({ id: "b", audioUrl: "/b.mp3", audioDurationMs: 7032 }),
    ]);

    expect(parts).toEqual([
      { url: "/a.mp3", durationMs: 5112 },
      { url: "/b.mp3", durationMs: 7032 },
    ]);
    expect(narrationDurationMs(parts)).toBe(12144);
  });

  it("retombe sur la duree du decoupage quand la mesure a echoue", () => {
    expect(narrationParts([panel({ audioUrl: "/a.mp3", duration: 4 })])).toEqual([
      { url: "/a.mp3", durationMs: 4000 },
    ]);
  });

  it("saute une image restee sans voix", () => {
    expect(narrationParts([panel(), panel({ audioUrl: "/b.mp3", audioDurationMs: 900 })]))
      .toEqual([{ url: "/b.mp3", durationMs: 900 }]);
  });

  it("ne rend rien quand aucune voix n'a ete produite", () => {
    expect(narrationParts([panel()])).toEqual([]);
  });
});
