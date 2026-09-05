import { z } from "zod";

/**
 * Le script : un texte narratif continu, rien d'autre.
 *
 * C'est ce que le narrateur dit, dans la forme ou un humain le relit et le
 * reecrit. Y melanger des prompts d'image en faisait un document technique
 * qu'on ne pouvait plus lire comme un texte — et le decoupage en scenes, fige
 * des la premiere generation, ignorait ensuite les corrections.
 */
export const generatedScriptSchema = z.object({
  title: z.string(),
  text: z.string().min(1),
});
export type GeneratedScript = z.infer<typeof generatedScriptSchema>;

/**
 * Une scene, telle que le decoupage la produit.
 *
 * `imagePrompt` n'apparait qu'ici, apres validation du texte : c'est de la
 * matiere a storyboard, pas du script.
 */
export const scriptSceneSchema = z.object({
  index: z.number().int().nonnegative(),
  clipType: z.enum(["intro", "content", "outro"]),
  title: z.string(),
  narration: z.string(),
  imagePrompt: z.string(),
  duration: z.number().positive().default(10),
  visualDescription: z.string().default(""),
  keyElements: z.array(z.string()).default([]),
});
export type ScriptScene = z.infer<typeof scriptSceneSchema>;

export const storyboardBreakdownSchema = z.object({
  scenes: z.array(scriptSceneSchema).min(1),
});
export type StoryboardBreakdown = z.infer<typeof storyboardBreakdownSchema>;

/**
 * Renumerote les scenes sur leur position.
 *
 * `index` porte l'ordre du film et sert de cle d'affichage : apres une
 * suppression ou un deplacement, le laisser tel quel produisait deux scenes de
 * meme index, donc une liste qui se melange au rendu.
 */
export function reindexScenes(scenes: ScriptScene[]): ScriptScene[] {
  return scenes.map((scene, index) => ({ ...scene, index }));
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

/** Le nombre de scenes vise, dont depend la longueur demandee au script. */
export function sceneCountForFormat(format: string): number {
  return format === "brief" ? 6 : 10;
}

/**
 * Premier appel : ecrire le texte.
 *
 * Aucune consigne de mise en forme — ni titres de scene, ni marqueurs. Le
 * decoupage vient apres, sur le texte que l'utilisateur aura valide.
 */
export function buildScriptPrompt(input: ScriptParams): string {
  return [
    `Write the narration script for a video about: ${input.content}`,
    "",
    `Format: ${input.format}`,
    `Target duration: ${input.duration}`,
    `Audience: ${input.targetAudience}`,
    `Tone: ${input.tone}`,
    `Write the narration in this language (ISO code): ${input.language}`,
    "",
    "Return continuous prose the narrator will read aloud, split into short",
    `paragraphs — aim for about ${sceneCountForFormat(input.format)} of them.`,
    "No scene headings, no labels, no stage directions, no markdown:",
    "only the spoken words.",
  ].join("\n");
}

/**
 * Second appel : decouper le texte valide.
 *
 * La narration de chaque scene doit etre reprise du texte, non reecrite —
 * sinon les corrections faites a l'etape Script seraient perdues au passage.
 */
export function buildBreakdownPrompt(input: {
  script: string;
  params: ScriptParams;
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
    `Produce about ${sceneCountForFormat(input.params.format)} clips, indexed from 0.`,
    "The first clip is the intro, the last is the outro, the rest are content.",
    "Each clip's narration MUST be taken verbatim from the script above:",
    "split it, never rewrite it, and cover the whole script in order.",
    "Give every clip a title describing its content, and an imagePrompt",
    "describing what to draw for it.",
    "",
    // Le titre est montre a l'utilisateur : le laisser en anglais sous une
    // narration francaise donnait un storyboard bilingue.
    `Write the titles in the same language as the script (${input.params.language}).`,
    "Write the imagePrompt in English, whatever the script language:",
    "image models follow it more closely.",
  ].join("\n");
}
