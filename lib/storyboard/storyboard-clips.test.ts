import { describe, expect, it } from "vitest";
import type { StoryboardPanel } from "./schema";
import { panelsToStepState } from "./storyboard-clips";

const panel = (over: Partial<StoryboardPanel> = {}): StoryboardPanel =>
  ({
    id: "p0",
    title: "Ma vraie scene",
    clipType: "intro",
    imageUrl: "/mon-vrai-visuel.png",
    prompt: "mon vrai prompt",
    narration: "ma vraie narration",
    visualPrompt: "mon vrai prompt visuel",
    duration: 10,
    isGenerating: false,
    ...over,
  }) as StoryboardPanel;

describe("panelsToStepState", () => {
  it("rend le travail enregistre, visuels compris", () => {
    const state = panelsToStepState([panel()]);

    expect(state.clips[0].title).toBe("Ma vraie scene");
    expect(state.clips[0].duration).toBe(10);
    expect(state.images).toEqual(["/mon-vrai-visuel.png"]);
  });

  it("aligne images et clips index par index", () => {
    const state = panelsToStepState([
      panel({ id: "a", imageUrl: "/a.png" }),
      panel({ id: "b", imageUrl: "" }),
      panel({ id: "c", imageUrl: "/c.png" }),
    ]);

    expect(state.images).toEqual(["/a.png", "", "/c.png"]);
    expect(state.clips).toHaveLength(3);
    expect(state.clips.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it("comble un panneau ancien sans titre ni duree", () => {
    const [clip] = panelsToStepState([
      { id: "", imageUrl: "", prompt: "p" } as StoryboardPanel,
    ]).clips;

    expect(clip.id).toBe("clip-0");
    expect(clip.title).toBe("Clip 1");
    expect(clip.duration).toBe(5);
  });

  it("rend les temps de narration et la voix deja produite", () => {
    const [clip] = panelsToStepState([
      panel({
        audioUrl: "/scene.mp3",
        beats: [
          {
            narration: "n",
            durationSec: 5,
            audioUrl: "/0-0.mp3",
            audioDurationMs: 6552,
          },
        ],
      }),
    ]).clips;

    expect(clip.audioUrl).toBe("/scene.mp3");
    expect(clip.beats).toHaveLength(1);
    expect(clip.beats?.[0].audioDurationMs).toBe(6552);
  });

  it("laisse un panneau sans temps sans en inventer", () => {
    expect(panelsToStepState([panel()]).clips[0].beats).toBeUndefined();
  });
});
