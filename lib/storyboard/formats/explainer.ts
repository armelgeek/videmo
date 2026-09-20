import { EXPLAINER_PRESET } from "./visual-presets";
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
    structure: [
      "Hook (relevance)",
      "Problem definition",
      "Root cause",
      "Solution overview",
      "Solution detail - part 1",
      "Solution detail - part 2",
      "How it works",
      "Benefits and outcomes",
      "Example or case study",
      "Summary and next steps",
    ],
    defaultTone: "professional",
  },
  breakdown: {
    rules: [
      "Build understanding progressively",
      "One concept per visual",
      "Use arrows and connections to show relationships",
      "Highlight key points with visual emphasis",
    ],
  },
  visual: EXPLAINER_PRESET,
};
