import type { VideoFormat } from "./types";

/**
 * The formats shipped with the product.
 *
 * They are seed data, not a registry: the running app reads formats from the
 * database, where an organization can override any of them or add its own.
 * They stay in code so a fresh install has something to generate with before
 * anyone has written a format, and so `npm run seed:video-formats` has a
 * source to insert from.
 */
export const BUILT_IN_FORMATS: readonly VideoFormat[] = [
  {
    id: "brief",
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
  },
  {
    id: "explainer",
    label: "Explainer",
    hint: "Step by step, the whole idea.",
    thumbnailUrl: null,
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
    usesCharacter: false,
  },
  {
    id: "tutorial",
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
  },
  {
    id: "story",
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
  },
  {
    id: "product-demo",
    label: "Product Demo",
    hint: "Show features in action, focus on value and user benefits.",
    thumbnailUrl: null,
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
    usesCharacter: false,
  },
  {
    id: "educational",
    label: "Educational",
    hint: "Teach a concept, build understanding progressively.",
    thumbnailUrl: null,
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
    usesCharacter: false,
  },
];

/**
 * The format a brand new account starts on.
 *
 * Brief, not Explainer: a video costs 5 + 10 credits plus 14 per scene, so a
 * six-scene brief fits in the free plan's monthly allowance and a ten-scene
 * explainer does not. A first video that stalls half-drawn is worse than a
 * short one. `estimate-video-cost.test.ts` holds this to it.
 */
export const DEFAULT_FORMAT_ID = "brief";

const BY_ID = new Map(BUILT_IN_FORMATS.map((f) => [f.id, f]));

export function builtInFormat(id: string | undefined): VideoFormat {
  return BY_ID.get(id ?? DEFAULT_FORMAT_ID) ?? (BY_ID.get(DEFAULT_FORMAT_ID) as VideoFormat);
}

export function isBuiltInFormat(id: string): boolean {
  return BY_ID.has(id);
}
