import type { VisualStyle } from "./types";

/**
 * The styles shipped with the product.
 *
 * Seed data and fallback, not a registry: the running app reads styles from
 * the database, where an organization overrides any of them or adds its own.
 * All of them are variants of a doodle — the engine traces line work, so a
 * style that needs texture or shading cannot exist here.
 */
export const BUILT_IN_VISUAL_STYLES: readonly VisualStyle[] = [
  {
    id: "doodle",
    label: "Doodle",
    hint: "Simple pencil doodles with small red, orange and blue accents.",
    artDirection:
      "Extremely simple hand-drawn line art, pure pencil-sketch aesthetic, restrained doodle style similar to Notion illustrations",
    accentColors: ["red", "orange", "blue"],
    // Worded as the prompt has always read, so this style changes nothing for
    // a project that never picks another.
    vocabulary: ["arrows connecting the steps", "simple circles", "boxes", "underlines"],
    labels: "every-subject",
  },
  {
    id: "marker",
    label: "Marker",
    hint: "Thick, playful felt-tip strokes.",
    artDirection:
      "Bold felt-tip marker drawing, thick rounded strokes, chunky simple shapes, playful and energetic",
    accentColors: ["orange", "teal"],
    vocabulary: ["stars", "underlines", "arrows", "circles"],
    labels: "key-subjects",
  },
  {
    id: "technical",
    label: "Technical pen",
    hint: "Thin precise lines with a single blue accent.",
    artDirection:
      "Precise technical pen drawing, thin uniform lines, clean geometric shapes, calm blueprint-like clarity",
    accentColors: ["blue"],
    vocabulary: ["arrows", "boxes", "callout lines", "brackets"],
    labels: "every-subject",
  },
  {
    id: "storybook",
    label: "Storybook",
    hint: "Friendly ink drawings, with no written words.",
    artDirection:
      "Warm storybook ink illustration, friendly rounded characters, gentle expressive lines, simple readable scenes",
    accentColors: ["warm orange", "soft green"],
    vocabulary: ["curved arrows", "stars", "simple scenery"],
    labels: "none",
  },
  {
    id: "icons",
    label: "Icons",
    hint: "Clean symbols in a single line weight.",
    artDirection:
      "Minimal icon-style drawing, single-weight outlines, simplified geometric symbols, no decoration",
    accentColors: ["blue"],
    vocabulary: ["arrows", "circles", "boxes", "check marks"],
    labels: "every-subject",
  },
  {
    id: "comic",
    label: "Comic ink",
    hint: "Bold outlines and expressive poses.",
    artDirection:
      "Comic-book ink drawing, confident bold outlines, expressive simple poses, flat single-colour accents",
    accentColors: ["red", "yellow"],
    vocabulary: ["action lines", "arrows", "stars"],
    labels: "key-subjects",
  },
];

export const DEFAULT_VISUAL_STYLE_ID = "doodle";

const BY_ID = new Map(BUILT_IN_VISUAL_STYLES.map((s) => [s.id, s]));

export function builtInVisualStyle(id: string | undefined): VisualStyle {
  return BY_ID.get(id ?? DEFAULT_VISUAL_STYLE_ID) ?? (BY_ID.get(DEFAULT_VISUAL_STYLE_ID) as VisualStyle);
}

export function isBuiltInVisualStyle(id: string): boolean {
  return BY_ID.has(id);
}
