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
  it("dit l'image d'une traite, et nomme ses temps pour qu'on les y retrouve", () => {
    const jobs = narrationJobs([
      clip({
        beats: [
          { narration: "Premier temps.", durationSec: 2 },
          { narration: "Second temps.", durationSec: 3 },
        ],
      }),
    ]);

    expect(jobs).toEqual([
      {
        clipIndex: 0,
        text: "Premier temps. Second temps.",
        beats: [{ narration: "Premier temps." }, { narration: "Second temps." }],
      },
    ]);
  });

  it("retombe sur le resume quand l'image n'a aucun temps", () => {
    expect(narrationJobs([clip()])).toEqual([
      { clipIndex: 0, text: "La narration entiere de l'image." },
    ]);
  });

  it("garde l'index du clip, sections comprises, pour ranger le resultat", () => {
    const jobs = narrationJobs([
      clip({ id: "s", isSection: true }),
      clip({ id: "a", beats: [{ narration: "Un.", durationSec: 1 }] }),
    ]);

    expect(jobs).toEqual([
      { clipIndex: 1, text: "Un.", beats: [{ narration: "Un." }] },
    ]);
  });

  it("ecarte un temps vide : il n'a rien a faire dire ni a retrouver", () => {
    const jobs = narrationJobs([
      clip({
        beats: [
          { narration: "  ", durationSec: 1 },
          { narration: "Vrai.", durationSec: 1 },
        ],
      }),
    ]);

    expect(jobs).toEqual([
      { clipIndex: 0, text: "Vrai.", beats: [{ narration: "Vrai." }] },
    ]);
  });

  it("saute une image sans texte du tout", () => {
    expect(narrationJobs([clip({ summary: "", title: "" })])).toEqual([]);
  });
});
