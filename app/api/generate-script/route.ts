import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chargeFor } from "@/lib/billing/with-credits";
import { aiGenerationRateLimit, tooManyGenerations } from "@/lib/security/rate-limiter";
import { ProjectUnauthorizedError, requireViewer, toErrorResponse } from "@/lib/video-project/session";
import { storyboardAgent } from "@/lib/mastra/agents/storyboard-agent";
import {
  buildScriptPrompt,
  generatedScriptSchema,
} from "@/lib/storyboard/script-generation";
import { DEFAULT_FORMAT_ID } from "@/lib/storyboard/formats/built-in";
import { resolveFormat } from "@/lib/storyboard/formats/repository";

// Generation far exceeds the default budget of an edge function.
export const maxDuration = 120;

const requestSchema = z.object({
  content: z.string().min(10).max(50_000),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  // Not an enum any more: formats live in the database, and an organization
  // writes its own. An unknown key falls back at resolution.
  format: z.string().max(64).default(DEFAULT_FORMAT_ID),
  language: z.string().default("en"),
  duration: z.string().default("3-5 minutes"),
  targetAudience: z.string().default("general"),
  tone: z.string().default("professional"),
});

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const limit = await aiGenerationRateLimit(viewer.userId, "script");
    if (!limit.success) return tooManyGenerations(limit.resetAt);

    const input = requestSchema.parse(await request.json());
    const format = await resolveFormat(input.format, viewer.organizationId);

    return await chargeFor(viewer, "generate_script", async () => {
      const result = await storyboardAgent.generate(
        buildScriptPrompt(input, format),
        { structuredOutput: { schema: generatedScriptSchema } },
      );

      // The model can return an off-schema object despite the constraint: we
      // prefer an explicit 502 over an empty script shown as a success.
      const parsed = generatedScriptSchema.safeParse(result.object);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "The model returned an unusable script" },
          { status: 502 },
        );
      }

      // Text, nothing else: splitting into scenes waits until the user has
      // approved, and corrected, what will be said.
      return NextResponse.json(parsed.data);
    });
  } catch (error) {
    if (error instanceof ProjectUnauthorizedError) return toErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Script generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate script" },
      { status: 500 },
    );
  }
}
