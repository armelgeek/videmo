import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ImageGeneratorNotConfiguredError } from "@/lib/image/image-generator";
import { getRegionReader } from "@/lib/image/openai-region-reader";
import { RegionReadFailedError } from "@/lib/image/region-reader";
import {
  buildVisionPrompt,
  planAnnotations,
  snapToInk,
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
  /**
   * Les sujets reellement dessines, mesures sur l'image par l'appelant. La
   * vision situe bien mais chiffre mal : quand ces rectangles existent, le
   * sien ne sert plus qu'a designer lequel.
   */
  candidates: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
      }),
    )
    .default([]),
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

    // Le rectangle devine est ramene sur le sujet qu'il designe : c'est
    // l'encre, et non le modele, qui donne les bornes.
    regions = regions.map((region) => snapToInk(region, input.candidates));

    // Les durees mesurees voyagent DANS la scene, portees par ses temps de
    // narration depuis la synthese. Un temps dont la mesure a echoue rend 0,
    // que planAnnotations traite comme une absence et remplace par
    // l'estimation du decoupage.
    const beatDurationsMs = input.scene.beats.map(
      (beat) => beat.audioDurationMs ?? 0,
    );

    return NextResponse.json({
      annotations: planAnnotations({
        scene: input.scene,
        regions,
        size,
        beatDurationsMs,
      }),
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
