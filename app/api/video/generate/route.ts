import { NextRequest, NextResponse } from "next/server";
import { videoGenerationSchema } from "@/lib/video-generation/types";
import { videoStore } from "@/lib/video-generation/store";
import { mastra } from "@/lib/mastra";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    const validatedData = videoGenerationSchema.parse(body);

    // Create job
    const job = videoStore.createJob(validatedData);

    // Start generation in background (without awaiting)
    generateVideoWithMastra(job.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        message: "Video generation started",
      },
      { status: 202 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to start video generation",
      },
      { status: 400 }
    );
  }
}

async function generateVideoWithMastra(jobId: string, request: any) {
  try {
    videoStore.updateProgress(jobId, {
      status: "processing",
      stage: "Initializing video generation with AI...",
      progress: 0,
    });

    // Simulate video generation workflow execution
    // In production, connect to actual open-video-overview service
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = {
      videoUrl: `/videos/${Date.now()}.mp4`,
      totalDuration: request.format === "explainer" ? 180 : 45,
      clipsCount: request.format === "explainer" ? 5 : 2,
    };

    // Update progress with result
    videoStore.updateProgress(jobId, {
      status: "completed",
      stage: "Complete",
      progress: 100,
      videoUrl: result.videoUrl,
      clips: [
        {
          index: 0,
          title: "Intro",
          imageUrl: `/api/video/mock/${jobId}/clip-0.jpg`,
          status: "generated",
        },
        {
          index: 1,
          title: "Content",
          imageUrl: `/api/video/mock/${jobId}/clip-1.jpg`,
          status: "generated",
        },
        {
          index: 2,
          title: "Outro",
          imageUrl: `/api/video/mock/${jobId}/clip-2.jpg`,
          status: "generated",
        },
      ],
    });
  } catch (error) {
    console.error("Video generation error:", error);
    videoStore.updateProgress(jobId, {
      status: "error",
      error: error instanceof Error ? error.message : "Generation failed",
    });
  }
}
