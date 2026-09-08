import {
  type AnnotationPlan,
  annotationPlanSchema,
} from "@/lib/storyboard/annotation-planning";
import {
  ImageGeneratorNotConfiguredError,
} from "./image-generator";
import {
  type ReadRegionsInput,
  RegionReadFailedError,
  type RegionReader,
} from "./region-reader";

const RESPONSES_URL = "https://api.openai.com/v1/chat/completions";

export interface OpenAiVisionConfig {
  apiKey: string;
  model: string;
}

export function readOpenAiVisionConfig(
  env: Record<string, string | undefined> = process.env,
): OpenAiVisionConfig {
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new ImageGeneratorNotConfiguredError(["OPENAI_API_KEY"]);
  }
  return {
    apiKey: env.OPENAI_API_KEY,
    // gpt-4o-mini situe les sujets dans le bon ordre mais ne les CADRE pas :
    // verifie sur de vraies images, il posait des rectangles de 2 a 5 % de
    // l'image au milieu du sujet, la ou gpt-4o rend 21 a 35 % autour de lui.
    // Lire une image reste une fraction du prix d'en produire une, et une
    // annotation mal cadree se repaie en reglages a la main.
    model: env.OPENAI_VISION_MODEL?.trim() || "gpt-4o",
  };
}

/** Le format impose a la reponse, pour qu'elle soit exploitable sans parsing. */
const RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "annotation_plan",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["regions"],
      properties: {
        regions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["beatIndex", "label", "x", "y", "width", "height"],
            properties: {
              beatIndex: { type: "integer" },
              label: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
            },
          },
        },
      },
    },
  },
};

export class OpenAiRegionReader implements RegionReader {
  constructor(
    private readonly config: OpenAiVisionConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async read(input: ReadRegionsInput): Promise<AnnotationPlan> {
    const response = await this.fetchImpl(RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        response_format: RESPONSE_FORMAT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: input.prompt },
              { type: "image_url", image_url: { url: input.imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new RegionReadFailedError(
        `Region reading failed: ${detail.slice(0, 300)}`,
        response.status,
      );
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new RegionReadFailedError("The model returned no region plan");
    }

    const parsed = annotationPlanSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      throw new RegionReadFailedError("The model returned an unusable region plan");
    }
    return parsed.data;
  }
}

let cached: RegionReader | null = null;

export function getRegionReader(): RegionReader {
  if (!cached) cached = new OpenAiRegionReader(readOpenAiVisionConfig());
  return cached;
}
