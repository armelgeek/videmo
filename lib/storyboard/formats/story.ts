import { STORY_PRESET } from "./visual-presets";
import type { VideoFormat, FormatCharacter } from "./types";

const CHARACTER: FormatCharacter = {
  name: "Alex",
  description: "A relatable protagonist who experiences the journey",
  referenceImageUrl: "/formats/story-character.webp",
};

export const storyFormat: VideoFormat = {
  id: "story",
  version: 1,
  label: "Story",
  hint: "Narrative journey with character growth and emotion.",
  family: "story",
  thumbnailUrl: "/formats/story.webp",
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
  visual: STORY_PRESET,
  character: CHARACTER,
};
