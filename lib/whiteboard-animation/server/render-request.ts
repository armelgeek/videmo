import { z } from "zod";

export type ExportQuality = "720p" | "1080p";
export type ExportAspect = "16:9" | "9:16" | "1:1";

/** Le libelle designe le PETIT cote : 1080p en 9:16 fait 1080x1920. */
const SHORT_SIDE: Record<ExportQuality, number> = { "720p": 720, "1080p": 1080 };

const RATIO: Record<ExportAspect, [number, number]> = {
  "16:9": [16, 9],
  "9:16": [9, 16],
  "1:1": [1, 1],
};

/** yuv420p sous-echantillonne la chroma par 2 : une dimension impaire est refusee. */
const even = (n: number) => (n % 2 === 0 ? n : n + 1);

export function resolveExportSize(
  quality: ExportQuality,
  aspectRatio: ExportAspect,
): { width: number; height: number } {
  const base = SHORT_SIDE[quality];
  const [rw, rh] = RATIO[aspectRatio];
  const shortRatio = Math.min(rw, rh);
  return {
    width: even(Math.round((base * rw) / shortRatio)),
    height: even(Math.round((base * rh) / shortRatio)),
  };
}

export const renderRequestSchema = z.object({
  projectId: z.string().min(1).max(64).optional(),
  quality: z.enum(["720p", "1080p"]),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  project: z.object({
    annotationSpace: z
      .object({ width: z.number().positive(), height: z.number().positive() })
      .optional(),
    scenes: z.array(z.any()).min(1),
    narration: z.any().optional(),
    animStyle: z.string().optional(),
    hand: z.string().optional(),
    handSpeed: z.number().optional(),
    tileSlider: z.number().optional(),
  }),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;
