import { describe, expect, it } from "vitest";
import {
  FakeImageGenerator,
  ImageGenerationFailedError,
  ImageGeneratorNotConfiguredError,
  TRANSPARENT_PNG,
} from "./image-generator";
import {
  OpenAiImageGenerator,
  readOpenAiImageConfig,
} from "./openai-image-generator";

const config = { apiKey: "sk-test", model: "gpt-image-1", quality: "medium" };

/** A fetch that answers what it is told and records what it received. */
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

const validResponse = {
  data: [{ b64_json: Buffer.from(TRANSPARENT_PNG).toString("base64") }],
};

describe("readOpenAiImageConfig", () => {
  it("names the missing variable", () => {
    try {
      readOpenAiImageConfig({});
      expect.unreachable("aurait du lever");
    } catch (error) {
      expect(error).toBeInstanceOf(ImageGeneratorNotConfiguredError);
      expect((error as ImageGeneratorNotConfiguredError).missing).toEqual([
        "OPENAI_API_KEY",
      ]);
    }
  });

  it("lets the model be chosen without touching the code", () => {
    expect(readOpenAiImageConfig({ OPENAI_API_KEY: "k" }).model).toBe(
      "gpt-image-1",
    );
    expect(
      readOpenAiImageConfig({ OPENAI_API_KEY: "k", OPENAI_IMAGE_MODEL: "autre" })
        .model,
    ).toBe("autre");
  });

  it("defaults quality to medium to avoid silently paying for high", () => {
    expect(readOpenAiImageConfig({ OPENAI_API_KEY: "k" }).quality).toBe("medium");
    expect(
      readOpenAiImageConfig({ OPENAI_API_KEY: "k", OPENAI_IMAGE_QUALITY: "low" }).quality,
    ).toBe("low");
  });
});

describe("OpenAiImageGenerator", () => {
  it("decodes the image returned by the engine", async () => {
    const { impl } = stubFetch({ json: validResponse });
    const image = await new OpenAiImageGenerator(config, impl).generate({
      prompt: "un grain",
      size: "1536x1024",
    });

    expect(Array.from(image)).toEqual(Array.from(TRANSPARENT_PNG));
  });

  it("uses generations when there is no reference", async () => {
    const { impl, calls } = stubFetch({ json: validResponse });
    await new OpenAiImageGenerator(config, impl).generate({
      prompt: "un grain",
      size: "1024x1024",
    });

    expect(calls[0].url).toContain("/images/generations");
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      model: "gpt-image-1",
      prompt: "un grain",
      size: "1024x1024",
      quality: "medium",
    });
  });

  it("switches to edits as soon as a reference comes with the call", async () => {
    // It is the only endpoint that accepts an input image, hence the only
    // way to keep the same stroke across the whole series.
    const { impl, calls } = stubFetch({ json: validResponse });
    await new OpenAiImageGenerator(config, impl).generate({
      prompt: "un grain",
      size: "1536x1024",
      reference: TRANSPARENT_PNG,
    });

    expect(calls[0].url).toContain("/images/edits");
    expect(calls[0].init.body).toBeInstanceOf(FormData);
    expect((calls[0].init.body as FormData).get("image")).toBeInstanceOf(Blob);
  });

  it("does not set Content-Type on the multipart", async () => {
    // Setting it would overwrite the boundary computed by undici, and the API rejects.
    const { impl, calls } = stubFetch({ json: validResponse });
    await new OpenAiImageGenerator(config, impl).generate({
      prompt: "x",
      size: "1024x1024",
      reference: TRANSPARENT_PNG,
    });

    expect(calls[0].init.headers).not.toHaveProperty("Content-Type");
  });

  it("throws a typed error when the engine refuses", async () => {
    const { impl } = stubFetch({ ok: false, status: 429, text: "rate limited" });

    await expect(
      new OpenAiImageGenerator(config, impl).generate({
        prompt: "x",
        size: "1024x1024",
      }),
    ).rejects.toBeInstanceOf(ImageGenerationFailedError);
  });

  it("rejects a response without an image rather than writing an empty file", async () => {
    const { impl } = stubFetch({ json: { data: [] } });

    await expect(
      new OpenAiImageGenerator(config, impl).generate({
        prompt: "x",
        size: "1024x1024",
      }),
    ).rejects.toBeInstanceOf(ImageGenerationFailedError);
  });
});

describe("FakeImageGenerator", () => {
  it("returns a valid PNG without network", async () => {
    const image = await new FakeImageGenerator().generate({
      prompt: "x",
      size: "1024x1024",
    });

    // PNG signature: the bytes must pass a real decoder.
    expect(Array.from(image.slice(0, 4))).toEqual([137, 80, 78, 71]);
  });

  it("records what it was asked", async () => {
    const fake = new FakeImageGenerator();
    await fake.generate({ prompt: "une scene", size: "1536x1024" });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].prompt).toBe("une scene");
  });

  it("can simulate an engine failure", async () => {
    const fake = new FakeImageGenerator({
      failWith: new ImageGenerationFailedError("quota"),
    });

    await expect(
      fake.generate({ prompt: "x", size: "1024x1024" }),
    ).rejects.toThrow("quota");
  });
});
