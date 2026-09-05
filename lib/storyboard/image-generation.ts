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

const ORIENTATIONS: Record<AspectRatio, string> = {
  "16:9": "16:9 landscape",
  "9:16": "9:16 portrait",
  "1:1": "1:1 square",
};

/** Les langues dont le nom guide le modele mieux que le code ISO. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
};

/**
 * Le prompt envoye au modele d'image.
 *
 * Ces consignes ne sont pas un parti pris esthetique : elles decrivent ce que
 * le moteur d'animation sait lire. Il binarise l'image, garde les pixels
 * d'encre, puis amincit les traits jusqu'a un squelette d'un pixel pour
 * reconstituer l'ordre des coups de crayon. Chacune repond a une panne precise :
 *
 * - trait rompu     -> strokePencil leve le crayon (jumpThreshold) et saute
 * - fond texture    -> la texture est lue comme de l'encre, le stylo dessine
 *                      dans le vide
 * - sujets colles   -> les zones sont decoupees en rectangles ; s'ils se
 *                      chevauchent, l'ordre du trace devient incontrolable
 * - ombres/degrades -> chaque frontiere de valeur devient un trait
 *
 * Le texte est autorise, contrairement au line art d'illustration : un
 * explainer whiteboard EST fait de mots-cles, de fleches et d'encadres traces
 * a la main. Mesure sur la meme scene : sans texte 4,1 % d'encre pour 23
 * composantes, avec texte 4,9 % pour 118 — loin des 336 qui restent lisibles,
 * et plus loin encore des 5111 d'une image realiste. Ce qui est proscrit, ce
 * sont les phrases : un paragraphe multiplierait les composantes et le stylo
 * passerait la scene a ecrire.
 *
 * Le style narratif du projet (cinematic, etc.) est deliberement absent : il
 * decrit la voix, et l'appliquer ici produirait le photorealisme que la liste
 * interdit. Seules la scene et la langue varient.
 */
export function buildImagePrompt(input: {
  scenePrompt: string;
  aspectRatio?: string;
  /**
   * La langue des mots-cles traces. Un explainer dont les etiquettes sont dans
   * une autre langue que la narration ne se rattrape pas apres coup : le texte
   * est dans l'image, non modifiable.
   */
  language?: string;
  /**
   * Vrai quand la premiere case de la serie accompagne l'appel. La cohérence
   * du trait entre cases ne s'obtient pas par la consigne seule : c'est le
   * dernier point de la liste de verification, et il exige la reference.
   */
  hasReference?: boolean;
}): string {
  const orientation =
    ORIENTATIONS[input.aspectRatio as AspectRatio] ?? ORIENTATIONS["16:9"];

  const languageName = input.language
    ? (LANGUAGE_NAMES[input.language] ?? input.language)
    : null;
  const language = languageName ? ` written in ${languageName}` : "";

  const reference = input.hasReference
    ? "\nDraw it in exactly the same style as the reference image provided:" +
      " same line weight, same character style, same color range.\n"
    : "";

  return `A minimalist hand-drawn sketch illustration, ${orientation}.

Scene: ${input.scenePrompt.trim()}
${reference}

Style requirements (all mandatory):
- Extremely simple hand-drawn line art, pure pencil-sketch aesthetic, restrained
  doodle style similar to Notion illustrations
- Background: flat uniform warm cream paper color #F5EBD7, completely clean,
  no texture, no gradient, no pattern
- Lines: dark gray, clear, continuous, confident outlines with consistent weight
- Color: mostly uncolored. Only small flat accents of red, orange, and blue.
  No other colors, no shading, no gradients, no shadows
- Composition: subjects clearly SEPARATED from each other with generous empty
  space between them, so each subject can be isolated in its own rectangle
- Concept over realism: express relationship and action through simple silhouettes
  and few lines, not accurate proportions or detail
- Explainer vocabulary: hand-drawn arrows connecting the steps, simple circles,
  boxes and underlines, drawn as clean continuous strokes
- Labels: a few SHORT hand-lettered keywords${language}, three words at most each,
  placed in the empty space beside the subject they name — never over a drawing

Strictly forbidden:
- Sentences, paragraphs, or any block of running text
- Photorealism, photographic detail, 3D rendering, painterly texture
- Busy backgrounds, dense decoration, high saturation, drop shadows

Before returning the image, verify every point:
- Every written word correctly spelled, legible, and placed outside the drawings?
- Background perfectly uniform cream, with no texture and no gradient?
- Subjects far enough apart that each one fits inside its own rectangle?
- Lines clean and unbroken?
- No shadow and no gradient?
- Line weight, character style and color range consistent across the series?`;
}

export const generateImageRequestSchema = z.object({
  projectId: z.string().min(1),
  sceneIndex: z.number().int().nonnegative(),
  prompt: z.string().min(3).max(4000),
  aspectRatio: z.string().default("16:9"),
  language: z.string().default("en"),
  /**
   * La premiere case deja produite, servie comme reference de style aux
   * suivantes. Absente pour la premiere scene, ou quand on regenere seule.
   */
  referenceUrl: z.string().url().optional(),
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
