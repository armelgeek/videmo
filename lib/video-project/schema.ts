import { z } from "zod";
import {
  projectParamsSchema,
  storyboardPanelSchema,
  workflowStepSchema,
} from "@/lib/storyboard/schema";
import { EphemeralUrlRejectedError } from "./errors";

export const projectStatusSchema = z.enum(["draft", "ready", "archived"]);
export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);

/**
 * The saved script: a narrative text, not a breakdown.
 *
 * The scenes derived from it live in `panels`: they belong to the
 * storyboard, and merging them here mixed what the user writes with what
 * the visualization produces.
 */
export const projectScriptSchema = z.object({
  title: z.string().default(""),
  text: z.string().default(""),
});

/**
 * The store params, plus the two editor values that have no column of
 * their own. Without these keys declared, z.object silently stripped them:
 * the PATCH answered 200 and the prompt vanished on reload.
 */
export const persistedProjectParamsSchema = projectParamsSchema.extend({
  promptContent: z.string().optional(),
  selectedVoice: z.string().optional(),
});

// Case-insensitive (RFC 2397 allows `DATA:`) and tolerant of a leading
// space, otherwise the filter is bypassed with one character.
const EPHEMERAL_URL = /^\s*(?:data|blob):/i;

/**
 * A URL is durable only if it outlives the tab: `blob:` dies with the
 * page, `data:` carries inline content this workstream refuses to write to the DB.
 */
function isDurableUrl(url: string): boolean {
  return !EPHEMERAL_URL.test(url);
}

/**
 * All `AudioTrack` metadata (lib/whiteboard-animation/audio/types.ts)
 * except `persistUrl`: it is precisely the content carrier (a `data:` URL
 * for an upload), which the spec keeps out of the DB until workstream 1.
 * For a TTS track it duplicates `url`, so nothing unrecoverable is lost.
 *
 * `url` is kept only if it is durable; a session `blob:` is reduced to
 * `null` rather than failing the whole save.
 */
export const persistedAudioTrackSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  source: z.enum(["upload", "tts"]).optional(),
  durationMs: z.number().nonnegative(),
  volume: z.number().min(0).max(1).optional(),
  muted: z.boolean().optional(),
  offsetMs: z.number().optional(),
  url: z
    .string()
    .nullable()
    .transform((url) => (url && isDurableUrl(url) ? url : null)),
});

export const whiteboardConfigSchema = z.object({
  animStyle: z.string(),
  handStyle: z.string(),
  canvasBg: z.string(),
  // Legacy WhiteboardConfig fields (lib/storyboard/store.ts): ignored at
  // runtime but kept, otherwise z.object would silently erase them.
  revealSpeed: z.number().optional(),
  handSpeed: z.number().optional(),
  chunks: z.number().optional(),
  useAnnotation: z.boolean().optional(),
  annotations: z.array(z.unknown()).default([]),
  annotationConfig: z.record(z.string(), z.unknown()).default({}),
  audio: persistedAudioTrackSchema.nullable().default(null),
  /**
   * The voice per narration beat. The URLs come from the tray, already durable:
   * unlike `audio`, nothing to filter — an uploaded track, by contrast, can
   * carry a blob: that dies with the tab.
   */
  narration: z
    .array(
      z.object({
        url: z.string(),
        startMs: z.number().nonnegative(),
        durationMs: z.number().nonnegative(),
      }),
    )
    .default([]),
  transcript: z.array(z.unknown()).default([]),
  /**
   * The word-by-word transcript of the recordings. Declared explicitly, not
   * as z.unknown(): it is the only way a malformed field shows up at
   * PATCH time rather than on reload, the day another route writes it.
   */
  transcription: z
    .array(
      z.object({
        url: z.string(),
        words: z
          .array(
            z.object({
              word: z.string(),
              startMs: z.number().nonnegative(),
              endMs: z.number().nonnegative(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export const videoProjectDocumentSchema = z.object({
  params: persistedProjectParamsSchema,
  script: projectScriptSchema,
  panels: z.array(storyboardPanelSchema),
  whiteboardConfig: whiteboardConfigSchema,
});
export type VideoProjectDocument = z.infer<typeof videoProjectDocumentSchema>;

export const createVideoProjectSchema = z.object({
  title: z.string().min(1).max(255),
  aspectRatio: aspectRatioSchema.default("16:9"),
  script: z.string().optional(),
});

export const updateVideoProjectSchema = z
  .object({
    title: z.string().min(1).max(255),
    status: projectStatusSchema,
    step: workflowStepSchema,
    aspectRatio: aspectRatioSchema,
    params: persistedProjectParamsSchema,
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
  params: persistedProjectParamsSchema.parse({}),
  script: { title: "", text: "" },
  panels: [],
  whiteboardConfig: whiteboardConfigSchema.parse({
    animStyle: "chunkjump",
    handStyle: "custom1",
    canvasBg: "white",
  }),
};

export function assertNoEphemeralUrl(value: unknown, path = ""): void {
  if (typeof value === "string") {
    if (EPHEMERAL_URL.test(value)) throw new EphemeralUrlRejectedError(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoEphemeralUrl(item, path ? `${path}.${index}` : String(index)),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      assertNoEphemeralUrl(nested, path ? `${path}.${key}` : key);
    }
  }
}
