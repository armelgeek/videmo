import { describe, expect, it } from "vitest";
import {
  OpenAiTranscriber,
  readOpenAiTranscriberConfig,
  readWords,
} from "./openai-transcriber";
import {
  FakeTranscriber,
  TranscriberNotConfiguredError,
  TranscriptionFailedError,
} from "./transcriber";

const config = { apiKey: "sk-test", model: "whisper-1" };

describe("readOpenAiTranscriberConfig", () => {
  it("nomme la variable manquante", () => {
    expect(() => readOpenAiTranscriberConfig({})).toThrow(
      TranscriberNotConfiguredError,
    );
  });

  it("transcrit avec whisper-1 par defaut", () => {
    // Le seul modele qui rende des instants PAR MOT, et ce sont eux qu'on
    // vient chercher.
    expect(readOpenAiTranscriberConfig({ OPENAI_API_KEY: "k" }).model).toBe(
      "whisper-1",
    );
  });
});

describe("readWords", () => {
  it("convertit les secondes en millisecondes entieres", () => {
    expect(readWords({ words: [{ word: "café", start: 1.234, end: 1.789 }] })).toEqual([
      { word: "café", startMs: 1234, endMs: 1789 },
    ]);
  });

  it("refuse une reponse sans instants : c'est tout ce qu'on venait chercher", () => {
    expect(() => readWords({ text: "un texte sans mots" })).toThrow(
      TranscriptionFailedError,
    );
  });

  it("ecarte un mot vide ou sans instant exploitable", () => {
    const mots = readWords({
      words: [
        { word: "", start: 0, end: 1 },
        { word: "bon", start: "x", end: 1 },
        { word: "grain", start: 2, end: 2.5 },
      ],
    });

    expect(mots).toEqual([{ word: "grain", startMs: 2000, endMs: 2500 }]);
  });
});

describe("OpenAiTranscriber", () => {
  it("demande les instants par mot, et la langue quand on la connait", async () => {
    let corps: FormData | undefined;
    const faux = (async (_url: string, init?: RequestInit) => {
      corps = init?.body as FormData;
      return new Response(
        JSON.stringify({ words: [{ word: "un", start: 0, end: 0.4 }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const mots = await new OpenAiTranscriber(config, faux).transcribe({
      audio: Uint8Array.from([1, 2, 3]),
      language: "fr",
    });

    expect(mots).toEqual([{ word: "un", startMs: 0, endMs: 400 }]);
    expect(corps?.get("timestamp_granularities[]")).toBe("word");
    expect(corps?.get("response_format")).toBe("verbose_json");
    expect(corps?.get("language")).toBe("fr");
  });

  it("remonte l'echec du moteur avec son statut", async () => {
    const faux = (async () =>
      new Response("nope", { status: 429 })) as unknown as typeof fetch;

    await expect(
      new OpenAiTranscriber(config, faux).transcribe({ audio: Uint8Array.from([1]) }),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe("FakeTranscriber", () => {
  it("rend les mots qu'on lui donne et retient la demande", async () => {
    const faux = new FakeTranscriber([{ word: "a", startMs: 0, endMs: 1 }]);
    const audio = Uint8Array.from([9]);

    expect(await faux.transcribe({ audio })).toHaveLength(1);
    expect(faux.calls[0].audio).toBe(audio);
  });
});
