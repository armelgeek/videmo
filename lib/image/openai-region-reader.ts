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
    // Lire une image coute une fraction de ce que coute en produire une :
    // le modele de lecture n'a pas a etre le plus cher.
    model: env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
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
            required: ["beatIndex", "x", "y", "width", "height"],
            properties: {
              beatIndex: { type: "integer" },
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
