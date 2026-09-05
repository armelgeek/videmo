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
  it("accepte les voix du catalogue", () => {
    expect(normalizeVoice("onyx")).toBe("onyx");
    expect(VOICES).toContain(DEFAULT_VOICE);
  });

  it("ramene un choix inconnu sur la voix par defaut", () => {
    // Les projets enregistres portent d'anciens identifiants inventes
    // (en-us-male-1) : les envoyer tels quels ferait echouer l'appel et
    // laisserait une scene muette au milieu du montage.
    expect(normalizeVoice("en-us-male-1")).toBe(DEFAULT_VOICE);
    expect(normalizeVoice(undefined)).toBe(DEFAULT_VOICE);
    expect(normalizeVoice("")).toBe(DEFAULT_VOICE);
  });
});

describe("readOpenAiSpeechConfig", () => {
  it("nomme la variable manquante", () => {
    try {
      readOpenAiSpeechConfig({});
      expect.unreachable("aurait du lever");
    } catch (error) {
      expect(error).toBeInstanceOf(SpeechGeneratorNotConfiguredError);
      expect((error as SpeechGeneratorNotConfiguredError).missing).toEqual([
        "OPENAI_API_KEY",
      ]);
    }
  });

  it("laisse choisir le modele sans toucher au code", () => {
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
  it("rend les octets audio", async () => {
    const { impl } = stubFetch({});
    const audio = await new OpenAiSpeechGenerator(config, impl).speak({
      text: "Bonjour",
      voice: "nova",
    });

    expect(audio.length).toBeGreaterThan(0);
  });

  it("demande du mp3 avec la voix choisie", async () => {
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

  it("remplace une voix heritee plutot que d'echouer", async () => {
    const { impl, calls } = stubFetch({});
    await new OpenAiSpeechGenerator(config, impl).speak({
      text: "x",
      voice: "fr-fr-male-1",
    });

    expect(JSON.parse(calls[0].init.body as string).voice).toBe(DEFAULT_VOICE);
  });

  it("leve une erreur typee sur refus du moteur", async () => {
    const { impl } = stubFetch({ ok: false, status: 429, text: "rate limited" });

    await expect(
      new OpenAiSpeechGenerator(config, impl).speak({ text: "x", voice: "nova" }),
    ).rejects.toBeInstanceOf(SpeechGenerationFailedError);
  });

  it("refuse un audio vide plutot que d'ecrire un fichier muet", async () => {
    const { impl } = stubFetch({ audio: new Uint8Array(0) });

    await expect(
      new OpenAiSpeechGenerator(config, impl).speak({ text: "x", voice: "nova" }),
    ).rejects.toBeInstanceOf(SpeechGenerationFailedError);
  });
});

describe("FakeSpeechGenerator", () => {
  it("rend un MP3 valide sans reseau", async () => {
    const audio = await new FakeSpeechGenerator().speak({
      text: "x",
      voice: "nova",
    });

    // En-tete de trame MPEG : les octets doivent passer un vrai lecteur.
    expect(audio[0]).toBe(0xff);
    expect(audio[1] & 0xe0).toBe(0xe0);
  });

  it("retient ce qui lui a ete demande", async () => {
    const fake = new FakeSpeechGenerator();
    await fake.speak({ text: "une narration", voice: "sage" });

    expect(fake.calls).toEqual([{ text: "une narration", voice: "sage" }]);
  });
});
