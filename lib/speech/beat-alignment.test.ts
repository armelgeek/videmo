import { describe, expect, it } from "vitest";
import { alignBeats, normalizeToken, tokenize } from "./beat-alignment";

/** A regular transcription: one word every 500 ms. */
function makeWords(phrase: string, start = 0, step = 500) {
  return phrase.split(/\s+/).map((word, i) => ({
    word,
    startMs: start + i * step,
    endMs: start + i * step + 400,
  }));
}

describe("normalizeToken", () => {
  it("strips case, accents and punctuation", () => {
    expect(normalizeToken("Café,")).toBe("cafe");
    expect(normalizeToken("«  RÉVEILLE ! »")).toBe("reveille");
  });

  it("returns an empty string for punctuation only", () => {
    expect(normalizeToken("—")).toBe("");
  });
});

describe("tokenize", () => {
  it("drops empty tokens", () => {
    expect(tokenize("Le grain — vert.")).toEqual(["le", "grain", "vert"]);
  });
});

describe("alignBeats", () => {
  const words = makeWords("tout commence par un grain la chaleur le reveille");

  it("gives each beat its real start in the recording", () => {
    const [first, second] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words,
      audioDurationMs: 5000,
    });

    expect(first.startMs).toBe(0);
    expect(second.startMs).toBe(2500);
  });

  it("makes the beat carry the breath that follows it", () => {
    // The second beat starts at 2500: the first one occupies everything up to
    // there, not only its speech (which stops at 2400).
    const [first] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words,
      audioDurationMs: 5000,
    });

    expect(first.durationMs).toBe(2500);
    expect(first.spokenEndMs).toBe(2400);
  });

  it("bounds the last beat to the end of the recording", () => {
    const [, second] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words,
      audioDurationMs: 5200,
    });

    expect(second.durationMs).toBe(5200 - 2500);
  });

  it("realigns when the transcription merged two words", () => {
    // « par un » transcribed as a single word: without correction, everything
    // after would slip by one word.
    const merged = makeWords("tout commence parun grain la chaleur le reveille");

    const [, second] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words: merged,
      audioDurationMs: 5000,
    });

    // « grain » is the first beat's last word: it is found at position 3, so
    // the second beat starts on « la ».
    expect(second.startMs).toBe(2000);
  });

  it("keeps a slot for a beat it cannot find", () => {
    const [, second] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "Phrase absente de l'enregistrement." },
      ],
      words,
      audioDurationMs: 5000,
    });

    expect(second.startMs).toBeGreaterThanOrEqual(0);
    expect(second.durationMs).toBeGreaterThan(0);
  });

  it("makes the first beat carry the silence that opens the recording", () => {
    // The voice only starts at 680 ms: otherwise the drawing would start that
    // much ahead, and the beats would not cover the recording.
    const late = makeWords("tout commence par un grain la chaleur le reveille", 680);

    const aligned = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words: late,
      audioDurationMs: 5680,
    });

    expect(aligned[0].startMs).toBe(0);
    const total = aligned.reduce((t, c) => t + c.durationMs, 0);
    expect(total).toBe(5680);
  });

  it("returns nothing without a transcription", () => {
    expect(
      alignBeats({ beats: [{ narration: "x" }], words: [], audioDurationMs: 1 }),
    ).toEqual([]);
  });
});
