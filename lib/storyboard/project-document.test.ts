import { describe, expect, it } from "vitest";
import {
  assertNoEphemeralUrl,
  updateVideoProjectSchema,
} from "@/lib/video-project/schema";
import {
  fromLoadedProject,
  stripEphemeralUrls,
  toProjectPatch,
  type ProjectSlice,
} from "./project-document";
import { DEFAULT_WHITEBOARD_CONFIG } from "./store";

const slice: ProjectSlice = {
  step: "storyboard",
  projectTitle: "Mon projet",
  promptContent: "Une video sur le cafe",
  projectParams: {
    style: "cinematic",
    format: "explainer",
    aspectRatio: "9:16",
    language: "fr",
    duration: "3-5 minutes",
    targetAudience: "general",
    tone: "professional",
  },
  scriptTitle: "La torrefaction",
  scriptText: "Tout commence par un grain vert.\n\nPuis vient la chaleur.",
  storyboardPanels: [],
  selectedVoice: "onyx",
  whiteboardConfig: DEFAULT_WHITEBOARD_CONFIG,
};

describe("toProjectPatch", () => {
  it("carries the title, step and ratio in their columns", () => {
    const patch = toProjectPatch(slice);

    expect(patch.title).toBe("Mon projet");
    expect(patch.step).toBe("storyboard");
    expect(patch.aspectRatio).toBe("9:16");
  });

  it("carries the script as text, without a breakdown", () => {
    const { script } = toProjectPatch(slice);

    expect(script.title).toBe("La torrefaction");
    expect(script.text).toContain("Tout commence par un grain vert.");
    // Scenes belong to the storyboard, not to the script.
    expect(script).not.toHaveProperty("scenes");
  });

  it("carries in params what has no column", () => {
    const { params } = toProjectPatch(slice);

    expect(params.promptContent).toBe("Une video sur le cafe");
    expect(params.selectedVoice).toBe("onyx");
    expect(params.style).toBe("cinematic");
  });
});

describe("stripEphemeralUrls", () => {
  it("leaves a durable URL untouched", () => {
    const panels = stripEphemeralUrls([
      { id: "p1", imageUrl: "/scene.png", prompt: "x" },
    ]);

    expect(panels[0]).toMatchObject({ imageUrl: "/scene.png" });
  });

  it("empties a data: imageUrl without losing the rest of the panel", () => {
    const panels = stripEphemeralUrls([
      { id: "p1", imageUrl: "data:image/png;base64,AAAA", prompt: "garde-moi" },
    ]);

    expect(panels[0]).toMatchObject({ imageUrl: "", prompt: "garde-moi" });
  });

  it("strips a blob: from the optional URLs", () => {
    const [panel] = stripEphemeralUrls([
      {
        id: "p1",
        imageUrl: "/ok.png",
        videoUrl: "blob:http://localhost/9f2",
        audioUrl: "blob:http://localhost/aa1",
      },
    ]) as Record<string, unknown>[];

    expect(panel.videoUrl).toBeUndefined();
    expect(panel.audioUrl).toBeUndefined();
  });

  it("also cleans the URLs carried by annotations", () => {
    const [panel] = stripEphemeralUrls([
      {
        id: "p1",
        imageUrl: "/ok.png",
        annotations: [{ id: "a1", src: "data:image/png;base64,BBBB", x: 10 }],
      },
    ]) as Record<string, any>[];

    expect(panel.annotations[0].src).toBeUndefined();
    expect(panel.annotations[0].x).toBe(10);
  });
});

describe("toProjectPatch against the server schema", () => {
  it("keeps promptContent and selectedVoice after validation", () => {
    // z.object strips keys it does not declare: without
    // persistedProjectParamsSchema, the PATCH answered 200 having lost the
    // prompt, and the editor reopened on an empty field.
    const parsed = updateVideoProjectSchema.parse(toProjectPatch(slice));

    expect(parsed.params?.promptContent).toBe("Une video sur le cafe");
    expect(parsed.params?.selectedVoice).toBe("onyx");
  });

  it("survives a full round trip through the schema", () => {
    const parsed = updateVideoProjectSchema.parse(toProjectPatch(slice));
    const back = fromLoadedProject(parsed as never);

    expect(back.promptContent).toBe(slice.promptContent);
    expect(back.selectedVoice).toBe(slice.selectedVoice);
  });
});

describe("toProjectPatch against the server guard", () => {
  it("produces a patch that assertNoEphemeralUrl accepts", () => {
    const patch = toProjectPatch({
      ...slice,
      storyboardPanels: [
        { id: "p1", imageUrl: "data:image/png;base64,AAAA", prompt: "x" },
        { id: "p2", imageUrl: "/ok.png", videoUrl: "blob:http://x/1" },
      ] as ProjectSlice["storyboardPanels"],
    });

    expect(() => assertNoEphemeralUrl(patch)).not.toThrow();
  });
});

describe("fromLoadedProject", () => {
  it("does the full round trip without losing anything", () => {
    const patch = toProjectPatch(slice);
    const back = fromLoadedProject(patch);

    expect(back.projectTitle).toBe(slice.projectTitle);
    expect(back.promptContent).toBe(slice.promptContent);
    expect(back.selectedVoice).toBe(slice.selectedVoice);
    expect(back.scriptTitle).toBe(slice.scriptTitle);
    expect(back.scriptText).toBe(slice.scriptText);
    expect(back.projectParams).toEqual(slice.projectParams);
    expect(back.step).toBe(slice.step);
  });

  it("opens a project whose row has no script", () => {
    const back = fromLoadedProject({
      title: "Ancien",
      step: "prompt",
      params: {},
      script: {} as never,
      panels: [],
      whiteboardConfig: {},
    });

    expect(back.scriptText).toBe("");
    expect(back.scriptTitle).toBe("");
  });

  it("defaults the fields missing from an old row", () => {
    const back = fromLoadedProject({
      title: "Ancien",
      step: "prompt",
      params: {},
      script: { title: "", text: "" },
      panels: [],
      whiteboardConfig: { animStyle: "chunkjump" },
    });

    expect(back.promptContent).toBe("");
    expect(back.selectedVoice).toBe("nova");
    expect(back.whiteboardConfig.annotations).toEqual([]);
    expect(back.whiteboardConfig.transcript).toEqual([]);
  });

  it("replaces a legacy voice with one that exists", () => {
    // Older projects carried made-up identifiers: passing them
    // as-is would make synthesis fail on every scene.
    const back = fromLoadedProject({
      title: "x",
      step: "voiceChoice",
      params: { selectedVoice: "fr-fr-male-1" },
      script: { title: "", text: "" },
      panels: [],
      whiteboardConfig: {},
    });

    expect(back.selectedVoice).toBe("nova");
  });

  it("maps a step removed from the flow to one that exists", () => {
    const back = fromLoadedProject({
      title: "x",
      step: "editor",
      params: {},
      script: { title: "", text: "" },
      panels: [],
      whiteboardConfig: {},
    });

    expect(back.step).toBe("whiteboard");
  });
});
