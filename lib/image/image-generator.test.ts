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

/** Un fetch qui repond ce qu'on lui dit et retient ce qu'il a recu. */
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
  it("nomme la variable manquante", () => {
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

  it("laisse choisir le modele sans toucher au code", () => {
    expect(readOpenAiImageConfig({ OPENAI_API_KEY: "k" }).model).toBe(
      "gpt-image-1",
    );
    expect(
      readOpenAiImageConfig({ OPENAI_API_KEY: "k", OPENAI_IMAGE_MODEL: "autre" })
        .model,
    ).toBe("autre");
  });

  it("fixe la qualite a medium par defaut pour ne pas payer high en silence", () => {
    expect(readOpenAiImageConfig({ OPENAI_API_KEY: "k" }).quality).toBe("medium");
    expect(
      readOpenAiImageConfig({ OPENAI_API_KEY: "k", OPENAI_IMAGE_QUALITY: "low" }).quality,
    ).toBe("low");
  });
});

describe("OpenAiImageGenerator", () => {
  it("decode l'image rendue par le moteur", async () => {
    const { impl } = stubFetch({ json: validResponse });
    const image = await new OpenAiImageGenerator(config, impl).generate({
      prompt: "un grain",
      size: "1536x1024",
    });

    expect(Array.from(image)).toEqual(Array.from(TRANSPARENT_PNG));
  });

  it("passe par generations quand il n'y a pas de reference", async () => {
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

  it("bascule sur edits des qu'une reference accompagne l'appel", async () => {
    // C'est le seul endpoint qui accepte une image d'entree, donc le seul
    // moyen de tenir le meme trait sur toute la serie.
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

  it("ne pose pas de Content-Type sur le multipart", async () => {
    // Le poser ecraserait la frontiere calculee par undici, et l'API rejette.
    const { impl, calls } = stubFetch({ json: validResponse });
    await new OpenAiImageGenerator(config, impl).generate({
      prompt: "x",
      size: "1024x1024",
      reference: TRANSPARENT_PNG,
    });

    expect(calls[0].init.headers).not.toHaveProperty("Content-Type");
  });

  it("leve une erreur typee sur refus du moteur", async () => {
    const { impl } = stubFetch({ ok: false, status: 429, text: "rate limited" });

    await expect(
      new OpenAiImageGenerator(config, impl).generate({
        prompt: "x",
        size: "1024x1024",
      }),
    ).rejects.toBeInstanceOf(ImageGenerationFailedError);
  });

  it("refuse une reponse sans image plutot que d'ecrire un fichier vide", async () => {
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
  it("rend un PNG valide sans reseau", async () => {
    const image = await new FakeImageGenerator().generate({
      prompt: "x",
      size: "1024x1024",
    });

    // Signature PNG : les octets doivent passer un vrai decodeur.
    expect(Array.from(image.slice(0, 4))).toEqual([137, 80, 78, 71]);
  });

  it("retient ce qui lui a ete demande", async () => {
    const fake = new FakeImageGenerator();
    await fake.generate({ prompt: "une scene", size: "1536x1024" });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].prompt).toBe("une scene");
  });

  it("sait simuler une panne du moteur", async () => {
    const fake = new FakeImageGenerator({
      failWith: new ImageGenerationFailedError("quota"),
    });

    await expect(
      fake.generate({ prompt: "x", size: "1024x1024" }),
    ).rejects.toThrow("quota");
  });
});
