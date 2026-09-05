import { describe, expect, it } from "vitest";
import type { StoryboardPanel } from "./schema";
import type { ScriptScene } from "./script-generation";
import {
  panelsToStepState,
  resolveStepState,
  scenesToStepState,
} from "./storyboard-clips";

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

const scene = (over: Partial<ScriptScene> = {}): ScriptScene => ({
  index: 0,
  clipType: "intro",
  title: "Scene du script",
  narration: "narration du script",
  imagePrompt: "prompt image du script",
  duration: 12,
  visualDescription: "",
  keyElements: [],
  ...over,
});

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
});

describe("scenesToStepState", () => {
  it("amorce l'etape depuis le script", () => {
    const state = scenesToStepState([scene()]);

    expect(state.clips[0].title).toBe("Scene du script");
    expect(state.clips[0].visualPrompt).toBe("prompt image du script");
    expect(state.clips[0].duration).toBe(12);
  });

  it("n'invente aucun visuel", () => {
    expect(scenesToStepState([scene(), scene({ index: 1 })]).images).toEqual([
      "",
      "",
    ]);
  });
});

describe("resolveStepState", () => {
  it("prefere les panneaux au script", () => {
    // Les panneaux portent les visuels produits et les retouches faites ici,
    // que le script ne connait pas.
    const state = resolveStepState({ panels: [panel()], scenes: [scene()] });

    expect(state.clips[0].title).toBe("Ma vraie scene");
    expect(state.images).toEqual(["/mon-vrai-visuel.png"]);
  });

  it("retombe sur le script quand aucun panneau n'existe", () => {
    const state = resolveStepState({ panels: [], scenes: [scene()] });

    expect(state.clips[0].title).toBe("Scene du script");
  });

  it("rend un etat vide plutot que des donnees de demonstration", () => {
    // Le fallback de demo ecrasait le projet en base a la premiere frappe.
    expect(resolveStepState({ panels: [], scenes: [] })).toEqual({
      clips: [],
      images: [],
    });
  });
});
