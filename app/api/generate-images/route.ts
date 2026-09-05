import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildImagePrompt,
  decodeBase64Image,
  generateImageRequestSchema,
  imageSizeForAspectRatio,
  openAiImageResponseSchema,
} from "@/lib/storyboard/image-generation";
import { StorageNotConfiguredError, buildImageKey } from "@/lib/storage/object-storage";
import { getObjectStorage } from "@/lib/storage/s3-storage";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

// Une image prend plusieurs dizaines de secondes, l'envoi au bac s'y ajoute.
export const maxDuration = 180;

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";

/**
 * Recupere la case de reference.
 *
 * Un echec n'interrompt rien : perdre la coherence de style coute moins cher
 * que de perdre le visuel, donc l'appel repart sans reference.
 */
async function fetchReference(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function buildEditsForm(input: {
  prompt: string;
  size: string;
  reference: Uint8Array;
}): FormData {
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", input.prompt);
  form.append("size", input.size);
  form.append("n", "1");
  form.append(
    "image",
    new Blob([input.reference as unknown as BlobPart], { type: "image/png" }),
    "reference.png",
  );
  return form;
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const input = generateImageRequestSchema.parse(await request.json());

    // Generer coute de l'argent : le droit d'ecrire sur CE projet est verifie
    // avant d'appeler le modele, pas apres.
    await requireProjectAccess(input.projectId, viewer, "update");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 503 },
      );
    }

    // Le bac est lu avant la generation : sans lui l'image serait produite,
    // facturee, puis jetee faute d'endroit ou l'ecrire.
    const storage = getObjectStorage();

    const size = imageSizeForAspectRatio(input.aspectRatio);
    const reference = input.referenceUrl
      ? await fetchReference(input.referenceUrl)
      : null;

    const prompt = buildImagePrompt({
      scenePrompt: input.prompt,
      aspectRatio: input.aspectRatio,
      language: input.language,
      hasReference: reference !== null,
    });

    // Avec une reference, l'appel passe par `edits` : c'est le seul endpoint
    // qui accepte une image d'entree, et la coherence de trait entre cases ne
    // s'obtient pas par la consigne seule.
    const response = reference
      ? await fetch(OPENAI_EDITS_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: buildEditsForm({ prompt, size, reference }),
        })
      : await fetch(OPENAI_IMAGES_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt,
            n: 1,
            size,
          }),
        });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Image generation failed:", response.status, detail.slice(0, 500));
      return NextResponse.json(
        { error: "Image generation failed" },
        { status: 502 },
      );
    }

    const parsed = openAiImageResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "The model returned no usable image" },
        { status: 502 },
      );
    }

    const url = await storage.put({
      key: buildImageKey({
        projectId: input.projectId,
        sceneIndex: input.sceneIndex,
      }),
      body: decodeBase64Image(parsed.data.data[0].b64_json),
      contentType: "image/png",
    });

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return NextResponse.json(
        { error: error.message, missing: error.missing },
        { status: 503 },
      );
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
