import { EXPLAINER_PRESET } from "./explainer-preset";
import type { VideoFormat } from "./types";

export const explainerFormat: VideoFormat = {
  id: "explainer",
  version: 1,
  label: "Explainer",
  hint: "Step by step, the whole idea.",
  family: "explainer",
  thumbnailUrl: "/formats/explainer.webp",
  script: {
    paragraphs: 10,
    structure: [],
    defaultTone: "professional",
  },
  breakdown: { rules: [] },
  visual: EXPLAINER_PRESET,
};
