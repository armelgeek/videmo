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

// Le decoupage porte tout le script : il est plus long que l'ecriture.
export const maxDuration = 180;

const requestSchema = z.object({
  script: z.string().min(10).max(50_000),
  content: z.string().default(""),
  style: z.string().default("cinematic"),
  format: z.enum(["brief", "explainer"]).default("explainer"),
  language: z.string().default("en"),
  duration: z.string().default("3-5 minutes"),
  targetAudience: z.string().default("general"),
  tone: z.string().default("professional"),
});

/**
 * Second temps du parcours : transformer le script valide en scenes.
 *
 * Il est separe de l'ecriture parce que l'utilisateur relit et corrige le texte
 * entre les deux. Decouper des la premiere generation figeait des scenes que
 * les corrections suivantes n'atteignaient plus.
 */
export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const limit = await aiGenerationRateLimit(viewer.userId, "storyboard");
    if (!limit.success) return tooManyGenerations(limit.resetAt);

    const { script, ...params } = requestSchema.parse(await request.json());

    return await chargeFor(viewer, "generate_storyboard", async () => {
      const result = await storyboardAgent.generate(
        buildBreakdownPrompt({ script, params }),
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
