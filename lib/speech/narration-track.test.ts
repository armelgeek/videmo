import { describe, expect, it } from "vitest";
import { narrationDurationMs, narrationParts } from "./narration-track";
import type { StoryboardPanel } from "@/lib/storyboard/schema";

const panel = (over: Partial<StoryboardPanel> = {}): StoryboardPanel =>
  ({ id: "p", imageUrl: "", prompt: "p", duration: 5, isGenerating: false, ...over }) as StoryboardPanel;

const temps = (over: Record<string, unknown>) =>
  ({ narration: "n", durationSec: 1, ...over }) as never;

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

  it("separe les enregistrements d'une image dite en plusieurs fois", () => {
    // Les temps designent des voix differentes : c'est ce changement qui
    // marque la frontiere, et chaque enregistrement dure jusqu'a la fin du
    // dernier temps qu'il porte.
    const parts = narrationParts([
      panel({
        audioUrl: "/un.mp3",
        beats: [
          temps({ audioUrl: "/un.mp3", startMs: 0, audioDurationMs: 3000 }),
          temps({ audioUrl: "/un.mp3", startMs: 3000, audioDurationMs: 1500 }),
          temps({ audioUrl: "/deux.mp3", startMs: 0, audioDurationMs: 2200 }),
        ],
      }),
    ]);

    expect(parts).toEqual([
      { url: "/un.mp3", durationMs: 4500 },
      { url: "/deux.mp3", durationMs: 2200 },
    ]);
  });

  it("ne rend rien quand aucune voix n'a ete produite", () => {
    expect(narrationParts([panel()])).toEqual([]);
  });
});
