import { describe, expect, it } from "vitest";
import {
  buildBreakdownPrompt,
  buildScriptPrompt,
  generatedScriptSchema,
  reindexScenes,
  suggestedImageCount,
  sceneDuration,
  sceneNarration,
  type ScriptParams,
  type ScriptScene,
  scriptBeatSchema,
  storyboardBreakdownSchema,
} from "./script-generation";
import { builtInFormat } from "./formats/built-in";

const explainer = builtInFormat("explainer");
const brief = builtInFormat("brief");
const story = builtInFormat("story");

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
  it("accepts only a title and text", () => {
    const parsed = generatedScriptSchema.parse({
      title: "La torrefaction",
      text: "Le cafe commence par un grain vert.",
    });

    expect(parsed.text).toBe("Le cafe commence par un grain vert.");
    expect(parsed).not.toHaveProperty("scenes");
  });

  it("rejects an empty script", () => {
    expect(() =>
      generatedScriptSchema.parse({ title: "x", text: "" }),
    ).toThrow();
  });
});

describe("buildScriptPrompt", () => {
  const prompt = buildScriptPrompt(params, explainer);

  it("carries the parameters chosen at the Prompt step", () => {
    expect(prompt).toContain("La torrefaction du cafe");
    expect(prompt).toContain("fr");
    expect(prompt).toContain("debutants");
    expect(prompt).toContain("professional");
  });

  it("asks for prose, without any formatting", () => {
    // The breakdown comes afterwards: a script littered with scene headings
    // does not read as text.
    expect(prompt).toContain("No scene headings");
    expect(prompt).toContain("only the spoken words");
  });

  it("never talks about visuals at this step", () => {
    expect(prompt.toLowerCase()).not.toContain("imageprompt");
    expect(prompt.toLowerCase()).not.toContain("draw");
  });

  it("adjusts the length to the format", () => {
    expect(buildScriptPrompt(params, brief)).toContain("6 of them");
    expect(prompt).toContain("10 of them");
  });

  it("carries the format's narrative structure", () => {
    // Without it a format only changed the LENGTH: a tutorial and a story came
    // out reading exactly the same.
    for (const step of explainer.script.structure) {
      expect(prompt).toContain(step);
    }
  });

  it("keeps the structure out of the delivered script", () => {
    // The numbering steers the model; leaving it in the prose would put
    // headings back into a text meant to be read aloud.
    expect(prompt).toContain("must not appear in the script");
  });

  it("gives a different structure to a different format", () => {
    const tutorial = buildScriptPrompt(params, builtInFormat("tutorial"));
    expect(tutorial).toContain("Prerequisites (tools, knowledge)");
    expect(tutorial).not.toContain("Root cause");
  });
});

describe("buildBreakdownPrompt", () => {
  const prompt = buildBreakdownPrompt({
    script: "Le cafe commence par un grain vert. Puis vient la chaleur.",
    params,
    format: explainer,
  });

  it("passes the approved script", () => {
    expect(prompt).toContain("Le cafe commence par un grain vert.");
  });

  it("requires narration taken verbatim", () => {
    // Letting the model rewrite would lose the corrections just made.
    expect(prompt).toContain("verbatim");
    expect(prompt).toContain("split it, never rewrite it");
  });

  it("lets the content decide the number of images", () => {
    // Imposing a count forced splitting what belonged together, and each
    // extra image is a paid engine call for nothing.
    expect(prompt).toContain("Let the content decide how many images");
    expect(prompt).toContain("Do not split a subject just to reach a count");
  });

  it("pushes toward grouping, since each image costs a call", () => {
    expect(prompt).toContain("PREFER FEWER IMAGES");
    expect(prompt).toContain("merge them into a single image");
    // A qualitative instruction alone brought back one image per paragraph.
    expect(prompt).toContain("never exceed that by more than one");
  });

  it("forbids repeating a sentence to make up an outro", () => {
    expect(prompt).toContain("EXACTLY ONE beat");
    expect(prompt).toContain("never invent an intro or outro");
  });

  it("asks for narration beats per image", () => {
    expect(prompt).toContain("Split each image into beats");
    expect(prompt).toContain("durationSec");
  });

  it("introduces the visual style only here", () => {
    expect(prompt).toContain("cinematic");
    expect(prompt).toContain("imagePrompt");
  });

  it("asks for titles in the script's language", () => {
    // An English title under a French narration produced a storyboard
    // that was bilingual and visible to the user.
    expect(prompt).toContain("same language as the script (fr)");
  });

  it("keeps image prompts in English", () => {
    expect(prompt).toContain("imagePrompt in English");
  });

  it("carries the format's drawing vocabulary and accents", () => {
    for (const word of explainer.visual.vocabulary) expect(prompt).toContain(word);
    for (const colour of explainer.visual.accentColors) expect(prompt).toContain(colour);
  });

  it("carries the format's own breakdown rules", () => {
    for (const rule of explainer.breakdown.rules) expect(prompt).toContain(rule);
  });

  it("pins the recurring character of a story format", () => {
    // The agent knows how to keep a character stable; what it cannot invent is
    // WHICH character, so the format hands it one to copy verbatim.
    const storyPrompt = buildBreakdownPrompt({
      script: "Alex ouvre la porte.",
      params: { ...params, format: "story" },
      format: story,
    });

    expect(storyPrompt).toContain(story.character?.description ?? "");
    expect(storyPrompt).toContain("word for word");
  });

  it("says nothing about a character for a format that has none", () => {
    expect(prompt).not.toContain("RECURRING CHARACTER");
  });
});

