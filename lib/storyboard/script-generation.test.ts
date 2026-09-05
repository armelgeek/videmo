import { describe, expect, it } from "vitest";
import {
  buildBreakdownPrompt,
  buildScriptPrompt,
  generatedScriptSchema,
  reindexScenes,
  sceneCountForFormat,
  type ScriptParams,
  type ScriptScene,
  storyboardBreakdownSchema,
} from "./script-generation";

const params: ScriptParams = {
  content: "La torrefaction du cafe",
  style: "cinematic",
  format: "explainer",
  language: "fr",
  duration: "3-5 minutes",
  targetAudience: "debutants",
  tone: "professional",
};

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
  it("n'accepte qu'un titre et du texte", () => {
    const parsed = generatedScriptSchema.parse({
      title: "La torrefaction",
      text: "Le cafe commence par un grain vert.",
    });

    expect(parsed.text).toBe("Le cafe commence par un grain vert.");
    expect(parsed).not.toHaveProperty("scenes");
  });

  it("refuse un script vide", () => {
    expect(() =>
      generatedScriptSchema.parse({ title: "x", text: "" }),
    ).toThrow();
  });
});

describe("buildScriptPrompt", () => {
  const prompt = buildScriptPrompt(params);

  it("porte les parametres choisis a l'etape Prompt", () => {
    expect(prompt).toContain("La torrefaction du cafe");
    expect(prompt).toContain("fr");
    expect(prompt).toContain("debutants");
    expect(prompt).toContain("professional");
  });

  it("demande de la prose, sans aucune mise en forme", () => {
    // Le decoupage vient apres : un script parseme de titres de scene ne se
    // relit pas comme un texte.
    expect(prompt).toContain("No scene headings");
    expect(prompt).toContain("only the spoken words");
  });

  it("ne parle jamais de visuel a cette etape", () => {
    expect(prompt.toLowerCase()).not.toContain("imageprompt");
    expect(prompt.toLowerCase()).not.toContain("draw");
  });

  it("ajuste la longueur au format", () => {
    expect(buildScriptPrompt({ ...params, format: "brief" })).toContain("6 of them");
    expect(prompt).toContain("10 of them");
  });
});

describe("buildBreakdownPrompt", () => {
  const prompt = buildBreakdownPrompt({
    script: "Le cafe commence par un grain vert. Puis vient la chaleur.",
    params,
  });

  it("transmet le script valide", () => {
    expect(prompt).toContain("Le cafe commence par un grain vert.");
  });

  it("exige une narration reprise mot pour mot", () => {
    // Laisser le modele reecrire perdrait les corrections faites juste avant.
    expect(prompt).toContain("verbatim");
    expect(prompt).toContain("split it, never rewrite it");
  });

  it("n'introduit le style visuel qu'ici", () => {
    expect(prompt).toContain("cinematic");
    expect(prompt).toContain("imagePrompt");
  });

  it("demande les titres dans la langue du script", () => {
    // Un titre anglais sous une narration francaise donnait un storyboard
    // bilingue, visible par l'utilisateur.
    expect(prompt).toContain("same language as the script (fr)");
  });

  it("garde les prompts d'image en anglais", () => {
    expect(prompt).toContain("imagePrompt in English");
  });
});

describe("sceneCountForFormat", () => {
  it("distingue brief et explainer", () => {
    expect(sceneCountForFormat("brief")).toBe(6);
    expect(sceneCountForFormat("explainer")).toBe(10);
  });
});

describe("storyboardBreakdownSchema", () => {
  it("accepte le decoupage attendu", () => {
    expect(() =>
      storyboardBreakdownSchema.parse({ scenes: [scene({ clipType: "intro" })] }),
    ).not.toThrow();
  });

  it("refuse un decoupage vide", () => {
    expect(() => storyboardBreakdownSchema.parse({ scenes: [] })).toThrow();
  });

  it("conserve ce qui sert au storyboard", () => {
    const parsed = storyboardBreakdownSchema.parse({
      scenes: [
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

    expect(parsed.scenes[0].imagePrompt).toBe("un plan macro sur un grain");
    expect(parsed.scenes[0].duration).toBe(12);
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
