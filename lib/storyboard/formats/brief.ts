import { EXPLAINER_PRESET } from "./explainer-preset";
import type { VideoFormat } from "./types";

export const briefFormat: VideoFormat = {
  id: "brief",
  version: 1,
  label: "Brief",
  hint: "Short and punchy, one key message.",
  family: "explainer",
  thumbnailUrl: "/formats/brief.webp",
  script: {
    paragraphs: 6,
    structure: [],
    defaultTone: "professional",
  },
  breakdown: { rules: [] },
  visual: EXPLAINER_PRESET,
};
