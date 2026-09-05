import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { storyboardAgent } from "@/lib/mastra/agents/storyboard-agent";
import {
  buildScriptPrompt,
  generatedScriptSchema,
} from "@/lib/storyboard/script-generation";

// La generation depasse largement le budget par defaut d'une fonction edge.
export const maxDuration = 120;

const requestSchema = z.object({
  content: z.string().min(10).max(50_000),
  style: z.string().default("cinematic"),
  format: z.enum(["brief", "explainer"]).default("explainer"),
  language: z.string().default("en"),
  duration: z.string().default("3-5 minutes"),
  targetAudience: z.string().default("general"),
  tone: z.string().default("professional"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const input = requestSchema.parse(await request.json());

    const result = await storyboardAgent.generate(buildScriptPrompt(input), {
      structuredOutput: { schema: generatedScriptSchema },
    });

    // Le modele peut rendre un objet hors schema malgre la contrainte : on
    // prefere un 502 explicite a un script vide affiche comme un succes.
    const parsed = generatedScriptSchema.safeParse(result.object);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "The model returned an unusable script" },
        { status: 502 },
      );
    }

    // Un texte, rien d'autre : le decoupage en scenes attend que l'utilisateur
    // ait valide, et corrige, ce qui sera dit.
    return NextResponse.json(parsed.data);
  } catch (error) {
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
