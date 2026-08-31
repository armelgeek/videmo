import { describe, expect, it } from "vitest";
import { toEngineAnnotations, toStoredAnnotations } from "./annotation-interop";

describe("annotation interop", () => {
  it("keeps only the authored timing when restoring a project", () => {
    // The absolute fields are derived. A project saved mid-playback carries
    // whatever they held then; trusting them would restore a stale layout.
    const [restored] = toEngineAnnotations([
      {
        id: "a",
        region: { x: 1, y: 2, width: 3, height: 4 },
        reveal: { durationMs: 900, gapBeforeMs: 250, from: 7777, to: 8888 },
        style: { strokeColor: "#111", strokeWidth: 3, opacity: 1 },
      } as never,
    ]);

    expect(restored.reveal.durationMs).toBe(900);
    expect(restored.reveal.gapBeforeMs).toBe(250);
    expect(restored.reveal.from).toBe(0);
    expect(restored.reveal.to).toBe(0);
    expect(restored.text).toBe("");
  });

  it("round-trips the fields an edit can change", () => {
    const engine = toEngineAnnotations([
      {
        id: "a",
        text: "Titre",
        region: { x: 0, y: 0, width: 10, height: 10 },
        reveal: { durationMs: 1200, gapBeforeMs: 300 },
        style: { strokeColor: "#000", strokeWidth: 2, opacity: 1 },
      } as never,
    ]);
    const [back] = toStoredAnnotations(engine);

    expect(back.reveal.durationMs).toBe(1200);
    expect(back.reveal.gapBeforeMs).toBe(300);
    expect(back.text).toBe("Titre");
    expect(back.id).toBe("a");
  });
});
