import type { VideoFormat } from "./types";

export const storyFormat: VideoFormat = {
  id: "story",
  version: 1,
  label: "Story",
  hint: "Narrative journey with character growth and emotion.",
  thumbnailUrl: null,
  script: {
    paragraphs: 12,
    structure: [
      "Setup (who, where, when, the normal world)",
      "Inciting incident (what changes)",
      "Rising action (challenges faced)",
      "Turning point (realization / decision)",
      "Climax (the moment of truth)",
      "Resolution (new normal, lessons learned)",
      "Reflection (emotional takeaway)",
    ],
    defaultTone: "narrative",
  },
  breakdown: {
    rules: [
      "Show emotional beats, not just events",
      "Introduce character early, develop throughout",
      "Use contrast between 'before' and 'after'",
      "Include dialogue or internal monologue",
      "Build tension toward climax",
    ],
  },
  usesCharacter: true,
};
