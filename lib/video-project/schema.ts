import { z } from "zod";
import {
  projectParamsSchema,
  storyboardPanelSchema,
  workflowStepSchema,
} from "@/lib/storyboard/schema";
import { DataUrlRejectedError } from "./errors";

export const projectStatusSchema = z.enum(["draft", "ready", "archived"]);
export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);

export const projectScriptSchema = z.object({ text: z.string().default("") });

export const persistedAudioTrackSchema = z.object({
  name: z.string(),
  durationMs: z.number().nonnegative(),
  url: z.string().nullable(),
});

export const whiteboardConfigSchema = z.object({
  animStyle: z.string(),
  handStyle: z.string(),
  canvasBg: z.string(),
  annotations: z.array(z.unknown()).default([]),
  annotationConfig: z.record(z.string(), z.unknown()).default({}),
  audio: persistedAudioTrackSchema.nullable().default(null),
  transcript: z.array(z.unknown()).default([]),
});

export const videoProjectDocumentSchema = z.object({
  params: projectParamsSchema,
  script: projectScriptSchema,
  panels: z.array(storyboardPanelSchema),
  whiteboardConfig: whiteboardConfigSchema,
});
export type VideoProjectDocument = z.infer<typeof videoProjectDocumentSchema>;

export const createVideoProjectSchema = z.object({
  title: z.string().min(1).max(255),
});

export const updateVideoProjectSchema = z
  .object({
    title: z.string().min(1).max(255),
    status: projectStatusSchema,
    step: workflowStepSchema,
    aspectRatio: aspectRatioSchema,
    params: projectParamsSchema,
    script: projectScriptSchema,
    panels: z.array(storyboardPanelSchema),
    whiteboardConfig: whiteboardConfigSchema,
  })
  .partial();
export type UpdateVideoProject = z.infer<typeof updateVideoProjectSchema>;

export const listVideoProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().default(""),
});

export const DEFAULT_DOCUMENTS: VideoProjectDocument = {
  params: projectParamsSchema.parse({}),
  script: { text: "" },
  panels: [],
  whiteboardConfig: whiteboardConfigSchema.parse({
    animStyle: "chunkjump",
    handStyle: "custom1",
    canvasBg: "white",
  }),
};

export function assertNoDataUrl(value: unknown, path = ""): void {
  if (typeof value === "string") {
    if (value.startsWith("data:")) throw new DataUrlRejectedError(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoDataUrl(item, path ? `${path}.${index}` : String(index)),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      assertNoDataUrl(nested, path ? `${path}.${key}` : key);
    }
  }
}
