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
          regions: [{ beatIndex: 0, x: 10, y: 20, width: 300, height: 400 }],
        }),
      },
    },
  ],
};

describe("readOpenAiVisionConfig", () => {
  it("nomme la variable manquante", () => {
    expect(() => readOpenAiVisionConfig({})).toThrow(
      ImageGeneratorNotConfiguredError,
    );
  });

  it("cadre les regions avec gpt-4o par defaut", () => {
    // gpt-4o-mini situe juste mais cadre mal : verifie sur de vraies images,
    // ses rectangles couvraient 2 a 5 % de l'image au milieu du sujet.
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
  it("rend le plan de regions", async () => {
    const { impl } = stubFetch({ json: validPlan });
    const plan = await new OpenAiRegionReader(config, impl).read({
      imageUrl: "https://cdn.test/a.png",
      prompt: "where is what",
    });

    expect(plan.regions[0]).toEqual({
      beatIndex: 0,
      x: 10,
      y: 20,
      width: 300,
      height: 400,
    });
  });

  it("joint l'image et la consigne dans le meme message", async () => {
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

  it("impose un format de reponse, pour n'avoir rien a parser", async () => {
    const { impl, calls } = stubFetch({ json: validPlan });
    await new OpenAiRegionReader(config, impl).read({
      imageUrl: "https://cdn.test/a.png",
      prompt: "x",
    });

    const body = JSON.parse(calls[0].init.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it("leve une erreur typee sur refus du moteur", async () => {
    const { impl } = stubFetch({ ok: false, status: 429, text: "rate limited" });

    await expect(
      new OpenAiRegionReader(config, impl).read({ imageUrl: "u", prompt: "p" }),
    ).rejects.toBeInstanceOf(RegionReadFailedError);
  });

  it("refuse une reponse hors schema", async () => {
    const { impl } = stubFetch({
      json: { choices: [{ message: { content: JSON.stringify({ regions: [] }) } }] },
    });

    await expect(
      new OpenAiRegionReader(config, impl).read({ imageUrl: "u", prompt: "p" }),
    ).rejects.toBeInstanceOf(RegionReadFailedError);
  });

  it("refuse une reponse sans contenu", async () => {
    const { impl } = stubFetch({ json: { choices: [] } });

    await expect(
      new OpenAiRegionReader(config, impl).read({ imageUrl: "u", prompt: "p" }),
    ).rejects.toBeInstanceOf(RegionReadFailedError);
  });
});

describe("FakeRegionReader", () => {
  it("rend un plan sans reseau et retient les demandes", async () => {
    const fake = new FakeRegionReader();
    const plan = await fake.read({ imageUrl: "u", prompt: "p" });

    expect(plan.regions).toHaveLength(1);
    expect(fake.calls[0].imageUrl).toBe("u");
  });
});
