import { PRODUCT_PRESET } from "./visual-presets";
import type { VideoFormat } from "./types";

export const productDemoFormat: VideoFormat = {
  id: "product-demo",
  version: 1,
  label: "Product Demo",
  hint: "Show features in action, focus on value and user benefits.",
  family: "explainer",
  thumbnailUrl: "/formats/product-demo.webp",
  script: {
    paragraphs: 9,
    structure: [
      "Hook (why viewers should care)",
      "Problem statement (pain point)",
      "Product intro (what it is, briefly)",
      "Feature 1 (demo + benefit)",
      "Feature 2 (demo + benefit)",
      "Feature 3 or integration (demo + benefit)",
      "Social proof / use case",
      "Call to action (free trial, pricing)",
      "Closing statement",
    ],
    defaultTone: "persuasive",
  },
  breakdown: {
    rules: [
      "Focus on user outcomes, not technical specs",
      "One feature per scene",
      "Show before/after or problem/solution",
      "Highlight unique selling points",
      "Include clear call-to-action",
      "Keep pace dynamic to hold attention",
    ],
  },
  visual: PRODUCT_PRESET,
};
