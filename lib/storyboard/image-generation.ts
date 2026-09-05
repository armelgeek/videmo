import { z } from "zod";

/**
 * Les seules tailles que gpt-image-1 accepte. Un format libre est refuse par
 * l'API : le ratio du projet doit donc etre ramene a l'une d'elles.
 */
export const IMAGE_SIZES = {
  "16:9": "1536x1024",
  "9:16": "1024x1536",
  "1:1": "1024x1024",
} as const;

export type AspectRatio = keyof typeof IMAGE_SIZES;

export function imageSizeForAspectRatio(aspectRatio: string): string {
  return IMAGE_SIZES[aspectRatio as AspectRatio] ?? IMAGE_SIZES["16:9"];
}

/**
 * Le prompt envoye au modele d'image.
 *
 * Le style du projet est rappele a chaque scene : le modele traite chaque appel
 * isolement, donc sans lui les dix visuels d'une meme video n'avaient aucune
 * unite. La consigne sur le texte evite les legendes inventees, illisibles et
 * impossibles a corriger apres coup.
 */
export function buildImagePrompt(input: {
  scenePrompt: string;
  style: string;
}): string {
  return [
    input.scenePrompt.trim(),
    `Visual style: ${input.style}.`,
    "Do not render any text, caption, watermark or logo in the image.",
  ].join(" ");
}

export const generateImageRequestSchema = z.object({
  projectId: z.string().min(1),
  sceneIndex: z.number().int().nonnegative(),
  prompt: z.string().min(3).max(4000),
  aspectRatio: z.string().default("16:9"),
  style: z.string().default("cinematic"),
});
export type GenerateImageRequest = z.infer<typeof generateImageRequestSchema>;

/** Ce que l'API images renvoie : une image encodee, jamais une URL. */
export const openAiImageResponseSchema = z.object({
  data: z
    .array(z.object({ b64_json: z.string().min(1) }))
    .min(1),
});

export function decodeBase64Image(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}
