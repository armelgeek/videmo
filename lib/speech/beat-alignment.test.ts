import { describe, expect, it } from "vitest";
import { alignBeats, normalizeToken, tokenize } from "./beat-alignment";

/** Une transcription regulière : un mot toutes les 500 ms. */
function mots(phrase: string, depart = 0, pas = 500) {
  return phrase.split(/\s+/).map((word, i) => ({
    word,
    startMs: depart + i * pas,
    endMs: depart + i * pas + 400,
  }));
}

describe("normalizeToken", () => {
  it("ecarte casse, accents et ponctuation", () => {
    expect(normalizeToken("Café,")).toBe("cafe");
    expect(normalizeToken("«  RÉVEILLE ! »")).toBe("reveille");
  });

  it("rend une chaine vide pour de la ponctuation seule", () => {
    expect(normalizeToken("—")).toBe("");
  });
});

describe("tokenize", () => {
  it("ecarte les jetons vides", () => {
    expect(tokenize("Le grain — vert.")).toEqual(["le", "grain", "vert"]);
  });
});

describe("alignBeats", () => {
  const words = mots("tout commence par un grain la chaleur le reveille");

  it("donne a chaque temps son debut reel dans l'enregistrement", () => {
    const [un, deux] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words,
      audioDurationMs: 5000,
    });

    expect(un.startMs).toBe(0);
    expect(deux.startMs).toBe(2500);
  });

  it("fait porter au temps la respiration qui le suit", () => {
    // Le second temps demarre a 2500 : le premier occupe tout jusque-la,
    // et non seulement sa parole (qui s'arrete a 2400).
    const [un] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words,
      audioDurationMs: 5000,
    });

    expect(un.durationMs).toBe(2500);
    expect(un.spokenEndMs).toBe(2400);
  });

  it("borne le dernier temps sur la fin de l'enregistrement", () => {
    const [, deux] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words,
      audioDurationMs: 5200,
    });

    expect(deux.durationMs).toBe(5200 - 2500);
  });

  it("se recale quand la transcription a colle deux mots", () => {
    // « par un » transcrit en un seul mot : sans correction, tout ce qui suit
    // glisserait d'un mot.
    const colles = mots("tout commence parun grain la chaleur le reveille");

    const [, deux] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words: colles,
      audioDurationMs: 5000,
    });

    // « grain » est le dernier mot du premier temps : il est retrouve en 3e
    // position, donc le second temps demarre sur « la ».
    expect(deux.startMs).toBe(2000);
  });

  it("garde une place au temps qu'il ne retrouve pas", () => {
    const [, deux] = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "Phrase absente de l'enregistrement." },
      ],
      words,
      audioDurationMs: 5000,
    });

    expect(deux.startMs).toBeGreaterThanOrEqual(0);
    expect(deux.durationMs).toBeGreaterThan(0);
  });

  it("fait porter au premier temps le silence qui ouvre l'enregistrement", () => {
    // La voix ne commence qu'a 680 ms : sans cela le dessin partirait avec
    // cette avance, et les temps ne couvriraient pas l'enregistrement.
    const tardifs = mots("tout commence par un grain la chaleur le reveille", 680);

    const cales = alignBeats({
      beats: [
        { narration: "Tout commence par un grain." },
        { narration: "La chaleur le reveille." },
      ],
      words: tardifs,
      audioDurationMs: 5680,
    });

    expect(cales[0].startMs).toBe(0);
    const somme = cales.reduce((t, c) => t + c.durationMs, 0);
    expect(somme).toBe(5680);
  });

  it("ne rend rien sans transcription", () => {
    expect(
      alignBeats({ beats: [{ narration: "x" }], words: [], audioDurationMs: 1 }),
    ).toEqual([]);
  });
});
