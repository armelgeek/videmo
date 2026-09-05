import {
  SpeechGenerationFailedError,
  type SpeechGenerator,
  SpeechGeneratorNotConfiguredError,
  type SpeakInput,
  normalizeVoice,
} from "./speech-generator";

const SPEECH_URL = "https://api.openai.com/v1/audio/speech";

export interface OpenAiSpeechConfig {
  apiKey: string;
  model: string;
}

export function readOpenAiSpeechConfig(
  env: Record<string, string | undefined> = process.env,
): OpenAiSpeechConfig {
  if (!env.OPENAI_API_KEY?.trim()) {
    throw new SpeechGeneratorNotConfiguredError(["OPENAI_API_KEY"]);
  }
  return {
    apiKey: env.OPENAI_API_KEY,
    // Le plus rapide des trois : la narration se genere scene par scene, et
    // chaque seconde s'y multiplie par le nombre de clips.
    model: env.OPENAI_SPEECH_MODEL?.trim() || "gpt-4o-mini-tts",
  };
}

export class OpenAiSpeechGenerator implements SpeechGenerator {
  constructor(
    private readonly config: OpenAiSpeechConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async speak(input: SpeakInput): Promise<Uint8Array> {
    const response = await this.fetchImpl(SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        // Une voix inconnue fait echouer l'appel : mieux vaut la voix par
        // defaut qu'une scene muette au milieu du montage.
        voice: normalizeVoice(input.voice),
        input: input.text,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new SpeechGenerationFailedError(
        `Speech generation failed: ${detail.slice(0, 300)}`,
        response.status,
      );
    }

    const audio = new Uint8Array(await response.arrayBuffer());
    if (audio.length === 0) {
      throw new SpeechGenerationFailedError("The model returned empty audio");
    }
    return audio;
  }
}

let cached: SpeechGenerator | null = null;

export function getSpeechGenerator(): SpeechGenerator {
  if (!cached) cached = new OpenAiSpeechGenerator(readOpenAiSpeechConfig());
  return cached;
}
