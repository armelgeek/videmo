import { z } from 'zod';

// Timing bounds for annotation reveal
export const AnnotationRevealSchema = z.object({
  from: z.number().min(0).optional(),
  to: z.number().min(0).optional(),
  durationMs: z.number().min(1).default(1000),
  startMs: z.number().min(0).optional(),
  gapBeforeMs: z.number().min(0).optional(),
});

export type AnnotationReveal = z.infer<typeof AnnotationRevealSchema>;

// Region coordinates (in natural image pixels)
export const AnnotationRegionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(1),
  height: z.number().min(1),
});

export type AnnotationRegion = z.infer<typeof AnnotationRegionSchema>;

// Narration metadata for per-annotation audio generation
export const NarrationMetadataSchema = z.object({
  text: z.string().optional(),
  audioUrl: z.string().optional(),
  waveformPeaks: z.array(z.number()).optional(),
  durationMs: z.number().optional(),
  generatedAt: z.number().optional(),
  transcriptText: z.string().optional(),
});

export type NarrationMetadata = z.infer<typeof NarrationMetadataSchema>;

// Complete annotation object
export const AnnotationSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).slice(2, 11)),
  text: z.string().optional(),
  region: AnnotationRegionSchema,
  reveal: AnnotationRevealSchema.default({ durationMs: 1000 }),
  style: z.object({
    strokeColor: z.string().default('#000000'),
    strokeWidth: z.number().default(2),
    fillColor: z.string().optional(),
    opacity: z.number().min(0).max(1).default(1),
  }).default({ strokeColor: '#000000', strokeWidth: 2, opacity: 1 }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  narration: NarrationMetadataSchema.optional(),
  animStyle: z.string().optional(),
});

export type Annotation = z.infer<typeof AnnotationSchema>;

// Annotation config for whiteboard
export const AnnotationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  speed: z.number().min(0.1).max(5).default(1),
  defaultStyle: z.object({
    strokeColor: z.string().default('#000000'),
    strokeWidth: z.number().default(2),
    fillColor: z.string().optional(),
  }).default({ strokeColor: '#000000', strokeWidth: 2 }),
});


export type AnnotationConfig = z.infer<typeof AnnotationConfigSchema>;

// Validate and create annotation
export function createAnnotation(data: unknown): Annotation {
  return AnnotationSchema.parse(data);
}

// Validate and create config
export function createAnnotationConfig(data: unknown): AnnotationConfig {
  return AnnotationConfigSchema.parse(data);
}

// Default empty annotation
export const DEFAULT_ANNOTATION: Annotation = {
  id: 'default',
  text: '',
  region: { x: 0, y: 0, width: 100, height: 100 },
  reveal: { durationMs: 1000 },
  style: {
    strokeColor: '#000000',
    strokeWidth: 2,
    opacity: 1,
  },
};

export const DEFAULT_ANNOTATION_CONFIG: AnnotationConfig = {
  enabled: true,
  speed: 1,
  defaultStyle: {
    strokeColor: '#000000',
    strokeWidth: 2,
  },
};
