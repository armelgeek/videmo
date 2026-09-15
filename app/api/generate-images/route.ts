import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ImageGenerationFailedError,
  ImageGeneratorNotConfiguredError,
} from "@/lib/image/image-generator";
import { getImageGenerator } from "@/lib/image/openai-image-generator";
import { encodeSceneImage, ensurePng } from "@/lib/image/scene-image-format";
import {
  StorageNotConfiguredError,
  buildImageKey,
} from "@/lib/storage/object-storage";
import { getObjectStorage } from "@/lib/storage/s3-storage";
import {
  buildImagePrompt,
  generateImageRequestSchema,
  imageSizeForAspectRatio,
} from "@/lib/storyboard/image-generation";
import { chargeFor } from "@/lib/billing/with-credits";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";
import { aiGenerationRateLimit, tooManyGenerations } from "@/lib/security/rate-limiter";

// Une image prend plusieurs dizaines de secondes, l'envoi au bac s'y ajoute.
export const maxDuration = 180;

/**
 * Recupere la case de reference.
 *
 * Un echec n'interrompt rien : perdre la coherence de style coute moins cher
 * que de perdre le visuel, donc l'appel repart sans reference.
 */
async function fetchReference(url: string): Promise<Uint8Array | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    // Scenes are now stored as WebP; the edits endpoint receives a PNG.
    return await ensurePng(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const limit = await aiGenerationRateLimit(viewer.userId, "images");
    if (!limit.success) return tooManyGenerations(limit.resetAt);
    const input = generateImageRequestSchema.parse(await request.json());

    // Generer coute de l'argent : le droit d'ecrire sur CE projet est verifie
    // avant d'appeler le moteur, pas apres.
    await requireProjectAccess(input.projectId, viewer, "update");

    // Moteur et bac sont resolus avant la generation : une configuration
    // incomplete doit se voir tout de suite, pas apres avoir paye une image
    // qu'on n'aurait nulle part ou ecrire.
    const generator = getImageGenerator();
    const storage = getObjectStorage();

    return await chargeFor(
      viewer,
      "generate_image",
      async () => {
        const reference = input.referenceUrl
          ? await fetchReference(input.referenceUrl)
          : undefined;

        const image = await generator.generate({
          prompt: buildImagePrompt({
            scenePrompt: input.prompt,
            aspectRatio: input.aspectRatio,
            language: input.language,
            hasReference: reference !== undefined,
          }),
          size: imageSizeForAspectRatio(input.aspectRatio),
          reference,
        });

        const encoded = await encodeSceneImage(image);
        const url = await storage.put({
          key: buildImageKey({
            projectId: input.projectId,
            sceneIndex: input.sceneIndex,
            extension: encoded.extension,
          }),
          body: encoded.body,
          contentType: encoded.contentType,
        });

        return NextResponse.json({ url });
      },
      { referenceId: input.projectId },
    );
  } catch (error) {
    if (
      error instanceof StorageNotConfiguredError ||
      error instanceof ImageGeneratorNotConfiguredError
    ) {
      return NextResponse.json(
        { error: error.message, missing: error.missing },
        { status: 503 },
      );
    }
    if (error instanceof ImageGenerationFailedError) {
      console.error("Image generation failed:", error.status, error.message);
      return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
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
