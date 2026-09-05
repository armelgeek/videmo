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
  scriptScenes: [
    {
      index: 0,
      clipType: "intro" as const,
      title: "Le grain vert",
      narration: "Tout commence par un grain vert.",
      imagePrompt: "A green coffee bean, macro shot",
      duration: 12,
      visualDescription: "Gros plan",
      keyElements: ["grain"],
    },
  ],
  storyboardPanels: [],
  selectedVoice: "fr-fr-male-1",
  whiteboardConfig: DEFAULT_WHITEBOARD_CONFIG,
};

describe("toProjectPatch", () => {
  it("porte le titre, l'etape et le ratio dans leurs colonnes", () => {
    const patch = toProjectPatch(slice);

    expect(patch.title).toBe("Mon projet");
    expect(patch.step).toBe("storyboard");
    expect(patch.aspectRatio).toBe("9:16");
  });

  it("porte les scenes dans la forme meme de l'agent", () => {
    const { script } = toProjectPatch(slice);

    expect(script.title).toBe("La torrefaction");
    expect(script.scenes).toHaveLength(1);
    // Ce que l'ancien format texte detruisait.
    expect(script.scenes[0].imagePrompt).toBe("A green coffee bean, macro shot");
    expect(script.scenes[0].duration).toBe(12);
    expect(script.scenes[0].clipType).toBe("intro");
  });

  it("fait voyager dans params ce qui n'a pas de colonne", () => {
    const { params } = toProjectPatch(slice);

    expect(params.promptContent).toBe("Une video sur le cafe");
    expect(params.selectedVoice).toBe("fr-fr-male-1");
    expect(params.style).toBe("cinematic");
  });
});

describe("stripEphemeralUrls", () => {
  it("laisse intacte une URL durable", () => {
    const panels = stripEphemeralUrls([
      { id: "p1", imageUrl: "/scene.png", prompt: "x" },
    ]);

    expect(panels[0]).toMatchObject({ imageUrl: "/scene.png" });
  });

  it("vide une imageUrl data: sans perdre le reste du panneau", () => {
    const panels = stripEphemeralUrls([
      { id: "p1", imageUrl: "data:image/png;base64,AAAA", prompt: "garde-moi" },
    ]);

    expect(panels[0]).toMatchObject({ imageUrl: "", prompt: "garde-moi" });
  });

  it("retire une blob: sur les URL optionnelles", () => {
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

  it("nettoie aussi les URL portees par les annotations", () => {
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

describe("toProjectPatch face au schema du serveur", () => {
  it("conserve promptContent et selectedVoice apres validation", () => {
    // z.object retire les cles qu'il ne declare pas : sans
    // persistedProjectParamsSchema, le PATCH repondait 200 en ayant perdu le
    // prompt, et l'editeur rouvrait sur un champ vide.
    const parsed = updateVideoProjectSchema.parse(toProjectPatch(slice));

    expect(parsed.params?.promptContent).toBe("Une video sur le cafe");
    expect(parsed.params?.selectedVoice).toBe("fr-fr-male-1");
  });

  it("survit a un aller-retour complet a travers le schema", () => {
    const parsed = updateVideoProjectSchema.parse(toProjectPatch(slice));
    const back = fromLoadedProject(parsed as never);

    expect(back.promptContent).toBe(slice.promptContent);
    expect(back.selectedVoice).toBe(slice.selectedVoice);
  });
});

describe("toProjectPatch face au garde du serveur", () => {
  it("produit un patch qu'assertNoEphemeralUrl accepte", () => {
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
  it("refait le tour complet sans rien perdre", () => {
    const patch = toProjectPatch(slice);
    const back = fromLoadedProject(patch);

    expect(back.projectTitle).toBe(slice.projectTitle);
    expect(back.promptContent).toBe(slice.promptContent);
    expect(back.selectedVoice).toBe(slice.selectedVoice);
    expect(back.scriptTitle).toBe(slice.scriptTitle);
    expect(back.scriptScenes).toEqual(slice.scriptScenes);
    expect(back.projectParams).toEqual(slice.projectParams);
    expect(back.step).toBe(slice.step);
  });

  it("renumerote les scenes relues", () => {
    const back = fromLoadedProject({
      title: "x",
      step: "scriptValidation",
      params: {},
      script: {
        title: "t",
        scenes: [
          { index: 4, clipType: "intro", title: "A", narration: "a", imagePrompt: "p", duration: 10, visualDescription: "", keyElements: [] },
          { index: 9, clipType: "outro", title: "B", narration: "b", imagePrompt: "p", duration: 10, visualDescription: "", keyElements: [] },
        ],
      },
      panels: [],
      whiteboardConfig: {},
    });

    expect(back.scriptScenes.map((s) => s.index)).toEqual([0, 1]);
  });

  it("ouvre sans scene un projet ecrit avant ce format", () => {
    const back = fromLoadedProject({
      title: "Ancien",
      step: "prompt",
      params: {},
      script: {} as never,
      panels: [],
      whiteboardConfig: {},
    });

    expect(back.scriptScenes).toEqual([]);
    expect(back.scriptTitle).toBe("");
  });

  it("defaute les champs absents d'une ligne ancienne", () => {
    const back = fromLoadedProject({
      title: "Ancien",
      step: "prompt",
      params: {},
      script: { title: "", scenes: [] },
      panels: [],
      whiteboardConfig: { animStyle: "chunkjump" },
    });

    expect(back.promptContent).toBe("");
    expect(back.selectedVoice).toBe("default");
    expect(back.whiteboardConfig.annotations).toEqual([]);
    expect(back.whiteboardConfig.transcript).toEqual([]);
  });

  it("ramene une etape retiree du parcours vers une etape qui existe", () => {
    const back = fromLoadedProject({
      title: "x",
      step: "editor",
      params: {},
      script: { title: "", scenes: [] },
      panels: [],
      whiteboardConfig: {},
    });

    expect(back.step).toBe("whiteboard");
  });
});
