import type { VisualPreset } from "./types";

/** The look every project has had so far: labelled doodles, arrows and boxes. */
export const EXPLAINER_PRESET: VisualPreset = {
  id: "explainer-doodle",
  vocabulary: ["arrows", "circles", "boxes", "underlines"],
  accentColors: ["red", "orange", "blue"],
  labels: "every-subject",
  defaultAnimationStyle: "chunkjump",
};
