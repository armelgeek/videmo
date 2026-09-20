import { z } from "zod";
import { AnimationFactory } from "@/lib/whiteboard-animation/AnimationFactory";
import { HAND_STYLE_KEYS } from "@/lib/whiteboard-animation/hand-styles";

/**
 * What a user may write when authoring a whiteboard style.
 *
 * The two engine fields are checked against the engine itself: an animation or
 * hand it does not know would render as the default without a word, so the
 * mistake is refused here instead of showing up later as a style that looks
 * like every other.
 */
export const whiteboardStyleInputSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, digits and dashes"),
  label: z.string().min(1).max(120),
  hint: z.string().min(1).max(255),
  animStyle: z
    .string()
    .refine((id) => AnimationFactory.isStyleAvailable(id), "The engine has no such animation"),
  handStyle: z.enum(HAND_STYLE_KEYS),
});

export type WhiteboardStyleInput = z.infer<typeof whiteboardStyleInputSchema>;
