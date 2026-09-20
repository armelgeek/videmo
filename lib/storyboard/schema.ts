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
  // Not an enum: formats live in the database and an organization writes its
  // own. A key that no longer exists falls back to the default at resolution.
  format: z.string().min(1).max(64).default("explainer"),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  language: z.string().default("en"),
  duration: z.string().default("3-5 minutes"),
  targetAudience: z.string().default("general"),
  tone: z.string().default("professional"),
});
export type ProjectParams = z.infer<typeof projectParamsSchema>;

/**
 * `satisfies` locks this list to the clip-transitions type: adding a name
 * here that it does not know breaks compilation, rather than letting
 * the two definitions silently diverge.
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
   * The measured duration of this recording.
   *
   * The image is spoken in one take: this duration is that of its whole voice,
   * and the beats are located in it by their `startMs`.
   */
  audioDurationMs: z.number().nonnegative().optional(),
  /**
   * The image's narration beats, with the voice produced for each.
   *
   * Declared here because z.object strips what it does not know: without this
   * field the PATCH answered 200 and the beats vanished on reload,
   * as had already happened to `promptContent`.
   */
  beats: z.array(scriptBeatSchema).optional(),
  isGenerating: z.boolean().default(false),
  error: z.string().optional(),
  model: videoModelSchema.optional(),
  annotations: z.array(AnnotationSchema).optional(),
  transition: transitionSchema.optional(),
});
export type StoryboardPanel = z.infer<typeof storyboardPanelSchema>;

// Simplified flow order: prompt (inline script) → storyboard → whiteboard
export const workflowStepSchema = z.enum([
  "prompt",
  "storyboard",
  "whiteboard",
]);
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
