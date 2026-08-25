import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import type { VideoGenerationRequest } from "@/lib/video-generation/types";

const videoGenerationInputSchema = z.object({
  content: z.string(),
  format: z.enum(["explainer", "brief"]),
  style: z.string(),
  aspectRatio: z.enum(["16:9", "9:16"]),
  language: z.string().default("en"),
  customInstructions: z.string().optional(),
  narrativeVoiceId: z.string().optional(),
  narrativeStyle: z.string().optional(),
});

// Step 1: Validate and prepare parameters
const validateParamsStep = createStep({
  id: "validate-params",
  inputSchema: videoGenerationInputSchema,
  outputSchema: z.object({
    isValid: z.boolean(),
    params: videoGenerationInputSchema,
    issues: z.array(z.string()).optional(),
  }),
  execute: async ({ inputData }) => {
    const issues: string[] = [];

    if (inputData.content.length < 10) {
      issues.push("Content is too short (minimum 10 characters)");
    }

    if (inputData.content.length > 50000) {
      issues.push("Content is too long (maximum 50,000 characters)");
    }

    return {
      isValid: issues.length === 0,
      params: inputData,
      issues: issues.length > 0 ? issues : undefined,
    };
  },
});

// Step 2: Generate storyboard with AI
const generateStoryboardStep = createStep({
  id: "generate-storyboard",
  inputSchema: videoGenerationInputSchema,
  outputSchema: z.object({
    title: z.string(),
    clips: z.array(
      z.object({
        index: z.number(),
        title: z.string(),
        narration: z.string(),
        imagePrompt: z.string(),
        duration: z.number(),
      })
    ),
    narrativeStyle: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent("videoChatAgent");

    // Use agent to generate storyboard
    const response = await agent.generate(
      `Create a ${inputData.format} video storyboard for this content in ${inputData.language}:

Content: ${inputData.content}

Format as JSON with:
- title: Main video title
- clips: Array of {index, title, narration, imagePrompt, duration}
- narrativeStyle: Style of narration

Make it engaging and match the ${inputData.style} visual style.`,
      {
        schema: z.object({
          title: z.string(),
          clips: z.array(z.any()),
          narrativeStyle: z.string(),
        }),
      }
    );

    return {
      title: response.title || "Generated Video",
      clips: response.clips || [],
      narrativeStyle: response.narrativeStyle || "professional",
    };
  },
});

// Step 3: Generate images for each clip
const generateImagesStep = createStep({
  id: "generate-images",
  inputSchema: z.object({
    clips: z.array(z.object({ index: z.number(), imagePrompt: z.string() })),
    style: z.string(),
  }),
  outputSchema: z.object({
    clipsWithImages: z.array(
      z.object({
        index: z.number(),
        imageUrl: z.string().optional(),
        imagePrompt: z.string(),
        status: z.enum(["pending", "generated", "failed"]),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    // Simulate image generation (in production, call Gemini or other service)
    const clipsWithImages = inputData.clips.map((clip) => ({
      index: clip.index,
      imagePrompt: clip.imagePrompt,
      imageUrl: undefined, // Would be populated by actual image service
      status: "pending" as const,
    }));

    return { clipsWithImages };
  },
});

// Step 4: Generate narration audio
const generateNarrationStep = createStep({
  id: "generate-narration",
  inputSchema: z.object({
    clips: z.array(
      z.object({
        index: z.number(),
        narration: z.string(),
      })
    ),
    language: z.string(),
    narrativeVoiceId: z.string().optional(),
  }),
  outputSchema: z.object({
    clipsWithAudio: z.array(
      z.object({
        index: z.number(),
        audioUrl: z.string().optional(),
        narration: z.string(),
        duration: z.number(),
        status: z.enum(["pending", "generated", "failed"]),
      })
    ),
  }),
  execute: async ({ inputData }) => {
    // Simulate audio generation (in production, call ElevenLabs or similar)
    const clipsWithAudio = inputData.clips.map((clip) => ({
      index: clip.index,
      narration: clip.narration,
      audioUrl: undefined, // Would be populated by actual TTS service
      duration: Math.ceil(clip.narration.split(" ").length / 2), // Rough estimate
      status: "pending" as const,
    }));

    return { clipsWithAudio };
  },
});

// Step 5: Combine into video
const combineVideoStep = createStep({
  id: "combine-video",
  inputSchema: z.object({
    title: z.string(),
    clips: z.array(
      z.object({
        index: z.number(),
        imageUrl: z.string().optional(),
        audioUrl: z.string().optional(),
      })
    ),
    aspectRatio: z.enum(["16:9", "9:16"]),
  }),
  outputSchema: z.object({
    videoUrl: z.string(),
    totalDuration: z.number(),
    status: z.enum(["success", "failed"]),
  }),
  execute: async ({ inputData }) => {
    // Simulate video creation (in production, use FFmpeg)
    return {
      videoUrl: `/videos/${inputData.title.toLowerCase().replace(/\s+/g, "-")}.mp4`,
      totalDuration: inputData.clips.length * 10,
      status: "success" as const,
    };
  },
});

// Main workflow
export const videoGenerationWorkflow = createWorkflow({
  id: "video-generation",
  title: "Video Generation Workflow",
  description: "Generate videos from text content using AI",
  inputSchema: videoGenerationInputSchema,
  outputSchema: z.object({
    videoUrl: z.string(),
    totalDuration: z.number(),
    clipsCount: z.number(),
  }),
  steps: [validateParamsStep, generateStoryboardStep, generateImagesStep, generateNarrationStep, combineVideoStep],
  execute: async ({ context, mastra }) => {
    // Step 1: Validate
    const validation = await validateParamsStep.execute({
      inputData: context.inputData,
      mastra,
    });

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.issues?.join(", ")}`);
    }

    // Step 2: Generate storyboard
    const storyboard = await generateStoryboardStep.execute({
      inputData: context.inputData,
      mastra,
    });

    // Step 3: Generate images
    const images = await generateImagesStep.execute({
      inputData: {
        clips: storyboard.clips,
        style: context.inputData.style,
      },
      mastra,
    });

    // Step 4: Generate narration
    const audio = await generateNarrationStep.execute({
      inputData: {
        clips: storyboard.clips,
        language: context.inputData.language,
        narrativeVoiceId: context.inputData.narrativeVoiceId,
      },
      mastra,
    });

    // Step 5: Combine
    const video = await combineVideoStep.execute({
      inputData: {
        title: storyboard.title,
        clips: images.clipsWithImages,
        aspectRatio: context.inputData.aspectRatio,
      },
      mastra,
    });

    return {
      videoUrl: video.videoUrl,
      totalDuration: video.totalDuration,
      clipsCount: storyboard.clips.length,
    };
  },
});
