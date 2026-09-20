import { z } from "zod";
import type { VideoFormat } from "./formats/types";

/**
 * The script: a continuous narrative text, nothing else.
 *
 * It is what the narrator says, in the form a human rereads and rewrites.
 * Mixing image prompts into it made it a technical document that could no
 * longer be read as text — and the scene split, frozen at the first
 * generation, then ignored the corrections.
 */
export const generatedScriptSchema = z.object({
  title: z.string(),
  text: z.string().min(1),
});
export type GeneratedScript = z.infer<typeof generatedScriptSchema>;

/**
 * A narration beat inside an image.
 *
 * It is what an annotation will reveal: the pen draws a region while this
 * segment is spoken, then moves to the next. Its region — the rectangle in
 * the image — cannot be decided here: the model writes the split without
 * seeing the illustration, so it is placed in the editor.
 */
export const scriptBeatSchema = z.object({
  narration: z.string(),
  durationSec: z.number().positive().default(5),
  /**
   * The voice of THIS beat, and its duration measured on the produced file.
   *
   * Synthesizing per image was enough to play the narration, but not to
   * split it: annotations are placed on each beat's duration, and the
   * breakdown's estimate drifts by 15% — nearly seven seconds on a
   * nine-beat script. Absent until synthesis has happened: the
   * breakdown always precedes the voice.
   */
  audioUrl: z.string().optional(),
  audioDurationMs: z.number().nonnegative().optional(),
  /**
   * Where this beat starts WITHIN its image's recording.
   *
   * The image is spoken in one take, and its beats are located in it by the
   * transcription: `audioUrl` therefore points to the same voice for all, and
   * this instant is what tells them apart.
   */
  startMs: z.number().nonnegative().optional(),
});
export type ScriptBeat = z.infer<typeof scriptBeatSchema>;

/**
 * A scene, as the breakdown produces it: ONE image, and the narration beats
 * it carries.
 *
 * An image is no longer tied to a single sentence. The model groups what
 * shares the same visual, so a simple idea fits in one brief image and a
 * developed idea keeps its own on screen, revealed piece by
 * piece. Each image costs an engine call: producing one per sentence
 * multiplied cost and waiting without adding anything to the film.
 */
export const scriptSceneSchema = z.object({
  index: z.number().int().nonnegative(),
  clipType: z.enum(["intro", "content", "outro"]),
  title: z.string(),
  imagePrompt: z.string(),
  beats: z.array(scriptBeatSchema).min(1),
  visualDescription: z.string().default(""),
  keyElements: z.array(z.string()).default([]),
});
export type ScriptScene = z.infer<typeof scriptSceneSchema>;

export const storyboardBreakdownSchema = z.object({
  scenes: z.array(scriptSceneSchema).min(1),
});
export type StoryboardBreakdown = z.infer<typeof storyboardBreakdownSchema>;

/**
 * Renumbers scenes by their position.
 *
 * `index` carries the film order and serves as display key: after a
 * deletion or a move, leaving it as-is produced two scenes with the
 * same index, hence a list that gets shuffled on render.
 */
export function reindexScenes(scenes: ScriptScene[]): ScriptScene[] {
  return scenes.map((scene, index) => ({ ...scene, index }));
}

/** The whole narration of an image, in the order of its beats. */
export function sceneNarration(scene: ScriptScene): string {
  return scene.beats.map((beat) => beat.narration.trim()).join(" ");
}

/** Its duration: the sum of its beats, never a constant. */
export function sceneDuration(scene: ScriptScene): number {
  return scene.beats.reduce((total, beat) => total + beat.durationSec, 0);
}

export interface ScriptParams {
  content: string;
  style: string;
  format: string;
  language: string;
  duration: string;
  targetAudience: string;
  tone: string;
}

/**
 * How many images to aim for with a given script.
 *
 * A qualitative instruction was not enough: the model went back to one image
 * per paragraph, hence the same cost as before. A numeric target, derived from
 * the script itself, makes it group without freezing the split — the content
 * still decides, within a range.
 */
export function suggestedImageCount(script: string): number {
  const paragraphs = script
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;

  // A drawing usually carries two paragraphs; never fewer than two images,
  // otherwise a short video would fit in a single still shot.
  return Math.max(2, Math.ceil(paragraphs / 2));
}


/**
 * First call: write the text.
 *
 * No formatting instruction — no scene headings, no markers. The
 * split comes afterwards, on the text the user will have approved.
 */
