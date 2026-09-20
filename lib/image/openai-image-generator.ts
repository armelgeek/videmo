import { z } from "zod";
import {
  type GenerateImageInput,
  ImageGenerationFailedError,
  type ImageGenerator,
  ImageGeneratorNotConfiguredError,
} from "./image-generator";

const GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const EDITS_URL = "https://api.openai.com/v1/images/edits";

/** The API returns the encoded image, never a URL to download. */
const responseSchema = z.object({
  data: z.array(z.object({ b64_json: z.string().min(1) })).min(1),
});

export interface OpenAiImageConfig {
  apiKey: string;
  model: string;
  quality: string;
}

export function readOpenAiImageConfig(
  env: Record<string, string | undefined> = process.env,
): OpenAiImageConfig {
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new ImageGeneratorNotConfiguredError(["OPENAI_API_KEY"]);
  }
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1",
    // Left unset, the API picks "auto", which can bill "high" (~4x "medium") and put plans at a loss.
    quality: env.OPENAI_IMAGE_QUALITY?.trim() || "medium",
  };
}

export class OpenAiImageGenerator implements ImageGenerator {
  constructor(
    private readonly config: OpenAiImageConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(input: GenerateImageInput): Promise<Uint8Array> {
    const response = input.reference
      ? await this.callEdits(input, input.reference)
      : await this.callGenerations(input);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ImageGenerationFailedError(
        `Image generation failed: ${detail.slice(0, 300)}`,
        response.status,
      );
    }

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ImageGenerationFailedError("The model returned no usable image");
    }

    return Uint8Array.from(Buffer.from(parsed.data.data[0].b64_json, "base64"));
  }

  private callGenerations(input: GenerateImageInput) {
    return this.fetchImpl(GENERATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: input.prompt,
        n: 1,
        size: input.size,
        quality: this.config.quality,
      }),
    });
  }

  /**
   * `edits` is the only endpoint that accepts an input image: stroke
   * consistency across the panels of a series cannot be achieved by the prompt
   * alone. It requires multipart, hence no Content-Type here — the browser, or
   * undici, sets the boundary itself.
   */
  private callEdits(input: GenerateImageInput, reference: Uint8Array) {
    const form = new FormData();
    form.append("model", this.config.model);
    form.append("prompt", input.prompt);
    form.append("size", input.size);
    form.append("quality", this.config.quality);
    form.append("n", "1");
    form.append(
      "image",
      new Blob([reference as unknown as BlobPart], { type: "image/png" }),
      "reference.png",
    );

    return this.fetchImpl(EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
      body: form,
    });
  }
}

let cached: ImageGenerator | null = null;

/** The client is kept across requests, like the object storage one. */
export function getImageGenerator(): ImageGenerator {
  if (!cached) cached = new OpenAiImageGenerator(readOpenAiImageConfig());
  return cached;
}
