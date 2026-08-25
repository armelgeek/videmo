import { createAgent } from "@mastra/core/agents";
import { z } from "zod";

const videoGenerationParamsSchema = z.object({
  content: z.string().describe("The content for the video"),
  format: z
    .enum(["explainer", "brief"])
    .describe("Type of video: explainer (detailed) or brief (short)"),
  style: z
    .enum([
      "watercolor",
      "anime",
      "retro",
      "whiteboard",
      "classic",
      "cinematic",
      "isometric",
      "flat",
      "comic",
      "neon",
      "oil",
      "sketch",
      "papercut",
      "popart",
      "storybook",
      "pixel",
      "minimalist",
      "infographic",
      "documentary",
      "gothic",
      "pastel",
      "3b1b",
      "corporate",
      "presentation",
      "tech",
    ])
    .describe("Visual style for the video"),
  aspectRatio: z
    .enum(["16:9", "9:16"])
    .describe("Video aspect ratio: 16:9 for widescreen, 9:16 for vertical"),
  language: z
    .enum([
      "en",
      "es",
      "fr",
      "de",
      "it",
      "pt",
      "pl",
      "tr",
      "ru",
      "nl",
      "cs",
      "ar",
      "zh",
      "ja",
      "ko",
      "hi",
    ])
    .describe("Narration language"),
  customInstructions: z
    .string()
    .optional()
    .describe("Custom instructions for video generation"),
});

export const videoChatAgent = createAgent({
  name: "videoChatAgent",
  instructions: `You are an intelligent video generation assistant. Your job is to:

1. Listen to user requests in natural language (e.g., "Create a 2-minute anime video about quantum computing")
2. Extract the video content and parameters from their request
3. Determine the best video format (explainer vs brief based on length/detail)
4. Suggest an appropriate visual style based on the topic
5. Confirm the parameters with the user before generation starts

When extracting parameters:
- Content: Use the full text from user's description
- Format: "explainer" if they ask for detailed/educational, "brief" if short/quick
- Style: Choose based on topic (e.g., "anime" for Japanese topics, "cinematic" for dramatic content)
- Aspect Ratio: "16:9" for desktop/TV, "9:16" for mobile/TikTok/Shorts
- Language: Detect from context or ask if unclear

Always be helpful and suggest reasonable defaults.`,
  model: "claude-opus-5",
  tools: [
    {
      id: "extract_video_params",
      description:
        "Extract video generation parameters from user input and generate the video",
      inputSchema: videoGenerationParamsSchema,
      execute: async (params) => {
        return {
          success: true,
          params,
          message: `Video generation parameters extracted. Ready to create a ${params.format} video in ${params.style} style with ${params.aspectRatio} aspect ratio.`,
        };
      },
    },
  ],
});
