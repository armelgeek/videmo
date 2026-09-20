import { describe, expect, it } from "vitest";
import {
  FakeRegionReader,
  RegionReadFailedError,
} from "./region-reader";
import {
  OpenAiRegionReader,
  readOpenAiVisionConfig,
} from "./openai-region-reader";
import { ImageGeneratorNotConfiguredError } from "./image-generator";

const config = { apiKey: "sk-test", model: "gpt-4o-mini" };

function stubFetch(response: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.json ?? {},
      text: async () => response.text ?? "",
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const validPlan = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          regions: [
            {
              beatIndex: 0,
              label: "Grain de café",
              x: 10,
              y: 20,
              width: 300,
              height: 400,
            },
          ],
        }),
      },
    },
  ],
};

describe("readOpenAiVisionConfig", () => {
  it("names the missing variable", () => {
    expect(() => readOpenAiVisionConfig({})).toThrow(
      ImageGeneratorNotConfiguredError,
    );
  });

  it("frames regions with gpt-4o by default", () => {
    // gpt-4o-mini locates correctly but frames poorly: checked on real images,
    // its rectangles covered 2 to 5% of the image in the middle of the subject.
    expect(readOpenAiVisionConfig({ OPENAI_API_KEY: "k" }).model).toBe("gpt-4o");
    expect(
      readOpenAiVisionConfig({
        OPENAI_API_KEY: "k",
        OPENAI_VISION_MODEL: "gpt-4o-mini",
      }).model,
    ).toBe("gpt-4o-mini");
  });
});

describe("OpenAiRegionReader", () => {
  it("returns the region plan with its label", async () => {
    const { impl } = stubFetch({ json: validPlan });
    const plan = await new OpenAiRegionReader(config, impl).read({
      imageUrl: "https://cdn.test/a.png",
      prompt: "where is what",
    });

    expect(plan.regions[0]).toEqual({
      beatIndex: 0,
      label: "Grain de café",
      x: 10,
      y: 20,
      width: 300,
      height: 400,
    });
  });

  it("attaches the image and the instruction in the same message", async () => {
    const { impl, calls } = stubFetch({ json: validPlan });
    await new OpenAiRegionReader(config, impl).read({
      imageUrl: "https://cdn.test/a.png",
      prompt: "where is what",
    });

    const body = JSON.parse(calls[0].init.body as string);
    const content = body.messages[0].content;
    expect(content[0]).toMatchObject({ type: "text", text: "where is what" });
    expect(content[1].image_url.url).toBe("https://cdn.test/a.png");
  });

  it("enforces a response format, so there is nothing to parse", async () => {
    const { impl, calls } = stubFetch({ json: validPlan });
    await new OpenAiRegionReader(config, impl).read({
      imageUrl: "https://cdn.test/a.png",
      prompt: "x",
    });

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(
      body.response_format.json_schema.schema.properties.regions.items.required,
    ).toContain("label");
  });

  it("throws a typed error when the engine refuses", async () => {
    const { impl } = stubFetch({ ok: false, status: 429, text: "rate limited" });

    await expect(
      new OpenAiRegionReader(config, impl).read({ imageUrl: "u", prompt: "p" }),
    ).rejects.toBeInstanceOf(RegionReadFailedError);
  });

  it("rejects a response outside the schema", async () => {
    const { impl } = stubFetch({
      json: { choices: [{ message: { content: JSON.stringify({ regions: [] }) } }] },
    });

    await expect(
      new OpenAiRegionReader(config, impl).read({ imageUrl: "u", prompt: "p" }),
    ).rejects.toBeInstanceOf(RegionReadFailedError);
  });

  it("rejects a response without content", async () => {
    const { impl } = stubFetch({ json: { choices: [] } });

    await expect(
      new OpenAiRegionReader(config, impl).read({ imageUrl: "u", prompt: "p" }),
    ).rejects.toBeInstanceOf(RegionReadFailedError);
  });
});

describe("FakeRegionReader", () => {
  it("returns a plan without network and records requests", async () => {
    const fake = new FakeRegionReader();
    const plan = await fake.read({ imageUrl: "u", prompt: "p" });

    expect(plan.regions).toHaveLength(1);
    expect(fake.calls[0].imageUrl).toBe("u");
  });
});