export function buildScriptPrompt(
  input: ScriptParams,
  format: VideoFormat,
): string {
  return [
    `Write the narration script for a video about: ${input.content}`,
    "",
    `Format: ${format.label} — ${format.hint}`,
    `Target duration: ${input.duration}`,
    `Audience: ${input.targetAudience}`,
    `Tone: ${input.tone}`,
    `Write the narration in this language (ISO code): ${input.language}`,
    // The structure is what makes one format differ from another: without it
    // every format produced the same script at a different length.
    ...(format.script.structure.length > 0
      ? [
          "",
          "Cover these movements, in this order, one short paragraph each:",
          ...format.script.structure.map((step, i) => `${i + 1}. ${step}`),
          "The numbering is for you alone: it must not appear in the script.",
        ]
      : []),
    "",
    "Return continuous prose the narrator will read aloud, split into short",
    `paragraphs — aim for about ${format.script.paragraphs} of them.`,
    "No scene headings, no labels, no stage directions, no markdown:",
    "only the spoken words.",
  ].join("\n");
}

const LABEL_INSTRUCTIONS: Record<string, string> = {
  "every-subject": "Label every subject drawn in the image.",
  "key-subjects": "Label only the subjects the narration names.",
  none: "Draw no written labels: the narration carries the words.",
};

/** The look the format asks for: drawing vocabulary, accents, labelling. */
function formatVisualInstructions({ visual }: VideoFormat): string[] {
  return [
    `Draw with this vocabulary: ${visual.vocabulary.join(", ")}.`,
    `Use these accent colours, sparingly: ${visual.accentColors.join(", ")}.`,
    LABEL_INSTRUCTIONS[visual.labels],
    "",
  ];
}

/**
 * The recurring character, for the formats that ship one.
 *
 * The agent already knows how to keep a character stable across clips; what it
 * cannot invent is WHICH character, so the format hands it a fixed description
 * to copy verbatim rather than letting each image drift into someone else.
 */
function formatCharacterInstructions({ character }: VideoFormat): string[] {
  if (!character) return [];

  const name = character.name ?? "the protagonist";
  return [
    `RECURRING CHARACTER — ${name}: ${character.description}`,
    `Every image showing ${name} repeats that description word for word in its`,
    "imagePrompt, so the same person is drawn from the first image to the last.",
    "",
  ];
}

/** What this format wants from the split, beyond the rules common to all. */
function formatBreakdownRules({ breakdown }: VideoFormat): string[] {
  if (breakdown.rules.length === 0) return [];
  return [
    "This format also asks for:",
    ...breakdown.rules.map((rule) => `- ${rule}`),
    "",
  ];
}

/**
 * Second call: split the approved text.
 *
 * Each scene's narration must be taken from the text, not rewritten —
 * otherwise the corrections made at the Script step would be lost on the way.
 */
export function buildBreakdownPrompt(input: {
  script: string;
  params: ScriptParams;
  format: VideoFormat;
}): string {
  return [
    "Break this narration script into video clips.",
    "",
    "SCRIPT:",
    input.script.trim(),
    "",
    `Visual style for the image prompts: ${input.params.style}`,
    `Aspect ratio: the video is ${input.params.format} format`,
    "",
    ...formatVisualInstructions(input.format),
    ...formatCharacterInstructions(input.format),
    ...formatBreakdownRules(input.format),
    "Group the script into IMAGES, indexed from 0. An image is one drawing:",
    "group together everything that a single illustration can carry, and start",
    "a new one when the subject genuinely changes.",
    "",
    // No imposed count: a simple idea fits in one brief image, a developed
    // idea keeps a single one, revealed piece by piece. Fixing a count forced
    // splitting what belonged together — and each extra image is a paid
    // engine call for nothing.
    "Let the content decide how many images there are — a simple idea needs",
    "one short image, a developed one keeps a single image on screen longer.",
    "Do not split a subject just to reach a count.",
    "",
    // Each image is an engine call, billed and slow. The model spontaneously
    // went back to one image per paragraph, which cancelled the grouping.
    `PREFER FEWER IMAGES: aim for about ${suggestedImageCount(input.script)},`,
    "and never exceed that by more than one. Several consecutive paragraphs",
    "usually share one drawing: merge them into a single image with several",
    "beats. Only start a new image when the drawing itself would have to change.",
    "",
    "Split each image into beats: the successive moments of narration it",
    "carries, revealed one after another while the drawing stays on screen.",
    "Each beat's narration MUST be taken verbatim from the script above:",
    "split it, never rewrite it, and cover the whole script in order.",
    // The model copied an already-used sentence to make up an outro,
    // so the narrator said it twice.
    "Every sentence of the script appears in EXACTLY ONE beat: never repeat a",
    "sentence across beats, and never invent an intro or outro that is not in",
    "the script. The last image is simply the one carrying the final text.",
    "Give each beat a durationSec matching how long that text takes to say",
    "aloud — roughly three words per second.",
    "",
    "The first image is the intro, the last is the outro, the rest are content.",
    "Give every image a title describing its content, and an imagePrompt",
    "describing the single drawing that covers all of its beats.",
    "",
    // The title is shown to the user: leaving it in English under a
    // French narration produced a bilingual storyboard.
    `Write the titles in the same language as the script (${input.params.language}).`,
    "Write the imagePrompt in English, whatever the script language:",
    "image models follow it more closely.",
  ].join("\n");
}
