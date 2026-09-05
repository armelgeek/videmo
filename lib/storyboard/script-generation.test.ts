import { describe, expect, it } from "vitest";
import {
  buildScriptPrompt,
  generatedScriptSchema,
  reindexScenes,
  type ScriptScene,
} from "./script-generation";

const scene = (over: Partial<ScriptScene> = {}): ScriptScene => ({
  index: 0,
  clipType: "content",
  title: "Titre",
  narration: "Narration",
  imagePrompt: "A shot",
  duration: 10,
  visualDescription: "",
  keyElements: [],
  ...over,
});

describe("generatedScriptSchema", () => {
  it("accepte la sortie attendue de l'agent", () => {
    expect(() =>
      generatedScriptSchema.parse({
        title: "La torrefaction",
        narrativeFlow: "Du grain a la tasse",
        clips: [scene({ clipType: "intro" })],
      }),
    ).not.toThrow();
  });

  it("refuse un script sans aucune scene", () => {
    expect(() =>
      generatedScriptSchema.parse({ title: "x", clips: [] }),
    ).toThrow();
  });

  it("conserve ce que le texte plat detruisait", () => {
    const parsed = generatedScriptSchema.parse({
      title: "x",
      clips: [
        {
          index: 0,
          clipType: "intro",
          title: "t",
          narration: "n",
          imagePrompt: "un plan macro sur un grain",
          duration: 12,
        },
      ],
    });

    expect(parsed.clips[0].imagePrompt).toBe("un plan macro sur un grain");
    expect(parsed.clips[0].duration).toBe(12);
    expect(parsed.clips[0].clipType).toBe("intro");
  });

  it("comble les champs secondaires absents", () => {
    const parsed = generatedScriptSchema.parse({
      title: "x",
      clips: [
        {
          index: 0,
          clipType: "intro",
          title: "t",
          narration: "n",
          imagePrompt: "p",
        },
      ],
    });

    expect(parsed.clips[0].duration).toBe(10);
    expect(parsed.clips[0].keyElements).toEqual([]);
  });
});

describe("reindexScenes", () => {
  it("renumerote apres une suppression", () => {
    const scenes = reindexScenes([
      scene({ index: 0, title: "A" }),
      scene({ index: 5, title: "B" }),
      scene({ index: 9, title: "C" }),
    ]);

    expect(scenes.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(scenes.map((s) => s.title)).toEqual(["A", "B", "C"]);
  });

  it("ne touche a rien d'autre que l'index", () => {
    const [only] = reindexScenes([scene({ index: 7, imagePrompt: "garde-moi" })]);

    expect(only.imagePrompt).toBe("garde-moi");
    expect(only.index).toBe(0);
  });

  it("accepte une liste vide", () => {
    expect(reindexScenes([])).toEqual([]);
  });
});

describe("buildScriptPrompt", () => {
  const input = {
    content: "La torrefaction du cafe",
    style: "cinematic",
    format: "explainer",
    language: "fr",
    duration: "3-5 minutes",
    targetAudience: "debutants",
    tone: "professional",
  };

  it("fait porter au prompt les parametres de l'etape Prompt", () => {
    const prompt = buildScriptPrompt(input);

    expect(prompt).toContain("La torrefaction du cafe");
    expect(prompt).toContain("cinematic");
    expect(prompt).toContain("fr");
    expect(prompt).toContain("debutants");
  });

  it("demande moins de scenes au format brief", () => {
    expect(buildScriptPrompt({ ...input, format: "brief" })).toContain(
      "exactly 6 clips",
    );
    expect(buildScriptPrompt(input)).toContain("exactly 10 clips");
  });
});
