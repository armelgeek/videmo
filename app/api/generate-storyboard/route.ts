import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chargeFor } from "@/lib/billing/with-credits";
import { aiGenerationRateLimit, tooManyGenerations } from "@/lib/security/rate-limiter";
import { ProjectUnauthorizedError, requireViewer, toErrorResponse } from "@/lib/video-project/session";
import { storyboardAgent } from "@/lib/mastra/agents/storyboard-agent";
import {
  buildBreakdownPrompt,
  reindexScenes,
  storyboardBreakdownSchema,
} from "@/lib/storyboard/script-generation";
import { DEFAULT_FORMAT_ID } from "@/lib/storyboard/formats/built-in";
import { resolveFormat } from "@/lib/storyboard/formats/repository";

// The split covers the whole script: it takes longer than writing.
export const maxDuration = 180;

const requestSchema = z.object({
  script: z.string().min(10).max(50_000),
  content: z.string().default(""),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  // Not an enum any more: formats live in the database, and an organization
  // writes its own. An unknown key falls back at resolution.
  format: z.string().max(64).default(DEFAULT_FORMAT_ID),
  language: z.string().default("en"),
  duration: z.string().default("3-5 minutes"),
  targetAudience: z.string().default("general"),
  tone: z.string().default("professional"),
});

/**
 * Second stage of the flow: turn the approved script into scenes.
 *
 * It is separate from writing because the user rereads and corrects the text
 * in between. Splitting on the first generation froze scenes that later
 * corrections no longer reached.
 */
export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const limit = await aiGenerationRateLimit(viewer.userId, "storyboard");
    if (!limit.success) return tooManyGenerations(limit.resetAt);

    const { script, ...params } = requestSchema.parse(await request.json());
    const format = await resolveFormat(params.format, viewer.organizationId);

    return await chargeFor(viewer, "generate_storyboard", async () => {
      const result = await storyboardAgent.generate(
        buildBreakdownPrompt({ script, params, format }),
        { structuredOutput: { schema: storyboardBreakdownSchema } },
      );

      const parsed = storyboardBreakdownSchema.safeParse(result.object);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "The model returned an unusable breakdown" },
          { status: 502 },
        );
      }

      return NextResponse.json({ scenes: reindexScenes(parsed.data.scenes) });
    });
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return toErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Storyboard breakdown error:", error);
    return NextResponse.json(
      { error: "Failed to break down the script" },
      { status: 500 },
    );
  }
}
