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
 * Un temps de narration a l'interieur d'une image.
 *
 * C'est ce qu'une annotation revelera : le stylo dessine une zone pendant que
 * ce segment est dit, puis passe a la suivante. Sa region — le rectangle dans
 * l'image — ne peut pas etre decidee ici : le modele ecrit le decoupage sans
 * voir l'illustration, elle se pose dans l'editeur.
 */
export const scriptBeatSchema = z.object({
  narration: z.string(),
  durationSec: z.number().positive().default(5),
  /**
   * La voix de CE temps, et sa duree mesuree sur le fichier produit.
   *
   * Synthetiser par image suffisait a jouer la narration, mais pas a la
   * decouper : les annotations se placent sur la duree de chaque temps, et
   * l'estimation du decoupage derive de 15 % — pres de sept secondes sur un
   * script de neuf temps. Absents tant que la synthese n'a pas eu lieu : le
   * decoupage precede toujours la voix.
   */
  audioUrl: z.string().optional(),
  audioDurationMs: z.number().nonnegative().optional(),
});
export type ScriptBeat = z.infer<typeof scriptBeatSchema>;

/**
 * Une scene, telle que le decoupage la produit : UNE image, et les temps de
 * narration qu'elle porte.
 *
 * Une image n'est plus liee a une seule phrase. Le modele regroupe ce qui
 * partage un meme visuel, si bien qu'une idee simple tient en une image breve
 * et qu'une idee developpee garde la sienne a l'ecran, revelee morceau par
 * morceau. Chaque image coute un appel au moteur : en produire une par phrase
 * multipliait la depense et l'attente sans rien ajouter au film.
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
 * Renumerote les scenes sur leur position.
 *
 * `index` porte l'ordre du film et sert de cle d'affichage : apres une
 * suppression ou un deplacement, le laisser tel quel produisait deux scenes de
 * meme index, donc une liste qui se melange au rendu.
 */
export function reindexScenes(scenes: ScriptScene[]): ScriptScene[] {
  return scenes.map((scene, index) => ({ ...scene, index }));
}

/** La narration entiere d'une image, dans l'ordre de ses temps. */
export function sceneNarration(scene: ScriptScene): string {
  return scene.beats.map((beat) => beat.narration.trim()).join(" ");
}

/** Sa duree : la somme de ses temps, jamais une constante. */
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
 * Combien d'images viser pour un script donne.
 *
 * Une consigne qualitative ne suffisait pas : le modele revenait a une image
 * par paragraphe, donc au meme cout qu'avant. Une cible chiffree, tiree du
 * script lui-meme, le fait regrouper sans figer le decoupage — le contenu
 * decide toujours, dans une fourchette.
 */
export function suggestedImageCount(script: string): number {
  const paragraphs = script
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;

  // Un dessin porte en general deux paragraphes ; jamais moins de deux images,
  // sans quoi une video courte tiendrait sur un seul plan fixe.
  return Math.max(2, Math.ceil(paragraphs / 2));
}

/** Le nombre de paragraphes vise pour le script, selon le format. */
export function paragraphCountForFormat(format: string): number {
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
    `paragraphs — aim for about ${paragraphCountForFormat(input.format)} of them.`,
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
    "Group the script into IMAGES, indexed from 0. An image is one drawing:",
    "group together everything that a single illustration can carry, and start",
    "a new one when the subject genuinely changes.",
    "",
    // Aucun nombre impose : une idee simple tient en une image breve, une idee
    // developpee en garde une seule, revelee morceau par morceau. Fixer un
    // compte forcait a decouper ce qui allait ensemble — et chaque image de
    // plus est un appel au moteur payé pour rien.
    "Let the content decide how many images there are — a simple idea needs",
    "one short image, a developed one keeps a single image on screen longer.",
    "Do not split a subject just to reach a count.",
    "",
    // Chaque image est un appel au moteur, facture et lent. Le modele revenait
    // spontanement a une image par paragraphe, ce qui annulait le regroupement.
    `PREFER FEWER IMAGES: aim for about ${suggestedImageCount(input.script)},`,
    "and never exceed that by more than one. Several consecutive paragraphs",
    "usually share one drawing: merge them into a single image with several",
    "beats. Only start a new image when the drawing itself would have to change.",
    "",
    "Split each image into beats: the successive moments of narration it",
    "carries, revealed one after another while the drawing stays on screen.",
    "Each beat's narration MUST be taken verbatim from the script above:",
    "split it, never rewrite it, and cover the whole script in order.",
    // Le modele recopiait une phrase deja utilisee pour se fabriquer un outro,
    // si bien que le narrateur la disait deux fois.
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
    // Le titre est montre a l'utilisateur : le laisser en anglais sous une
    // narration francaise donnait un storyboard bilingue.
    `Write the titles in the same language as the script (${input.params.language}).`,
    "Write the imagePrompt in English, whatever the script language:",
    "image models follow it more closely.",
  ].join("\n");
}
