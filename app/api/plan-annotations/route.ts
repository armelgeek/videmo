import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ImageGeneratorNotConfiguredError } from "@/lib/image/image-generator";
import { getRegionReader } from "@/lib/image/openai-region-reader";
import { RegionReadFailedError } from "@/lib/image/region-reader";
import {
  buildVisionPrompt,
  planAnnotations,
} from "@/lib/storyboard/annotation-planning";
import { scriptSceneSchema } from "@/lib/storyboard/script-generation";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

export const maxDuration = 120;

/**
 * Envoie l'image encodee plutot que son adresse.
 *
 * Le moteur doit telecharger ce qu'il lit : une URL de bac local — ou de bac
 * prive — lui est inaccessible. Le detour par le serveur, qui lui a acces,
 * fonctionne dans les deux cas.
 */
async function toInlineImage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new RegionReadFailedError(
      `Could not read the image (HTTP ${response.status})`,
      response.status,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get("content-type") ?? "image/png";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

const requestSchema = z.object({
  projectId: z.string().min(1),
  imageUrl: z.string().url(),
  scene: scriptSceneSchema,
  width: z.number().int().positive().default(1536),
  height: z.number().int().positive().default(1024),
});

/**
 * Situe les annotations d'une image, et fixe leur entree.
 *
 * Le decoupage du script ne peut pas placer ces rectangles : il est ecrit sans
 * voir l'illustration. Une lecture de l'image produite est le seul moyen de
 * savoir ou se trouve le sujet de chaque temps de narration.
 *
 * Le moment d'entree, lui, ne demande aucun modele : il se deduit des durees
 * qui precedent, si bien que le trace suit la voix sans calage manuel.
 */
export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const input = requestSchema.parse(await request.json());
    await requireProjectAccess(input.projectId, viewer, "update");

    const size = { width: input.width, height: input.height };
    const reader = getRegionReader();

    let regions: Awaited<ReturnType<typeof reader.read>>["regions"] = [];
    try {
      const plan = await reader.read({
        imageUrl: await toInlineImage(input.imageUrl),
        prompt: buildVisionPrompt({ scene: input.scene, size }),
      });
      regions = plan.regions;
    } catch (error) {
      // Une lecture ratee ne doit pas priver la scene de ses annotations :
      // planAnnotations retombe sur l'image entiere, que l'utilisateur ajuste.
      console.error("Region reading failed, falling back:", error);
    }

    return NextResponse.json({
      annotations: planAnnotations({ scene: input.scene, regions, size }),
    });
  } catch (error) {
    if (error instanceof ImageGeneratorNotConfiguredError) {
      return NextResponse.json(
        { error: error.message, missing: error.missing },
        { status: 503 },
      );
    }
    if (error instanceof RegionReadFailedError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return toErrorResponse(error);
  }
}
