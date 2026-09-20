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
  it("names the missing variable", () => {
    expect(() => readOpenAiTranscriberConfig({})).toThrow(
      TranscriberNotConfiguredError,
    );
  });

  it("transcribes with whisper-1 by default", () => {
    // The only model returning PER-WORD timestamps, and those are what we are
    // after.
    expect(readOpenAiTranscriberConfig({ OPENAI_API_KEY: "k" }).model).toBe(
      "whisper-1",
    );
  });
});

describe("readWords", () => {
  it("converts seconds to whole milliseconds", () => {
    expect(readWords({ words: [{ word: "café", start: 1.234, end: 1.789 }] })).toEqual([
      { word: "café", startMs: 1234, endMs: 1789 },
    ]);
  });

  it("rejects a response without timestamps: they are all we came for", () => {
    expect(() => readWords({ text: "un texte sans words" })).toThrow(
      TranscriptionFailedError,
    );
  });

  it("drops an empty word or one without a usable timestamp", () => {
    const words = readWords({
      words: [
        { word: "", start: 0, end: 1 },
        { word: "bon", start: "x", end: 1 },
        { word: "grain", start: 2, end: 2.5 },
      ],
    });

    expect(words).toEqual([{ word: "grain", startMs: 2000, endMs: 2500 }]);
  });
});

describe("OpenAiTranscriber", () => {
  it("requests per-word timestamps, and the language when known", async () => {
    let body: FormData | undefined;
    const fake = (async (_url: string, init?: RequestInit) => {
      body = init?.body as FormData;
      return new Response(
        JSON.stringify({ words: [{ word: "un", start: 0, end: 0.4 }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const words = await new OpenAiTranscriber(config, fake).transcribe({
      audio: Uint8Array.from([1, 2, 3]),
      language: "fr",
    });

    expect(words).toEqual([{ word: "un", startMs: 0, endMs: 400 }]);
    expect(body?.get("timestamp_granularities[]")).toBe("word");
    expect(body?.get("response_format")).toBe("verbose_json");
    expect(body?.get("language")).toBe("fr");
  });

  it("surfaces the engine failure with its status", async () => {
    const fake = (async () =>
      new Response("nope", { status: 429 })) as unknown as typeof fetch;

    await expect(
      new OpenAiTranscriber(config, fake).transcribe({ audio: Uint8Array.from([1]) }),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe("FakeTranscriber", () => {
  it("returns the words it is given and records the request", async () => {
    const fake = new FakeTranscriber([{ word: "a", startMs: 0, endMs: 1 }]);
    const audio = Uint8Array.from([9]);

    expect(await fake.transcribe({ audio })).toHaveLength(1);
    expect(fake.calls[0].audio).toBe(audio);
  });
});
