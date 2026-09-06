import { describe, expect, it } from "vitest";
import { narrationJobs } from "./narration-jobs";
import type { EditableClip } from "./storyboard-clips";

const clip = (over: Partial<EditableClip> = {}): EditableClip => ({
  id: "c0",
  index: 0,
  clipType: "content",
  title: "Titre",
  summary: "La narration entiere de l'image.",
  visualPrompt: "p",
  duration: 5,
  isSection: false,
  ...over,
});

describe("narrationJobs", () => {
  it("produit un appel par temps de narration", () => {
    const jobs = narrationJobs([
      clip({
        beats: [
          { narration: "Premier temps.", durationSec: 2 },
          { narration: "Second temps.", durationSec: 3 },
        ],
      }),
    ]);

    expect(jobs).toEqual([
      { clipIndex: 0, beatIndex: 0, text: "Premier temps." },
      { clipIndex: 0, beatIndex: 1, text: "Second temps." },
    ]);
  });

  it("retombe sur l'image entiere quand elle n'a aucun temps", () => {
    expect(narrationJobs([clip()])).toEqual([
      { clipIndex: 0, text: "La narration entiere de l'image." },
    ]);
  });

  it("garde l'index du clip, sections comprises, pour ranger le resultat", () => {
    const jobs = narrationJobs([
      clip({ id: "s", isSection: true }),
      clip({ id: "a", beats: [{ narration: "Un.", durationSec: 1 }] }),
    ]);

    expect(jobs).toEqual([{ clipIndex: 1, beatIndex: 0, text: "Un." }]);
  });

  it("saute un temps vide plutot que de payer un appel pour du silence", () => {
    const jobs = narrationJobs([
      clip({
        beats: [
          { narration: "  ", durationSec: 1 },
          { narration: "Vrai.", durationSec: 1 },
        ],
      }),
    ]);

    expect(jobs).toEqual([{ clipIndex: 0, beatIndex: 1, text: "Vrai." }]);
  });

  it("saute une image sans texte du tout", () => {
    expect(narrationJobs([clip({ summary: "", title: "" })])).toEqual([]);
  });
});
