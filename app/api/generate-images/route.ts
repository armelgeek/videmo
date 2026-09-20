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
import { billingErrorResponse, chargeFor } from "@/lib/billing/with-credits";
import { assertStorageAvailable, recordStoredObject } from "@/lib/billing/org-usage";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { resolveVisualStyle } from "@/lib/storyboard/visual-styles/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";
import { aiGenerationRateLimit, tooManyGenerations } from "@/lib/security/rate-limiter";

// An image takes several tens of seconds; uploading to the bucket adds to that.
export const maxDuration = 180;

/**
 * Fetches the reference panel.
 *
 * A failure interrupts nothing: losing style consistency costs less than
 * losing the visual, so the call goes ahead without a reference.
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

    // Generating costs money: the right to write to THIS project is checked
    // before calling the engine, not after.
    await requireProjectAccess(input.projectId, viewer, "update");

    // Engine and bucket are resolved before generating: an incomplete
    // configuration must show up immediately, not after paying for an image
    // we would have nowhere to write.
    const generator = getImageGenerator();
    const storage = getObjectStorage();

    if (viewer.organizationId) await assertStorageAvailable(viewer.organizationId);

    // Resolved before the paid call, like the engine and the bucket: an unknown
    // key falls back to the default rather than failing after the charge.
    const style = await resolveVisualStyle(input.visualStyle, viewer.organizationId);

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
            style,
          }),
          size: imageSizeForAspectRatio(input.aspectRatio),
          reference,
        });

        const encoded = await encodeSceneImage(image);
        const key = buildImageKey({
          projectId: input.projectId,
          sceneIndex: input.sceneIndex,
          extension: encoded.extension,
        });
        const url = await storage.put({
          key,
          body: encoded.body,
          contentType: encoded.contentType,
        });
        if (viewer.organizationId) {
          await recordStoredObject({
            organizationId: viewer.organizationId,
            projectId: input.projectId,
            key,
            bytes: encoded.body.byteLength,
          });
        }

        return NextResponse.json({ url });
      },
      { referenceId: input.projectId },
    );
  } catch (error) {
    const billing = billingErrorResponse(error);
    if (billing) return billing;
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
