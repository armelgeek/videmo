import type { VisualPreset } from "./types";

/** Labelled doodles, arrows, boxes — traditional explainer style. */
export const EXPLAINER_PRESET: VisualPreset = {
  id: "explainer-doodle",
  vocabulary: ["arrows", "circles", "boxes", "underlines"],
  accentColors: ["red", "orange", "blue"],
  labels: "every-subject",
  defaultAnimationStyle: "chunkjump",
};

/** Step-by-step visual with numbered steps, flow diagrams. */
export const TUTORIAL_PRESET: VisualPreset = {
  id: "tutorial-steps",
  vocabulary: ["numbers", "arrows", "checkmarks", "code-snippets"],
  accentColors: ["green", "blue", "gray"],
  labels: "key-subjects",
  defaultAnimationStyle: "sequential",
};

/** Narrative style with character focus, speech bubbles, scene transitions. */
export const STORY_PRESET: VisualPreset = {
  id: "story-narrative",
  vocabulary: ["characters", "speech-bubbles", "scenes", "emotions"],
  accentColors: ["purple", "pink", "teal"],
  labels: "none",
  defaultAnimationStyle: "fade",
};

/** Product-focused with UI elements, features highlighted, clean layout. */
export const PRODUCT_PRESET: VisualPreset = {
  id: "product-showcase",
  vocabulary: ["ui-elements", "features", "benefits", "user-interactions"],
  accentColors: ["teal", "cyan", "navy"],
  labels: "key-subjects",
  defaultAnimationStyle: "spotlight",
};

/** Educational with diagrams, formulas, concept relationships. */
export const EDUCATIONAL_PRESET: VisualPreset = {
  id: "educational-diagram",
  vocabulary: ["diagrams", "formulas", "concepts", "connections"],
  accentColors: ["indigo", "purple", "orange"],
  labels: "every-subject",
  defaultAnimationStyle: "buildup",
};
