import { z } from "zod";

/**
 * What the engine cannot trace. It binarises the image, keeps the ink pixels
 * and thins them to a one-pixel skeleton, so texture, shading and realism each
 * turn into noise the pen tries to draw. A style asking for any of them would
 * render as a mess, or be ignored — so it is refused when written.
 */
const UNTRACEABLE = [
  "photo",
  "realistic",
  "3d",
  "render",
  "watercolor",
  "watercolour",
  "oil paint",
  "painterly",
  "gradient",
  "shadow",
  "shading",
  "texture",
  "glow",
  "neon",
  "cinematic",
  "lighting",
];

export function untraceableTermIn(text: string): string | null {
  const lower = text.toLowerCase();
  return UNTRACEABLE.find((term) => lower.includes(term)) ?? null;
}

/**
 * What a user may write when authoring a visual style.
 *
 * The art direction is the only free text, and it is the one place a user can
 * ask for something the engine cannot draw.
 */
export const visualStyleInputSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes"),
  label: z.string().min(1).max(120),
  hint: z.string().min(1).max(255),
  artDirection: z
    .string()
    .min(10)
    .max(400)
    .superRefine((text, ctx) => {
      const term = untraceableTermIn(text);
      if (term) {
        ctx.addIssue({
          code: "custom",
          message: `“${term}” cannot be traced by the pen animation. Describe the line work instead.`,
        });
      }
    }),
  accentColors: z.array(z.string().min(1).max(40)).max(6).default([]),
  vocabulary: z.array(z.string().min(1).max(40)).max(12).default([]),
  labels: z.enum(["every-subject", "key-subjects", "none"]),
});

export type VisualStyleInput = z.infer<typeof visualStyleInputSchema>;
