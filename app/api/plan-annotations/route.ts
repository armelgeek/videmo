import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ImageGeneratorNotConfiguredError } from "@/lib/image/image-generator";
import { getRegionReader } from "@/lib/image/openai-region-reader";
import { RegionReadFailedError } from "@/lib/image/region-reader";
import {
  buildVisionPrompt,
  planAnnotations,
  snapRegionsToSubjects,
  snapToSubject,
} from "@/lib/storyboard/annotation-planning";
import { scriptSceneSchema } from "@/lib/storyboard/script-generation";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

export const maxDuration = 120;

/**
 * Sends the encoded image rather than its address.
 *
 * The engine must download what it reads: a local-bucket URL (or a private
 * bucket) is out of its reach. Going through the server, which has access,
 * works in both cases.
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
   * The subjects actually drawn, measured on the image by the caller. Vision
   * locates well but measures poorly: when these rectangles exist, its own
   * only serves to designate which one.
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
 * Locates an image's annotations and sets their entry time.
 *
 * The script split cannot place these rectangles: it is written without
 * seeing the illustration. Reading the produced image is the only way to
 * know where each narration beat's subject is.
 *
 * The entry time needs no model: it follows from the preceding durations,
 * so the drawing follows the voice with no manual alignment.
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
      // A failed read must not deprive the scene of its annotations:
      // planAnnotations falls back to the whole image, which the user adjusts.
      console.error("Region reading failed, falling back:", error);
    }

    // The guessed rectangle is snapped to the subject it designates: the
    // measured bounds, not the model, do the framing. Anti-collision keeps
    // distinct regions apart when facing a merged candidate.
    regions = snapRegionsToSubjects(regions, input.candidates);

    // Measured durations travel INSIDE the scene, carried by its narration
    // beats since synthesis. A beat whose measurement failed yields 0, which
    // planAnnotations treats as missing and replaces with the split's
    // estimate.
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
