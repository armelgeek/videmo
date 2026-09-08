import { describe, expect, it } from "vitest";
import {
  annotationPleineImage,
  PLEINE_IMAGE_ID,
} from "./panel-fallback-annotation";

const TAILLE = { width: 1280, height: 720 };

describe("annotationPleineImage", () => {
  it("couvre tout le canvas", () => {
    const a = annotationPleineImage({ duration: 4 }, TAILLE);

    expect(a.id).toBe(PLEINE_IMAGE_ID);
    expect(a.region).toEqual({ x: 0, y: 0, width: 1280, height: 720 });
  });

  it("prend la voix mesuree quand elle existe", () => {
    const a = annotationPleineImage(
      { audioDurationMs: 7200, duration: 4 },
      TAILLE,
    );

    expect(a.reveal.durationMs).toBe(7200);
    expect(a.reveal.to).toBe(7200);
  });

  it("retombe sur la duree reglee au storyboard", () => {
    const a = annotationPleineImage({ duration: 4 }, TAILLE);

    expect(a.reveal.durationMs).toBe(4000);
  });

  it("ne rend jamais une duree nulle", () => {
    const a = annotationPleineImage({}, TAILLE);

    expect(a.reveal.durationMs).toBeGreaterThan(0);
  });

  it("porte la narration de l'image", () => {
    const a = annotationPleineImage(
      { duration: 3, narration: "Le levain respire." },
      TAILLE,
    );

    expect(a.text).toBe("Le levain respire.");
  });
});
