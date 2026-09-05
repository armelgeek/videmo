import { describe, expect, it } from "vitest";
import {
  buildImagePrompt,
  decodeBase64Image,
  generateImageRequestSchema,
  imageSizeForAspectRatio,
  openAiImageResponseSchema,
} from "./image-generation";

describe("imageSizeForAspectRatio", () => {
  it("traduit les trois formats du projet", () => {
    expect(imageSizeForAspectRatio("16:9")).toBe("1536x1024");
    expect(imageSizeForAspectRatio("9:16")).toBe("1024x1536");
    expect(imageSizeForAspectRatio("1:1")).toBe("1024x1024");
  });

  it("retombe sur le paysage plutot que d'envoyer une taille refusee", () => {
    expect(imageSizeForAspectRatio("4:3")).toBe("1536x1024");
    expect(imageSizeForAspectRatio("")).toBe("1536x1024");
  });
});

describe("buildImagePrompt", () => {
  it("rappelle le style a chaque scene", () => {
    // Le modele traite chaque appel isolement : sans ce rappel, les dix
    // visuels d'une meme video n'avaient aucune unite.
    const prompt = buildImagePrompt({
      scenePrompt: "A rustic kitchen with flour",
      style: "cinematic",
    });

    expect(prompt).toContain("A rustic kitchen with flour");
    expect(prompt).toContain("Visual style: cinematic.");
  });

  it("interdit le texte incruste", () => {
    expect(buildImagePrompt({ scenePrompt: "x", style: "y" })).toContain(
      "Do not render any text",
    );
  });
});

describe("generateImageRequestSchema", () => {
  it("accepte une demande complete", () => {
    const parsed = generateImageRequestSchema.parse({
      projectId: "p1",
      sceneIndex: 0,
      prompt: "un grain de cafe",
    });

    expect(parsed.aspectRatio).toBe("16:9");
    expect(parsed.style).toBe("cinematic");
  });

  it("refuse un index negatif ou un prompt vide", () => {
    expect(() =>
      generateImageRequestSchema.parse({
        projectId: "p1",
        sceneIndex: -1,
        prompt: "abc",
      }),
    ).toThrow();
    expect(() =>
      generateImageRequestSchema.parse({
        projectId: "p1",
        sceneIndex: 0,
        prompt: "",
      }),
    ).toThrow();
  });
});

describe("openAiImageResponseSchema", () => {
  it("accepte une reponse encodee", () => {
    expect(() =>
      openAiImageResponseSchema.parse({ data: [{ b64_json: "AAAA" }] }),
    ).not.toThrow();
  });

  it("refuse une reponse vide plutot que d'ecrire un fichier de zero octet", () => {
    expect(() => openAiImageResponseSchema.parse({ data: [] })).toThrow();
    expect(() =>
      openAiImageResponseSchema.parse({ data: [{ b64_json: "" }] }),
    ).toThrow();
  });
});

describe("decodeBase64Image", () => {
  it("rend les octets d'origine", () => {
    const bytes = decodeBase64Image(
      Buffer.from([137, 80, 78, 71]).toString("base64"),
    );

    expect(Array.from(bytes)).toEqual([137, 80, 78, 71]);
  });
});
