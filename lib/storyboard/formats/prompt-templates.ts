/**
 * Prompt templates for each video format.
 * These define how to construct AI prompts for script generation.
 */

export interface PromptConfig {
  topic: string;
  targetAudience?: string;
  tone?: string;
  keyPoints?: string[];
  duration?: number; // in seconds
  additionalContext?: string;
}

export const PROMPT_TEMPLATES = {
  brief: (config: PromptConfig): string => `
You are a script writer for short, punchy explainer videos.

Topic: ${config.topic}
Target Audience: ${config.targetAudience || "General"}
Tone: ${config.tone || "professional"}
Duration: ${config.duration || 30} seconds

Generate a 6-paragraph script that:
1. Opens with a hook (2-3 seconds)
2. Defines the problem (1-2 seconds)
3. Introduces the solution (2 seconds)
4. Highlights key benefit (2 seconds)
5. Includes one example or proof (2 seconds)
6. Ends with clear call-to-action (1-2 seconds)

Keep language simple, concise, and engaging. Each paragraph should be 1-2 sentences.
${config.keyPoints ? `Key points to cover: ${config.keyPoints.join(", ")}` : ""}
${config.additionalContext ? `Additional context: ${config.additionalContext}` : ""}

Format each paragraph with a [Scene X] label and description of what should be visualized.
`,

  explainer: (config: PromptConfig): string => `
You are a script writer for comprehensive explainer videos.

Topic: ${config.topic}
Target Audience: ${config.targetAudience || "General"}
Tone: ${config.tone || "professional"}
Duration: ${config.duration || 120} seconds

Generate a 10-paragraph script that:
1. Hook - why this topic matters
2. Problem definition and scope
3. Root cause explanation
4. Solution overview
5. Solution detail - component 1
6. Solution detail - component 2
7. Implementation or usage
8. Benefits and outcomes
9. Real-world example or case study
10. Summary and next steps

Each paragraph should be 2-3 sentences. Build understanding progressively.
${config.keyPoints ? `Key points to cover: ${config.keyPoints.join(", ")}` : ""}
${config.additionalContext ? `Additional context: ${config.additionalContext}` : ""}

Format each paragraph with a [Scene X] label and what visuals should appear.
`,

  tutorial: (config: PromptConfig): string => `
You are a script writer for step-by-step tutorial videos.

Topic: ${config.topic}
Target Audience: ${config.targetAudience || "Beginner"}
Tone: ${config.tone || "instructional"}
Duration: ${config.duration || 180} seconds

Generate an 8-paragraph tutorial script:
1. Introduction - what we're building and why
2. Prerequisites - tools, knowledge, or setup needed
3. Step 1 - foundation or setup
4-6. Steps 2-5 - core walkthrough (one step per paragraph, clear and sequential)
7. Verification - how to confirm it worked
8. Next steps and resources

Each paragraph should be clear and actionable. Use imperative language ("Click...", "Type...").
Number each step explicitly. Include warnings for common mistakes.
${config.keyPoints ? `Key points to cover: ${config.keyPoints.join(", ")}` : ""}
${config.additionalContext ? `Additional context: ${config.additionalContext}` : ""}

Format as [Step X]: description with visual callouts for UI elements or important details.
`,

  story: (config: PromptConfig): string => `
You are a screenwriter for narrative explainer videos with character arcs.

Topic: ${config.topic}
Target Audience: ${config.targetAudience || "General"}
Tone: ${config.tone || "narrative"}
Duration: ${config.duration || 180} seconds

Generate a 12-paragraph narrative script with emotional beats:
1. Setup - introduce the protagonist and their world
2. Inciting incident - what changes or goes wrong
3-4. Rising action - challenges and obstacles
5. Turning point - realization or crucial decision
6. Climax - the moment of truth
7. Resolution - new outcome or state
8. Reflection - what was learned
9-12. Extended scenes showing the transformation and its impact

Use dialogue and internal monologue. Show emotions, not just events.
Build tension toward the climax. Include before/after contrast.
${config.keyPoints ? `Character traits or journey elements: ${config.keyPoints.join(", ")}` : ""}
${config.additionalContext ? `Story context: ${config.additionalContext}` : ""}

Format as [Scene X]: description with character actions, dialogue, and emotional intent.
`,

  "product-demo": (config: PromptConfig): string => `
You are a script writer for product demo videos focused on benefits and conversions.

Product/Topic: ${config.topic}
Target Audience: ${config.targetAudience || "Potential customers"}
Tone: ${config.tone || "persuasive"}
Duration: ${config.duration || 120} seconds

Generate a 9-paragraph demo script:
1. Hook - compelling reason to watch
2. Problem statement - the pain point
3. Product introduction - what it is (brief)
4. Feature 1 demo + user benefit
5. Feature 2 demo + user benefit
6. Feature 3 or integration demo + benefit
7. Social proof - customer testimonial or use case
8. Call-to-action - trial, pricing, signup
9. Closing - reinforce main benefit and urgency

Each paragraph is 2-3 sentences. Focus on outcomes, not specs.
Show before/after or problem/solution. Keep pace dynamic.
${config.keyPoints ? `Key features/benefits: ${config.keyPoints.join(", ")}` : ""}
${config.additionalContext ? `Market context: ${config.additionalContext}` : ""}

Format as [Scene X]: description with UI mockups or real product footage indicated.
`,

  educational: (config: PromptConfig): string => `
You are a script writer for educational videos that build conceptual understanding.

Topic: ${config.topic}
Target Audience: ${config.targetAudience || "Student"}
Tone: ${config.tone || "explanatory"}
Duration: ${config.duration || 180} seconds

Generate an 11-paragraph educational script that builds progressively:
1. Learning objective - what the viewer will understand
2. Context - why this topic matters
3. Foundation concept 1 - build from the ground up
4. Foundation concept 2 - related concept
5. Core concept - tie foundations together
6. Application/example 1 - concrete case
7. Application/example 2 - different context
8. Common misconceptions - address confusion
9. Summary - recap key takeaways
10. Advanced topic (optional) - deeper dive
11. Resources - where to learn more

Use analogies, visual hierarchies, and memory aids.
Show abstract concepts AND concrete examples.
Address common mistakes and misconceptions.
${config.keyPoints ? `Learning outcomes: ${config.keyPoints.join(", ")}` : ""}
${config.additionalContext ? `Prerequisite knowledge: ${config.additionalContext}` : ""}

Format as [Concept/Scene X]: description with diagrams, examples, or visual representations.
`,
} as const;

export type PromptTemplateKey = keyof typeof PROMPT_TEMPLATES;

export function getPromptTemplate(formatId: string): ((config: PromptConfig) => string) | undefined {
  const key = formatId as PromptTemplateKey;
  return PROMPT_TEMPLATES[key];
}

export function generatePrompt(formatId: string, config: PromptConfig): string | null {
  const template = getPromptTemplate(formatId);
  if (!template) return null;
  return template(config);
}
