import { describe, expect, it } from "vitest";
import { segmentWindows } from "./script-segments-card";

describe("segmentWindows", () => {
  it("places a later scene's beats on its recording, not on the scene start", () => {
    // One recording for the whole script: scene 2's beats sit 20s into it.
    const parts = [{ url: "voice.mp3", startMs: 0, durationMs: 40_000 }];
    const panel = {
      beats: [
        { narration: "Second scene opens.", durationSec: 5, audioUrl: "voice.mp3", startMs: 20_000, audioDurationMs: 4_000 },
        { narration: "Then it goes on.", durationSec: 5, audioUrl: "voice.mp3", startMs: 24_000, audioDurationMs: 6_000 },
      ],
    };

    expect(segmentWindows(panel, parts, 20_000)).toEqual([
      { text: "Second scene opens.", startMs: 20_000, endMs: 24_000 },
      { text: "Then it goes on.", startMs: 24_000, endMs: 30_000 },
    ]);
  });

  it("adds the recording's own start when the script spans several recordings", () => {
    const parts = [
      { url: "a.mp3", startMs: 0, durationMs: 30_000 },
      { url: "b.mp3", startMs: 30_000, durationMs: 20_000 },
    ];
    const panel = {
      beats: [{ narration: "From the second file.", durationSec: 5, audioUrl: "b.mp3", startMs: 2_000, audioDurationMs: 3_000 }],
    };

    expect(segmentWindows(panel, parts, 31_000)).toEqual([
      { text: "From the second file.", startMs: 32_000, endMs: 35_000 },
    ]);
  });

  it("chains estimated durations from the scene start before any voice exists", () => {
    const panel = {
      beats: [
        { narration: "One.", durationSec: 2 },
        { narration: "Two.", durationSec: 3 },
      ],
    };

    expect(segmentWindows(panel, [], 10_000)).toEqual([
      { text: "One.", startMs: 10_000, endMs: 12_000 },
      { text: "Two.", startMs: 12_000, endMs: 15_000 },
    ]);
  });
});
