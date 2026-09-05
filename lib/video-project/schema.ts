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
 * Le script enregistre : un texte narratif, pas un decoupage.
 *
 * Les scenes qui en derivent vivent dans `panels` : elles appartiennent au
 * storyboard, et les fondre ici melangeait ce que l'utilisateur ecrit avec ce
 * que la mise en images produit.
 */
export const projectScriptSchema = z.object({
  title: z.string().default(""),
  text: z.string().default(""),
});

/**
 * Les parametres du store, plus les deux valeurs de l'editeur qui n'ont pas de
 * colonne a elles. Sans ces cles declarees, z.object les retirait en silence :
 * le PATCH repondait 200 et le prompt disparaissait a la relecture.
 */
export const persistedProjectParamsSchema = projectParamsSchema.extend({
  promptContent: z.string().optional(),
  selectedVoice: z.string().optional(),
});

// Insensible a la casse (le RFC 2397 autorise `DATA:`) et tolerant a un espace
// de tete, sans quoi le filtre se contourne d'un caractere.
const EPHEMERAL_URL = /^\s*(?:data|blob):/i;

/**
 * Une URL n'est durable que si elle survit à l'onglet : `blob:` meurt avec la
 * page, `data:` porte le contenu inline que ce chantier refuse d'écrire en base.
 */
function isDurableUrl(url: string): boolean {
  return !EPHEMERAL_URL.test(url);
}

/**
 * Toutes les métadonnées d'`AudioTrack` (lib/whiteboard-animation/audio/types.ts)
 * sauf `persistUrl` : c'est précisément le porteur du contenu (une `data:` URL
 * pour un téléversement), que la spec exclut de la base jusqu'au chantier 1.
 * Pour une piste TTS il duplique `url`, donc rien d'irrécupérable n'est perdu.
 *
 * `url` est conservée seulement si elle est durable ; une `blob:` de session
 * est ramenée à `null` plutôt que de faire échouer toute la sauvegarde.
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
  // Champs legacy de WhiteboardConfig (lib/storyboard/store.ts) : ignorés au
  // runtime mais conservés, sans quoi z.object les effacerait en silence.
  revealSpeed: z.number().optional(),
  handSpeed: z.number().optional(),
  chunks: z.number().optional(),
  useAnnotation: z.boolean().optional(),
  annotations: z.array(z.unknown()).default([]),
  annotationConfig: z.record(z.string(), z.unknown()).default({}),
  audio: persistedAudioTrackSchema.nullable().default(null),
  transcript: z.array(z.unknown()).default([]),
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
