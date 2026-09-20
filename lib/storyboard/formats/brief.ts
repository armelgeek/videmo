import type { VideoFormat } from "./types";

export const briefFormat: VideoFormat = {
  id: "brief",
  version: 1,
  label: "Brief",
  hint: "Short and punchy, one key message.",
  thumbnailUrl: null,
  script: {
    paragraphs: 6,
    structure: [
      "Hook (why care)",
      "Problem",
      "Solution",
      "Key benefit",
      "Proof or example",
      "Call-to-action",
    ],
    defaultTone: "professional",
  },
  breakdown: {
    rules: [
      "One idea per visual",
      "Keep language simple and direct",
      "End with clear next step",
    ],
  },
  usesCharacter: false,
};
