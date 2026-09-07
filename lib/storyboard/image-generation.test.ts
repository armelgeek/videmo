import { describe, expect, it } from "vitest";
import {
  buildImagePrompt,
  generateImageRequestSchema,
  imageSizeForAspectRatio,
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
  const prompt = buildImagePrompt({
    scenePrompt: "A rustic kitchen with flour",
    aspectRatio: "16:9",
  });

  it("place la scene demandee", () => {
    expect(prompt).toContain("A rustic kitchen with flour");
  });

  it("impose ce que le moteur sait lire", () => {
    // Chaque consigne repond a une panne du pipeline : trait rompu, fond
    // texture lu comme de l'encre, sujets colles dont les rectangles se
    // chevauchent.
    expect(prompt).toContain("continuous");
    expect(prompt).toContain("#FFFFFF");
    expect(prompt).toContain("no texture");
    expect(prompt).toContain("SEPARATED");
    // Le fond creme se lisait comme de l'encre : le blanc pur ne suffit pas a
    // l'ecrit, la teinte doit etre nommee interdite.
    expect(prompt).toContain("no off-white or cream tint");
  });

  it("interdit ce qui produit du bruit", () => {
    expect(prompt).toContain("Photorealism");
    expect(prompt).toContain("no shading, no gradients, no shadows");
  });

  it("demande le vocabulaire d'un explainer", () => {
    // Fleches et encadres sont des traits continus : ils n'ajoutent aucun
    // bruit, et c'est ce qui fait un whiteboard explainer.
    expect(prompt).toContain("hand-drawn arrows");
    expect(prompt).toContain("boxes and underlines");
  });

  it("accepte des mots-cles mais jamais des phrases", () => {
    // Mesure sur la meme scene : 23 composantes sans texte, 118 avec, contre
    // 336 encore lisibles. Un paragraphe, lui, ferait exploser le compte.
    expect(prompt).toContain("SHORT hand-lettered keyword label");
    expect(prompt).toContain("three words at most");
    expect(prompt).toContain("Sentences, paragraphs, or any block of running text");
    // « quelques mots-cles » laissait des sujets anonymes : chacun doit
    // desormais porter le sien.
    expect(prompt).toContain("EVERY drawn subject MUST have");
    expect(prompt).toContain("Any drawn subject left unlabelled");
  });

  it("ecrit les etiquettes dans la langue du projet", () => {
    // Le texte vit dans l'image : une etiquette dans la mauvaise langue ne se
    // corrige pas apres coup.
    expect(
      buildImagePrompt({ scenePrompt: "x", language: "fr" }),
    ).toContain("written in French");
    expect(
      buildImagePrompt({ scenePrompt: "x", language: "en" }),
    ).toContain("written in English");
  });

  it("suit l'orientation du projet", () => {
    expect(prompt).toContain("16:9 landscape");
    expect(
      buildImagePrompt({ scenePrompt: "x", aspectRatio: "9:16" }),
    ).toContain("9:16 portrait");
    expect(
      buildImagePrompt({ scenePrompt: "x", aspectRatio: "1:1" }),
    ).toContain("1:1 square");
  });

  it("retombe sur le paysage si le ratio est inconnu", () => {
    expect(buildImagePrompt({ scenePrompt: "x" })).toContain("16:9 landscape");
  });

  it("n'introduit jamais le style narratif du projet", () => {
    // "cinematic" produirait exactement le photorealisme et les ombres que la
    // liste interdit : le style decrit la narration, pas le trait.
    expect(prompt.toLowerCase()).not.toContain("cinematic");
  });

  it("porte la liste de verification demandee avant rendu", () => {
    expect(prompt).toContain("Before returning the image, verify every point:");
    expect(prompt).toContain("has its own keyword label, correctly spelled");
    expect(prompt).toContain("Background is pure white #FFFFFF");
    expect(prompt).toContain("fits inside its own rectangle");
    expect(prompt).toContain("clean and unbroken");
    expect(prompt).toContain("No shadow and no gradient");
    expect(prompt).toContain("consistent across the series");
  });

  it("n'evoque une reference que lorsqu'elle accompagne l'appel", () => {
    expect(prompt).not.toContain("reference image");

    const withRef = buildImagePrompt({
      scenePrompt: "x",
      hasReference: true,
    });
    expect(withRef).toContain("exactly the same style as the reference image");
    expect(withRef).toContain("same line weight");
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
    expect(parsed.referenceUrl).toBeUndefined();
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
