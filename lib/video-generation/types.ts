import { z } from "zod";

// Visual styles
export const styleSchema = z.enum([
  "watercolor",
  "anime",
  "retro",
  "whiteboard",
  "classic",
  "cinematic",
  "isometric",
  "flat",
  "comic",
  "neon",
  "oil",
  "sketch",
  "papercut",
  "popart",
  "storybook",
  "pixel",
  "minimalist",
  "infographic",
  "documentary",
  "gothic",
  "pastel",
  "3b1b",
  "corporate",
  "presentation",
  "tech",
]);
export type Style = z.infer<typeof styleSchema>;

// Format options
export const formatSchema = z.enum(["explainer", "brief"]);
export type Format = z.infer<typeof formatSchema>;

// Aspect ratios
export const aspectRatioSchema = z.enum(["16:9", "9:16"]);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

// Supported languages
export const languageSchema = z.enum([
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "pl",
  "tr",
  "ru",
  "nl",
  "cs",
  "ar",
  "zh",
  "ja",
  "ko",
  "hi",
]);
export type Language = z.infer<typeof languageSchema>;

// Video generation request schema
export const videoGenerationSchema = z.object({
  content: z.string().min(10, "Content must be at least 10 characters"),
  format: formatSchema,
  style: styleSchema,
  aspectRatio: aspectRatioSchema.default("16:9"),
  language: languageSchema.default("en"),
  customInstructions: z.string().optional(),
  narrativeVoiceId: z.string().optional(),
  narrativeStyle: z.string().optional(),
});

export type VideoGenerationRequest = z.infer<typeof videoGenerationSchema>;

// Response types
export interface GenerationProgress {
  status: "pending" | "processing" | "completed" | "error";
  stage?: string;
  progress?: number;
  error?: string;
  videoUrl?: string;
  clips?: ClipPreview[];
}

export interface ClipPreview {
  index: number;
  title: string;
  imageUrl?: string;
  narration?: string;
  status: "pending" | "generated" | "error";
}

export interface VideoGenerationJob {
  id: string;
  request: VideoGenerationRequest;
  status: "pending" | "processing" | "completed" | "error";
  createdAt: Date;
  updatedAt: Date;
  progress: GenerationProgress;
}
