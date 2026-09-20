import { describe, expect, it } from "vitest";
import {
  DEFAULT_VOICE,
  FakeSpeechGenerator,
  SILENT_MP3,
  SpeechGenerationFailedError,
  SpeechGeneratorNotConfiguredError,
  VOICES,
  normalizeVoice,
} from "./speech-generator";
import {
  OpenAiSpeechGenerator,
  readOpenAiSpeechConfig,
} from "./openai-speech-generator";

const config = { apiKey: "sk-test", model: "gpt-4o-mini-tts" };

function stubFetch(response: {
  ok?: boolean;
  status?: number;
  audio?: Uint8Array;
  text?: string;
}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      arrayBuffer: async () => (response.audio ?? SILENT_MP3).buffer,
      text: async () => response.text ?? "",
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("normalizeVoice", () => {
  it("accepts catalog voices", () => {
    expect(normalizeVoice("onyx")).toBe("onyx");
    expect(VOICES).toContain(DEFAULT_VOICE);
  });

  it("maps an unknown choice to the default voice", () => {
    // Saved projects carry old invented ids (en-us-male-1): sending them as-is
    // would make the call fail and leave a silent scene in the middle of the
    // edit.
    expect(normalizeVoice("en-us-male-1")).toBe(DEFAULT_VOICE);
    expect(normalizeVoice(undefined)).toBe(DEFAULT_VOICE);
    expect(normalizeVoice("")).toBe(DEFAULT_VOICE);
  });
});

describe("readOpenAiSpeechConfig", () => {
  it("names the missing variable", () => {
    try {
      readOpenAiSpeechConfig({});
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SpeechGeneratorNotConfiguredError);
      expect((error as SpeechGeneratorNotConfiguredError).missing).toEqual([
        "OPENAI_API_KEY",
      ]);
    }
  });

  it("lets the model be chosen without touching code", () => {
    expect(readOpenAiSpeechConfig({ OPENAI_API_KEY: "k" }).model).toBe(
      "gpt-4o-mini-tts",
    );
    expect(
      readOpenAiSpeechConfig({ OPENAI_API_KEY: "k", OPENAI_SPEECH_MODEL: "tts-1-hd" })
        .model,
    ).toBe("tts-1-hd");
  });
});

describe("OpenAiSpeechGenerator", () => {
  it("returns the audio bytes", async () => {
    const { impl } = stubFetch({});
    const audio = await new OpenAiSpeechGenerator(config, impl).speak({
      text: "Bonjour",
      voice: "nova",
    });

    expect(audio.length).toBeGreaterThan(0);
  });

  it("requests mp3 with the chosen voice", async () => {
    const { impl, calls } = stubFetch({});
    await new OpenAiSpeechGenerator(config, impl).speak({
      text: "Bonjour",
      voice: "onyx",
    });

    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      model: "gpt-4o-mini-tts",
      voice: "onyx",
      input: "Bonjour",
      response_format: "mp3",
    });
  });

  it("replaces a legacy voice rather than failing", async () => {
    const { impl, calls } = stubFetch({});
    await new OpenAiSpeechGenerator(config, impl).speak({
      text: "x",
      voice: "fr-fr-male-1",
    });

    expect(JSON.parse(calls[0].init.body as string).voice).toBe(DEFAULT_VOICE);
  });

  it("throws a typed error when the engine refuses", async () => {
    const { impl } = stubFetch({ ok: false, status: 429, text: "rate limited" });

    await expect(
      new OpenAiSpeechGenerator(config, impl).speak({ text: "x", voice: "nova" }),
    ).rejects.toBeInstanceOf(SpeechGenerationFailedError);
  });

  it("rejects empty audio rather than writing a silent file", async () => {
    const { impl } = stubFetch({ audio: new Uint8Array(0) });

    await expect(
      new OpenAiSpeechGenerator(config, impl).speak({ text: "x", voice: "nova" }),
    ).rejects.toBeInstanceOf(SpeechGenerationFailedError);
  });
});

describe("FakeSpeechGenerator", () => {
  it("returns a valid MP3 without network", async () => {
    const audio = await new FakeSpeechGenerator().speak({
      text: "x",
      voice: "nova",
    });

    // MPEG frame header: the bytes must pass a real player.
    expect(audio[0]).toBe(0xff);
    expect(audio[1] & 0xe0).toBe(0xe0);
  });

  it("records what it was asked", async () => {
    const fake = new FakeSpeechGenerator();
    await fake.speak({ text: "une narration", voice: "sage" });

    expect(fake.calls).toEqual([{ text: "une narration", voice: "sage" }]);
  });
});
