import { describe, expect, it } from "vitest";
import {
  buildBreakdownPrompt,
  buildScriptPrompt,
  generatedScriptSchema,
  reindexScenes,
  paragraphCountForFormat,
  suggestedImageCount,
  sceneDuration,
  sceneNarration,
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
  imagePrompt: "A shot",
  beats: [{ narration: "Narration", durationSec: 5 }],
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

  it("laisse le contenu decider du nombre d'images", () => {
    // Imposer un compte forcait a decouper ce qui allait ensemble, et chaque
    // image de plus est un appel au moteur paye pour rien.
    expect(prompt).toContain("Let the content decide how many images");
    expect(prompt).toContain("Do not split a subject just to reach a count");
  });

  it("pousse au regroupement, chaque image coutant un appel", () => {
    expect(prompt).toContain("PREFER FEWER IMAGES");
    expect(prompt).toContain("merge them into a single image");
    // Une consigne qualitative seule ramenait une image par paragraphe.
    expect(prompt).toContain("never exceed that by more than one");
  });

  it("interdit de repeter une phrase pour fabriquer un outro", () => {
    expect(prompt).toContain("EXACTLY ONE beat");
    expect(prompt).toContain("never invent an intro or outro");
  });

  it("demande des temps de narration par image", () => {
    expect(prompt).toContain("Split each image into beats");
    expect(prompt).toContain("durationSec");
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

describe("suggestedImageCount", () => {
  const paragraph = (n: number) =>
    Array.from({ length: n }, (_, i) => `Paragraphe ${i}.`).join("\n\n");

  it("vise un dessin pour deux paragraphes", () => {
    expect(suggestedImageCount(paragraph(10))).toBe(5);
    expect(suggestedImageCount(paragraph(5))).toBe(3);
  });

  it("n'ecrase jamais une video courte sur un seul plan", () => {
    expect(suggestedImageCount(paragraph(1))).toBe(2);
    expect(suggestedImageCount("")).toBe(2);
  });

  it("ignore les lignes vides en trop", () => {
    expect(suggestedImageCount("A.\n\n\n\nB.\n\n  \n\nC.\n\nD.")).toBe(2);
  });
});

describe("paragraphCountForFormat", () => {
  it("distingue brief et explainer", () => {
    expect(paragraphCountForFormat("brief")).toBe(6);
    expect(paragraphCountForFormat("explainer")).toBe(10);
  });
});

describe("sceneNarration et sceneDuration", () => {
  const withBeats = scene({
    beats: [
      { narration: "Premier temps.", durationSec: 4 },
      { narration: "Deuxieme temps.", durationSec: 6 },
    ],
  });

  it("recompose la narration dans l'ordre des temps", () => {
    expect(sceneNarration(withBeats)).toBe("Premier temps. Deuxieme temps.");
  });

  it("fait la duree de la somme, jamais d'une constante", () => {
    // Une image reste a l'ecran le temps de ce qu'elle porte : une idee
    // developpee dure plus qu'une idee simple.
    expect(sceneDuration(withBeats)).toBe(10);
    expect(sceneDuration(scene({ beats: [{ narration: "x", durationSec: 3 }] }))).toBe(3);
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
          imagePrompt: "un plan macro sur un grain",
          beats: [{ narration: "n", durationSec: 12 }],
        },
      ],
    });

    expect(parsed.scenes[0].imagePrompt).toBe("un plan macro sur un grain");
    expect(sceneDuration(parsed.scenes[0])).toBe(12);
  });

  it("refuse une image sans aucun temps de narration", () => {
    expect(() =>
      storyboardBreakdownSchema.parse({
        scenes: [{ index: 0, clipType: "intro", title: "t", imagePrompt: "p", beats: [] }],
      }),
    ).toThrow();
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
