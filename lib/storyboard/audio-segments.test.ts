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

const temps = (over: Record<string, unknown>) =>
  ({ narration: "n", durationSec: 1, ...over }) as never;

describe("panelAudioSegments", () => {
  it("entre dans le fichier la ou l'image commence", () => {
    // Le script est dit d'une traite : sans decalage, chaque image rejouerait
    // la narration depuis le debut.
    expect(
      panelAudioSegments(
        panel({
          audioUrl: "/tout.mp3",
          beats: [
            temps({ audioUrl: "/tout.mp3", startMs: 4000, audioDurationMs: 2000 }),
            temps({ audioUrl: "/tout.mp3", startMs: 6000, audioDurationMs: 1500 }),
          ],
        }),
      ),
    ).toEqual([{ url: "/tout.mp3", offsetSec: 4, durationSec: 3.5 }]);
  });

  it("pose la voix de l'image sur toute sa duree mesuree", () => {
    expect(
      panelAudioSegments(panel({ audioUrl: "/scene.mp3", audioDurationMs: 6552 })),
    ).toEqual([{ url: "/scene.mp3", offsetSec: 0, durationSec: 6.552 }]);
  });

  it("retombe sur la duree du decoupage quand la mesure a echoue", () => {
    expect(panelAudioSegments(panel({ audioUrl: "/scene.mp3" }))).toEqual([
      { url: "/scene.mp3", offsetSec: 0, durationSec: 10 },
    ]);
  });

  it("ne rend rien quand l'image n'a aucune voix", () => {
    expect(panelAudioSegments(panel())).toEqual([]);
  });
});
