import { EDUCATIONAL_PRESET } from "./visual-presets";
import type { VideoFormat } from "./types";

export const educationalFormat: VideoFormat = {
  id: "educational",
  version: 1,
  label: "Educational",
  hint: "Teach a concept, build understanding progressively.",
  family: "explainer",
  thumbnailUrl: "/formats/educational.webp",
  script: {
    paragraphs: 11,
    structure: [
      "Learning objective (what viewers will understand)",
      "Context (why this matters)",
      "Foundation concept 1 (build ground up)",
      "Foundation concept 2",
      "Core concept (tie foundations together)",
      "Application / example 1",
      "Application / example 2",
      "Common misconceptions",
      "Summary of key takeaways",
      "Deeper dive (optional advanced topic)",
      "Resources for further learning",
    ],
    defaultTone: "explanatory",
  },
  breakdown: {
    rules: [
      "Start simple, increase complexity",
      "Use analogies to relate to known concepts",
      "Show both abstract concepts and concrete examples",
      "Highlight relationships between ideas",
      "Address common mistakes or misconceptions",
      "Use visual hierarchy to show importance",
      "Include memory aids or mnemonics",
    ],
  },
  visual: EDUCATIONAL_PRESET,
};
