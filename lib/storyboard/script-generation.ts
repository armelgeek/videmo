import { z } from "zod";

/**
 * Une scene, dans la forme meme que l'agent produit.
 *
 * Rien n'est aplati en texte : `imagePrompt`, `duration` et `clipType` servent a
 * l'etape Storyboard, et une conversion en chaine les perdait — l'etape suivante
 * devait alors les reinventer.
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

/**
 * Le schema sert deux fois : il contraint la generation (structuredOutput) et
 * valide la reponse avant qu'elle n'entre dans le store.
 */
export const generatedScriptSchema = z.object({
  title: z.string(),
  narrativeFlow: z.string().default(""),
  clips: z.array(scriptSceneSchema).min(1),
});
export type GeneratedScript = z.infer<typeof generatedScriptSchema>;

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

/**
 * Le prompt de generation. Les parametres choisis a l'etape Prompt doivent
 * peser sur la sortie : sans eux, changer la langue ou le ton ne changeait rien.
 */
export function buildScriptPrompt(input: {
  content: string;
  style: string;
  format: string;
  language: string;
  duration: string;
  targetAudience: string;
  tone: string;
}): string {
  const sceneCount = input.format === "brief" ? 6 : 10;

  return [
    `Create a video storyboard about: ${input.content}`,
    "",
    `Visual style: ${input.style}`,
    `Format: ${input.format}`,
    `Target duration: ${input.duration}`,
    `Audience: ${input.targetAudience}`,
    `Tone: ${input.tone}`,
    `Write ALL narration in this language (ISO code): ${input.language}`,
    "",
    `Produce exactly ${sceneCount} clips, indexed from 0.`,
    "The first clip is the intro, the last is the outro, the rest are content.",
    "Each title must describe that clip's content — never a generic label.",
  ].join("\n");
}
