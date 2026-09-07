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
  it("dit tout le script d'une traite, images comprises", () => {
    // La couture entre deux enregistrements s'entend : un TTS relance repart a
    // zero. Un script ordinaire tient donc en une seule voix.
    const jobs = narrationJobs([
      clip({ id: "a", beats: [{ narration: "Premier.", durationSec: 1 }] }),
      clip({ id: "b", beats: [{ narration: "Second.", durationSec: 1 }] }),
    ]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].text).toBe("Premier. Second.");
    expect(jobs[0].places).toEqual([
      { clipIndex: 0, beatIndex: 0 },
      { clipIndex: 1, beatIndex: 0 },
    ]);
  });

  it("retombe sur le resume d'une image sans aucun temps", () => {
    const jobs = narrationJobs([clip()]);

    expect(jobs[0].text).toBe("La narration entiere de l'image.");
    // -1 : il n'y a aucun temps ou ranger l'instant.
    expect(jobs[0].places).toEqual([{ clipIndex: 0, beatIndex: -1 }]);
  });

  it("garde le rang reel d'un temps quand un vide le precede", () => {
    // Ecarter un temps vide ne doit pas decaler les suivants : le resultat se
    // rangerait alors sur le mauvais temps.
    const jobs = narrationJobs([
      clip({
        beats: [
          { narration: "  ", durationSec: 1 },
          { narration: "Un.", durationSec: 1 },
        ],
      }),
    ]);

    expect(jobs[0].places).toEqual([{ clipIndex: 0, beatIndex: 1 }]);
  });

  it("ignore les sections, sans decaler les images qui suivent", () => {
    const jobs = narrationJobs([
      clip({ id: "s", isSection: true }),
      clip({ id: "a", beats: [{ narration: "Un.", durationSec: 1 }] }),
    ]);

    expect(jobs[0].places).toEqual([{ clipIndex: 1, beatIndex: 0 }]);
  });

  it("coupe ENTRE deux temps quand le script depasse le budget du moteur", () => {
    // Un temps coupe ne se retrouverait plus dans sa propre transcription.
    const long = "mot ".repeat(BUDGET_CARACTERES / 4).trim();
    const jobs = narrationJobs([
      clip({ id: "a", beats: [{ narration: long, durationSec: 30 }] }),
      clip({ id: "b", beats: [{ narration: "La suite.", durationSec: 2 }] }),
    ]);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].places).toEqual([{ clipIndex: 0, beatIndex: 0 }]);
    expect(jobs[1].places).toEqual([{ clipIndex: 1, beatIndex: 0 }]);
    for (const job of jobs) expect(job.text.length).toBeLessThan(4096);
  });

  it("laisse partir seul un temps plus long que le budget", () => {
    const enorme = "mot ".repeat(BUDGET_CARACTERES / 2).trim();

    expect(narrationJobs([clip({ beats: [{ narration: enorme, durationSec: 60 }] })]))
      .toHaveLength(1);
  });

  it("ne rend rien quand rien n'est a dire", () => {
    expect(narrationJobs([clip({ summary: "", title: "" })])).toEqual([]);
  });
});
