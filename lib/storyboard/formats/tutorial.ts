import type { VideoFormat } from "./types";

export const tutorialFormat: VideoFormat = {
  id: "tutorial",
  version: 1,
  label: "Tutorial",
  hint: "Step-by-step guide to accomplish a task.",
  thumbnailUrl: null,
  script: {
    paragraphs: 8,
    structure: [
      "Introduction (problem & outcome)",
      "Prerequisites (tools, knowledge)",
      "Step 1 (setup, context)",
      "Steps 2-5 (core walkthrough)",
      "Common pitfalls",
      "Verification (how to check it worked)",
      "Next steps / related tutorials",
      "Summary & resources",
    ],
    defaultTone: "instructional",
  },
  breakdown: {
    rules: [
      "One concept per visual",
      "Number steps clearly",
      "Show expected results after each major step",
      "Highlight warnings or common mistakes",
    ],
  },
  usesCharacter: false,
};
