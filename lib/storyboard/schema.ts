import { z } from "zod";

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

export const storyboardPanelSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  linkedImageUrl: z.string().optional(),
  prompt: z.string(),
  duration: z.number().default(5),
  videoUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  isGenerating: z.boolean().default(false),
  error: z.string().optional(),
  model: videoModelSchema.optional(),
});
export type StoryboardPanel = z.infer<typeof storyboardPanelSchema>;

export const workflowStepSchema = z.enum([
  "prompt",
  "scriptValidation",
  "storyboard",
  "whiteboard",
  "voiceChoice",
  "editor",
]);
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
