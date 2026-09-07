import { z } from "zod";
import { AnnotationSchema } from "@/lib/whiteboard-animation/schema";
import { scriptBeatSchema } from "./script-generation";
import type { TransitionName } from "@/lib/whiteboard-animation/timeline/clip-transitions";

export const videoModelSchema = z.enum([
  "veo3.1-fast",
  "veo3.1-standard",
  "wan-2.5",
  "wan-2.2-transition",
]);
export type VideoModel = z.infer<typeof videoModelSchema>;

export const projectParamsSchema = z.object({
  style: z.string().default("cinematic"),
  format: z.enum(["brief", "explainer"]).default("explainer"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  language: z.string().default("en"),
  duration: z.string().default("3-5 minutes"),
  targetAudience: z.string().default("general"),
  tone: z.string().default("professional"),
});
export type ProjectParams = z.infer<typeof projectParamsSchema>;

/**
 * `satisfies` verrouille cette liste sur le type de clip-transitions : ajouter
 * ici un nom qu'il ne connait pas casse la compilation, plutot que de laisser
 * les deux definitions diverger en silence.
 */
const TRANSITION_NAMES = [
  "none",
  "cut",
  "fade",
  "slideup",
  "slidedown",
  "slideleft",
  "slideright",
] as const satisfies readonly TransitionName[];

export const transitionSchema = z.object({
  type: z.enum(TRANSITION_NAMES),
  durationMs: z.number().nonnegative(),
});

export const storyboardPanelSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  clipType: z.string().optional(),
  imageUrl: z.string(),
  linkedImageUrl: z.string().optional(),
  prompt: z.string(),
  narration: z.string().optional(),
  visualPrompt: z.string().optional(),
  duration: z.number().default(5),
  videoUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  /**
   * La duree mesuree de cet enregistrement.
   *
   * L'image est dite d'une traite : cette duree est celle de sa voix entiere,
   * et les temps s'y reperent par leur `startMs`.
   */
  audioDurationMs: z.number().nonnegative().optional(),
  /**
   * Les temps de narration de l'image, avec la voix produite pour chacun.
   *
   * Declares ici parce que z.object retire ce qu'il ne connait pas : sans ce
   * champ le PATCH repondait 200 et les temps disparaissaient a la relecture,
   * comme c'etait deja arrive a `promptContent`.
   */
  beats: z.array(scriptBeatSchema).optional(),
  isGenerating: z.boolean().default(false),
  error: z.string().optional(),
  model: videoModelSchema.optional(),
  annotations: z.array(AnnotationSchema).optional(),
  transition: transitionSchema.optional(),
});
export type StoryboardPanel = z.infer<typeof storyboardPanelSchema>;

// Ordre du parcours. Le whiteboard vient APRES la voix : le dessin est cale sur
// la narration, il faut donc que celle-ci existe avant d'entrer dans l'editeur.
export const workflowStepSchema = z.enum([
  "prompt",
  "scriptValidation",
  "storyboard",
  "voiceChoice",
  "whiteboard",
]);
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