describe("suggestedImageCount", () => {
  const paragraph = (n: number) =>
    Array.from({ length: n }, (_, i) => `Paragraphe ${i}.`).join("\n\n");

  it("aims for one drawing per two paragraphs", () => {
    expect(suggestedImageCount(paragraph(10))).toBe(5);
    expect(suggestedImageCount(paragraph(5))).toBe(3);
  });

  it("never squashes a short video into a single shot", () => {
    expect(suggestedImageCount(paragraph(1))).toBe(2);
    expect(suggestedImageCount("")).toBe(2);
  });

  it("ignores extra blank lines", () => {
    expect(suggestedImageCount("A.\n\n\n\nB.\n\n  \n\nC.\n\nD.")).toBe(2);
  });
});

describe("sceneNarration and sceneDuration", () => {
  const withBeats = scene({
    beats: [
      { narration: "Premier temps.", durationSec: 4 },
      { narration: "Deuxieme temps.", durationSec: 6 },
    ],
  });

  it("rebuilds the narration in beat order", () => {
    expect(sceneNarration(withBeats)).toBe("Premier temps. Deuxieme temps.");
  });

  it("makes the duration the sum, never a constant", () => {
    // An image stays on screen as long as what it carries: a developed
    // idea lasts longer than a simple one.
    expect(sceneDuration(withBeats)).toBe(10);
    expect(sceneDuration(scene({ beats: [{ narration: "x", durationSec: 3 }] }))).toBe(3);
  });
});

describe("storyboardBreakdownSchema", () => {
  it("accepts the expected breakdown", () => {
    expect(() =>
      storyboardBreakdownSchema.parse({ scenes: [scene({ clipType: "intro" })] }),
    ).not.toThrow();
  });

  it("rejects an empty breakdown", () => {
    expect(() => storyboardBreakdownSchema.parse({ scenes: [] })).toThrow();
  });

  it("keeps what the storyboard needs", () => {
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

  it("keeps a beat's voice on round trip", () => {
    const parsed = storyboardBreakdownSchema.parse({
      scenes: [
        {
          index: 0,
          clipType: "intro",
          title: "t",
          imagePrompt: "p",
          beats: [
            {
              narration: "n",
              durationSec: 5,
              audioUrl: "https://bac/narration/0-0.mp3",
              audioDurationMs: 6552,
            },
          ],
        },
      ],
    });

    expect(parsed.scenes[0].beats[0].audioUrl).toBe(
      "https://bac/narration/0-0.mp3",
    );
    expect(parsed.scenes[0].beats[0].audioDurationMs).toBe(6552);
  });

  it("rejects an image without any narration beat", () => {
    expect(() =>
      storyboardBreakdownSchema.parse({
        scenes: [{ index: 0, clipType: "intro", title: "t", imagePrompt: "p", beats: [] }],
      }),
    ).toThrow();
  });
});

describe("scriptBeatSchema", () => {
  it("accepts a beat without voice — the breakdown precedes synthesis", () => {
    const parsed = scriptBeatSchema.parse({ narration: "n", durationSec: 4 });

    expect(parsed.audioUrl).toBeUndefined();
    expect(parsed.audioDurationMs).toBeUndefined();
  });

  it("rejects a negative audio duration", () => {
    expect(() =>
      scriptBeatSchema.parse({
        narration: "n",
        durationSec: 4,
        audioDurationMs: -1,
      }),
    ).toThrow();
  });
});

describe("reindexScenes", () => {
  it("renumbers after a deletion", () => {
    const scenes = reindexScenes([
      scene({ index: 0, title: "A" }),
      scene({ index: 5, title: "B" }),
      scene({ index: 9, title: "C" }),
    ]);

    expect(scenes.map((s) => s.index)).toEqual([0, 1, 2]);
    expect(scenes.map((s) => s.title)).toEqual(["A", "B", "C"]);
  });

  it("touches nothing but the index", () => {
    const [only] = reindexScenes([scene({ index: 7, imagePrompt: "garde-moi" })]);

    expect(only.imagePrompt).toBe("garde-moi");
    expect(only.index).toBe(0);
  });

  it("accepts an empty list", () => {
    expect(reindexScenes([])).toEqual([]);
  });
});
