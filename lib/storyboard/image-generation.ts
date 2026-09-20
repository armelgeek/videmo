import { z } from "zod";
import { builtInVisualStyle } from "./visual-styles/built-in";
import type { VisualStyle } from "./visual-styles/types";

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
/**
 * "red", "red and blue", "red, orange, and blue". The serial comma is the
 * wording the colour clause always had; the vocabulary clause never had one.
 */
function joinList(items: readonly string[], serialComma = true): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}${serialComma ? "," : ""} and ${items[items.length - 1]}`;
}

/**
 * The label rules a style can choose between. Each one touches three places —
 * the requirement, the forbidden list and the final check — which is why they
 * are gathered here rather than left as loose strings in the template.
 */
function labelClauses(style: VisualStyle, language: string) {
  if (style.labels === "none") {
    return {
      rule: "- Labels: draw NO written words at all — no labels, no captions, no lettering, no numbers",
      forbidden: "- Any written word, letter or number anywhere in the image",
      verify: "- The image contains no written word, letter or number?",
    };
  }
  if (style.labels === "key-subjects") {
    return {
      rule:
        `- Labels: give a SHORT hand-lettered keyword label${language} (three words at most) only to the\n` +
        "  subjects that matter most, placed in the empty space beside the subject — never over a drawing.\n" +
        "  Minor subjects may stay unlabelled.",
      forbidden: null,
      verify: "- Every label is correctly spelled and placed outside the drawing?",
    };
  }
  return {
    rule:
      `- Labels: EVERY drawn subject MUST have a SHORT hand-lettered keyword label${language},\n` +
      "  three words at most, placed in the empty space beside the subject — never over a drawing.\n" +
      "  No subject may appear without its label.",
    forbidden: "- Any drawn subject left unlabelled",
    verify: "- Every drawn subject has its own keyword label, correctly spelled, placed outside the drawing?",
  };
}

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
  /**
   * How the drawing looks. It only fills the clauses the engine leaves free —
   * art direction, accent colours, vocabulary, labels. Everything the engine
   * needs (white background, continuous lines, separated subjects, no shadows)
   * stays below and never depends on the style.
   */
  style?: VisualStyle;
}): string {
  const style = input.style ?? builtInVisualStyle(undefined);
  const orientation =
    ORIENTATIONS[input.aspectRatio as AspectRatio] ?? ORIENTATIONS["16:9"];
  const languageName = input.language
    ? (LANGUAGE_NAMES[input.language] ?? input.language)
    : null;
  const language = languageName ? ` written in ${languageName}` : "";
  const labels = labelClauses(style, language);

  const reference = input.hasReference
    ? "\nDraw it in exactly the same style as the reference image provided:" +
      " same line weight, same character style, same color range.\n"
    : "";

  const color =
    style.accentColors.length === 0
      ? "- Color: none. Dark gray line work only, no fills, no shading, no gradients, no shadows"
      : `- Color: mostly uncolored. Only small flat accents of ${joinList(style.accentColors)}.\n` +
        "  No other colors, no shading, no gradients, no shadows";

  const vocabulary =
    style.vocabulary.length === 0
      ? null
      : `- Drawing vocabulary: hand-drawn ${joinList(style.vocabulary, false)}, drawn as clean continuous strokes`;

  const requirements = [
    `- ${style.artDirection}`,
    "- Background: flat uniform pure white #FFFFFF, completely clean,\n" +
      "  no texture, no gradient, no pattern, no off-white or cream tint",
    "- Lines: dark gray, clear, continuous, confident outlines with consistent weight",
    color,
    "- Composition: subjects clearly SEPARATED from each other with generous empty\n" +
      "  space between them, so each subject can be isolated in its own rectangle",
    "- Concept over realism: express relationship and action through simple silhouettes\n" +
      "  and few lines, not accurate proportions or detail",
    vocabulary,
    labels.rule,
  ].filter((line): line is string => line !== null);

  const forbidden = [
    "- Sentences, paragraphs, or any block of running text",
    "- Photorealism, photographic detail, 3D rendering, painterly texture",
    "- Busy backgrounds, dense decoration, high saturation, drop shadows",
    "- Any background tint, cream, beige, or off-white — the background must be #FFFFFF pure white",
    labels.forbidden,
  ].filter((line): line is string => line !== null);

  const verify = [
    labels.verify,
    "- Background is pure white #FFFFFF with no texture, no tint, and no gradient?",
    "- Subjects far enough apart that each one fits inside its own rectangle?",
    "- Lines clean and unbroken?",
    "- No shadow and no gradient?",
    "- Line weight, character style and color range consistent across the series?",
  ];

  return `A minimalist hand-drawn sketch illustration, ${orientation}.

Scene: ${input.scenePrompt.trim()}
${reference}

Style requirements (all mandatory):
${requirements.join("\n")}

Strictly forbidden:
${forbidden.join("\n")}

Before returning the image, verify every point:
${verify.join("\n")}`;
}

export const generateImageRequestSchema = z.object({
  projectId: z.string().min(1),
  sceneIndex: z.number().int().nonnegative(),
  prompt: z.string().min(3).max(4000),
  aspectRatio: z.string().default("16:9"),
  language: z.string().default("en"),
  /** A key of the visual style table. Unknown keys fall back to the default. */
  visualStyle: z.string().max(64).optional(),
  /**
   * La premiere case deja produite, servie comme reference de style aux
   * suivantes. Absente pour la premiere scene, ou quand on regenere seule.
   */
  referenceUrl: z.string().url().optional(),
});
export type GenerateImageRequest = z.infer<typeof generateImageRequestSchema>;
