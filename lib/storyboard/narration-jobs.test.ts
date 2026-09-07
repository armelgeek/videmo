import { describe, expect, it } from "vitest";
import { BUDGET_CARACTERES, narrationJobs } from "./narration-jobs";
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
        beatIndexes: [0, 1],
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
      { clipIndex: 1, text: "Un.", beats: [{ narration: "Un." }], beatIndexes: [0] },
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
      { clipIndex: 0, text: "Vrai.", beats: [{ narration: "Vrai." }], beatIndexes: [1] },
    ]);
  });

  it("coupe une image trop longue ENTRE deux temps, jamais au milieu", () => {
    // Un temps coupe ne se retrouverait plus dans sa propre transcription.
    const long = "mot ".repeat(BUDGET_CARACTERES / 4).trim();
    const jobs = narrationJobs([
      clip({
        beats: [
          { narration: long, durationSec: 30 },
          { narration: "La suite.", durationSec: 2 },
        ],
      }),
    ]);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].beats).toEqual([{ narration: long }]);
    expect(jobs[1]).toMatchObject({ text: "La suite.", beatIndexes: [1] });
    for (const job of jobs) expect(job.text.length).toBeLessThan(4096);
  });

  it("laisse partir seul un temps plus long que le budget", () => {
    // Le refuser priverait l'image de sa voix ; le moteur, lui, tronquera.
    const enorme = "mot ".repeat(BUDGET_CARACTERES / 2).trim();

    expect(narrationJobs([clip({ beats: [{ narration: enorme, durationSec: 60 }] })]))
      .toHaveLength(1);
  });

  it("garde le rang reel d'un temps quand un vide le precede", () => {
    // Ecarter un temps vide de la synthese ne doit pas decaler les suivants :
    // le resultat se rangerait alors sur le mauvais temps.
    const jobs = narrationJobs([
      clip({
        beats: [
          { narration: "  ", durationSec: 1 },
          { narration: "Un.", durationSec: 1 },
          { narration: "Deux.", durationSec: 1 },
        ],
      }),
    ]);

    expect(jobs[0].beatIndexes).toEqual([1, 2]);
  });

  it("saute une image sans texte du tout", () => {
    expect(narrationJobs([clip({ summary: "", title: "" })])).toEqual([]);
  });
});
