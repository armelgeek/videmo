import { describe, expect, it } from "vitest";
import { panelAudioSegments } from "./audio-segments";
import type { StoryboardPanel } from "./schema";

const panel = (over: Partial<StoryboardPanel> = {}): StoryboardPanel =>
  ({
    id: "p0",
    imageUrl: "/i.png",
    prompt: "p",
    duration: 10,
    isGenerating: false,
    ...over,
  }) as StoryboardPanel;

describe("panelAudioSegments", () => {
  it("place chaque temps a la suite du precedent, sur les durees mesurees", () => {
    const segments = panelAudioSegments(
      panel({
        beats: [
          {
            narration: "a",
            durationSec: 5,
            audioUrl: "/0.mp3",
            audioDurationMs: 6552,
          },
          {
            narration: "b",
            durationSec: 3,
            audioUrl: "/1.mp3",
            audioDurationMs: 2500,
          },
        ],
      }),
    );

    expect(segments).toEqual([
      { url: "/0.mp3", offsetSec: 0, durationSec: 6.552, beatIndex: 0 },
      { url: "/1.mp3", offsetSec: 6.552, durationSec: 2.5, beatIndex: 1 },
    ]);
  });

  it("retombe sur l'estimation du decoupage quand la mesure a echoue", () => {
    const [segment] = panelAudioSegments(
      panel({
        beats: [{ narration: "a", durationSec: 4, audioUrl: "/0.mp3" }],
      }),
    );

    expect(segment.durationSec).toBe(4);
  });

  it("rend un seul morceau pour un projet enregistre avant le decoupage", () => {
    expect(panelAudioSegments(panel({ audioUrl: "/scene.mp3" }))).toEqual([
      { url: "/scene.mp3", offsetSec: 0, durationSec: 10 },
    ]);
  });

  it("laisse sa place a un temps muet plutot que d'avancer le suivant", () => {
    const segments = panelAudioSegments(
      panel({
        beats: [
          { narration: "muet", durationSec: 2 },
          { narration: "b", durationSec: 3, audioUrl: "/1.mp3" },
        ],
      }),
    );

    expect(segments).toEqual([
      { url: "/1.mp3", offsetSec: 2, durationSec: 3, beatIndex: 1 },
    ]);
  });

  it("ne rend rien quand l'image n'a aucune voix", () => {
    expect(panelAudioSegments(panel())).toEqual([]);
  });
});
