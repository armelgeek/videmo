import { describe, expect, it } from "vitest";
import { narrationDurationMs, narrationParts } from "./narration-track";
import type { StoryboardPanel } from "@/lib/storyboard/schema";

const panel = (over: Partial<StoryboardPanel> = {}): StoryboardPanel =>
  ({ id: "p", imageUrl: "", prompt: "p", duration: 5, isGenerating: false, ...over }) as StoryboardPanel;

describe("narrationParts", () => {
  it("suit l'ordre du film, images puis temps", () => {
    const parts = narrationParts([
      panel({
        id: "a",
        beats: [
          { narration: "un", durationSec: 1, audioUrl: "/a0.mp3", audioDurationMs: 1100 },
          { narration: "deux", durationSec: 2, audioUrl: "/a1.mp3", audioDurationMs: 2200 },
        ],
      }),
      panel({
        id: "b",
        beats: [
          { narration: "trois", durationSec: 3, audioUrl: "/b0.mp3", audioDurationMs: 3300 },
        ],
      }),
    ]);

    expect(parts.map((p) => p.url)).toEqual(["/a0.mp3", "/a1.mp3", "/b0.mp3"]);
    expect(narrationDurationMs(parts)).toBe(6600);
  });

  it("retombe sur l'estimation quand la mesure a echoue", () => {
    const [part] = narrationParts([
      panel({ beats: [{ narration: "un", durationSec: 4, audioUrl: "/a.mp3" }] }),
    ]);

    expect(part.durationMs).toBe(4000);
  });

  it("reprend la voix par image d'un projet anterieur au decoupage", () => {
    expect(narrationParts([panel({ audioUrl: "/scene.mp3", duration: 7 })])).toEqual([
      { url: "/scene.mp3", durationMs: 7000 },
    ]);
  });

  it("garde sa place a un temps muet, pour ne pas avancer les suivants", () => {
    const parts = narrationParts([
      panel({
        beats: [
          { narration: "muet", durationSec: 2 },
          { narration: "dit", durationSec: 3, audioUrl: "/b.mp3", audioDurationMs: 3000 },
        ],
      }),
    ]);

    expect(parts).toEqual([
      { url: null, durationMs: 2000 },
      { url: "/b.mp3", durationMs: 3000 },
    ]);
  });

  it("ne rend rien quand aucune voix n'a ete produite", () => {
    expect(narrationParts([panel()])).toEqual([]);
  });
});
