import { describe, expect, it } from "vitest";
import { narrationDurationMs, narrationParts } from "./narration-track";
import type { StoryboardPanel } from "@/lib/storyboard/schema";

const panel = (over: Partial<StoryboardPanel> = {}): StoryboardPanel =>
  ({ id: "p", imageUrl: "", prompt: "p", duration: 5, isGenerating: false, ...over }) as StoryboardPanel;

const beat = (over: Record<string, unknown>) =>
  ({ narration: "n", durationSec: 1, ...over }) as never;

describe("narrationParts", () => {
  it("returns ONE recording when several images share it", () => {
    // The script is read in one take: two images, a single voice.
    const parts = narrationParts([
      panel({
        id: "a",
        audioUrl: "/tout.mp3",
        beats: [beat({ audioUrl: "/tout.mp3", startMs: 0, audioDurationMs: 4000 })],
      }),
      panel({
        id: "b",
        audioUrl: "/tout.mp3",
        beats: [beat({ audioUrl: "/tout.mp3", startMs: 4000, audioDurationMs: 3000 })],
      }),
    ]);

    expect(parts).toEqual([{ url: "/tout.mp3", durationMs: 7000 }]);
    expect(narrationDurationMs(parts)).toBe(7000);
  });

  it("falls back to the split duration when measurement failed", () => {
    expect(narrationParts([panel({ audioUrl: "/a.mp3", duration: 4 })])).toEqual([
      { url: "/a.mp3", durationMs: 4000 },
    ]);
  });

  it("skips an image left without a voice", () => {
    expect(narrationParts([panel(), panel({ audioUrl: "/b.mp3", audioDurationMs: 900 })]))
      .toEqual([{ url: "/b.mp3", durationMs: 900 }]);
  });

  it("separates two recordings when the budget forced a cut", () => {
    // The beats point to different voices: that change marks the boundary,
    // and each recording lasts until the end of the last beat it carries.
    const parts = narrationParts([
      panel({
        audioUrl: "/un.mp3",
        beats: [
          beat({ audioUrl: "/un.mp3", startMs: 0, audioDurationMs: 3000 }),
          beat({ audioUrl: "/un.mp3", startMs: 3000, audioDurationMs: 1500 }),
          beat({ audioUrl: "/deux.mp3", startMs: 0, audioDurationMs: 2200 }),
        ],
      }),
    ]);

    expect(parts).toEqual([
      { url: "/un.mp3", durationMs: 4500 },
      { url: "/deux.mp3", durationMs: 2200 },
    ]);
  });

  it("returns nothing when no voice was produced", () => {
    expect(narrationParts([panel()])).toEqual([]);
  });
});
