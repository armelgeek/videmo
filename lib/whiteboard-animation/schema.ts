import { z } from 'zod';

/** The style of every project: an annotation without its own style is drawn this way. */
export const DEFAULT_ANIM_STYLE = 'chunkjump';

export const ANNOTATION_PALETTE = [
  { stroke: '#18181b', fill: 'rgba(24, 24, 27, 0.08)' },
  { stroke: '#e11d48', fill: 'rgba(225, 29, 72, 0.08)' },
  { stroke: '#059669', fill: 'rgba(5, 150, 105, 0.08)' },
  { stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.08)' },
  { stroke: '#d97706', fill: 'rgba(217, 119, 6, 0.08)' },
] as const;

/**
 * Black was every planned annotation's stored default, so every frame looked
 * the same: an unset or black stroke takes its rank's colour instead.
 */
export function annotationColors(
  annotation: { style?: { strokeColor?: string; fillColor?: string } },
  index: number,
): { stroke: string; fill: string } {
  const swatch = ANNOTATION_PALETTE[index % ANNOTATION_PALETTE.length];
  const stroke = annotation.style?.strokeColor;
  if (!stroke || stroke.toLowerCase() === '#000000') return swatch;
  return { stroke, fill: annotation.style?.fillColor ?? swatch.fill };
}

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

// Semantic roles recognised by AI or user
export const AnnotationRoleSchema = z.enum([
  'title',          // Main or section title
  'text',           // Body text, sentence or bullet
  'label',          // Short label or callout pointing to an object
  'arrow',          // Directional arrow or connector
  'container',      // Enclosure, box, cell, frame
  'shape',          // Geometric shape (circle, rectangle...)
  'drawing',        // Freehand drawing, icon or illustration
  'decoration',     // Underline, checkmark, strikethrough, badge
]);

export type AnnotationRole = z.infer<typeof AnnotationRoleSchema>;

// Reveal style hints from AI planner (aligned with whiteboard-animator)
export const RevealTypeSchema = z.enum(['stroke', 'fill', 'fade']);
export type RevealType = z.infer<typeof RevealTypeSchema>;

// Complete annotation object
export const AnnotationSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).slice(2, 11)),
  text: z.string().optional(),
  role: AnnotationRoleSchema.optional(),
  object: z.string().optional(),
  revealType: RevealTypeSchema.optional(),
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
