import { z } from "zod";

/**
 * What a user may write when authoring a format.
 *
 * Separate from the `VideoFormat` shape the prompt builders consume: this one
 * is input, and it is the only place that decides what a key may look like or
 * how long a structure may get.
 */
export const formatKeySchema = z
  .string()
  .min(2)
  .max(64)
  // The key is stored in project params and sent to the API; keeping it to a
  // slug means renaming the label never breaks a saved project.
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes");

export const videoFormatInputSchema = z.object({
  key: formatKeySchema,
  label: z.string().min(1).max(120),
  hint: z.string().min(1).max(255),
  // A path, not necessarily an absolute URL: the shipped formats point at
  // `/formats/*.webp`, and overriding one must not have to rewrite that.
  thumbnailUrl: z.string().max(500).nullable().default(null),

  paragraphs: z.number().int().min(2).max(40),
  structure: z.array(z.string().min(1).max(200)).max(40).default([]),
  defaultTone: z.string().min(1).max(64),
  breakdownRules: z.array(z.string().min(1).max(300)).max(20).default([]),

  usesCharacter: z.boolean().default(false),
});

export type VideoFormatInput = z.infer<typeof videoFormatInputSchema>;
