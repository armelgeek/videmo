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
  family: z.enum(["explainer", "story"]).default("explainer"),
  thumbnailUrl: z.string().url().nullable().default(null),

  paragraphs: z.number().int().min(2).max(40),
  structure: z.array(z.string().min(1).max(200)).max(40).default([]),
  defaultTone: z.string().min(1).max(64),
  breakdownRules: z.array(z.string().min(1).max(300)).max(20).default([]),

  visual: z.object({
    id: z.string().min(1).max(64),
    vocabulary: z.array(z.string().min(1).max(40)).min(1).max(20),
    accentColors: z.array(z.string().min(1).max(40)).min(1).max(10),
    labels: z.enum(["every-subject", "key-subjects", "none"]),
    defaultAnimationStyle: z.string().min(1).max(40),
  }),

  character: z
    .object({
      name: z.string().max(80).optional(),
      description: z.string().min(1).max(600),
      referenceImageUrl: z.string().max(500),
    })
    .nullable()
    .default(null),
});

export type VideoFormatInput = z.infer<typeof videoFormatInputSchema>;
