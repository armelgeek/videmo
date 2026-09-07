import { beforeEach, describe, expect, it } from "vitest";
import {
  useStoryboardStore,
  mergeStoryboardStorePersistedState,
  serializeAudioTrack,
  DEFAULT_WHITEBOARD_CONFIG,
} from "./store";
import type { AudioTrack, TranscriptCue } from "@/lib/whiteboard-animation/audio/types";
import type { StoryboardStoreState } from "./store";

function resetStore() {
  // Part du vrai defaut : la copie a la main oubliait chaque champ ajoute
  // depuis, et le test du defaut portait alors sur `undefined`.
  useStoryboardStore.setState({
    whiteboardConfig: {
      ...DEFAULT_WHITEBOARD_CONFIG,
      annotationConfig: { enabled: true, speed: 1, defaultStyle: { strokeColor: "#000000", strokeWidth: 2 } },
    },
  });
}

describe("whiteboardConfig.audio", () => {
  beforeEach(resetStore);

  it("defaults to null", () => {
    expect(useStoryboardStore.getState().whiteboardConfig.audio).toBeNull();
  });

  it("setAudioTrack stores the track", () => {
    const track: AudioTrack = {
      id: "audio-1",
      url: "blob:fake",
      source: "upload",
      name: "narration.mp3",
      volume: 1,
      muted: false,
      offsetMs: 0,
      durationMs: 5000,
    };
    useStoryboardStore.getState().setAudioTrack(track);
    expect(useStoryboardStore.getState().whiteboardConfig.audio).toEqual(track);
  });

  it("setNarrationParts garde la voix par temps, sans toucher a la piste unique", () => {
    const parts = [{ url: "/0.mp3", startMs: 0, durationMs: 1200 }];
    useStoryboardStore.getState().setNarrationParts(parts);

    const config = useStoryboardStore.getState().whiteboardConfig;
    expect(config.narration).toEqual(parts);
    // `audio` reste le televersement a la main : les deux coexistent.
    expect(config.audio).toBeNull();
  });

  it("setAudioTrack(null) clears the track", () => {
    useStoryboardStore.getState().setAudioTrack({
      id: "audio-1", url: "blob:fake", source: "upload", name: "narration.mp3",
      volume: 1, muted: false, offsetMs: 0, durationMs: 5000,
    });
    useStoryboardStore.getState().setAudioTrack(null);
    expect(useStoryboardStore.getState().whiteboardConfig.audio).toBeNull();
  });
});

describe("whiteboardConfig.transcript", () => {
  beforeEach(resetStore);

  it("defaults to an empty array", () => {
    expect(useStoryboardStore.getState().whiteboardConfig.transcript).toEqual([]);
  });

  it("setTranscript replaces the cue list", () => {
    const cues: TranscriptCue[] = [
      { id: "cue-1", startMs: 0, endMs: 1000, text: "Hello" },
    ];
    useStoryboardStore.getState().setTranscript(cues);
    expect(useStoryboardStore.getState().whiteboardConfig.transcript).toEqual(cues);
  });

  it("linkTranscriptCue sets annotationId on the matching cue only", () => {
    useStoryboardStore.getState().setTranscript([
      { id: "cue-1", startMs: 0, endMs: 1000, text: "A" },
      { id: "cue-2", startMs: 1000, endMs: 2000, text: "B" },
    ]);
    useStoryboardStore.getState().linkTranscriptCue("cue-1", "ann-1");
    const transcript = useStoryboardStore.getState().whiteboardConfig.transcript;
    expect(transcript.find((c) => c.id === "cue-1")?.annotationId).toBe("ann-1");
    expect(transcript.find((c) => c.id === "cue-2")?.annotationId).toBeUndefined();
  });
});

describe("whiteboardConfig.transcription", () => {
  beforeEach(resetStore);

  it("defaults to an empty array", () => {
    expect(
      useStoryboardStore.getState().whiteboardConfig.transcription,
    ).toEqual([]);
  });

  it("setNarrationTranscription stores one entry per recording", () => {
    const takes = [
      {
        url: "https://bucket/take-1.mp3",
        words: [{ word: "Bonjour", startMs: 0, endMs: 400 }],
      },
    ];
    useStoryboardStore.getState().setNarrationTranscription(takes);
    expect(
      useStoryboardStore.getState().whiteboardConfig.transcription,
    ).toEqual(takes);
  });
});

describe("mergeStoryboardStorePersistedState", () => {
  beforeEach(resetStore);

  function makeCurrentState(): StoryboardStoreState {
    return useStoryboardStore.getState();
  }

  it("fills in audio and transcript when the persisted project predates them", () => {
    // Simulates sessionStorage written by a browser session from before the
    // audio system existed: whiteboardConfig has no audio/transcript keys.
    const legacyPersisted = {
      whiteboardConfig: {
        animStyle: "chunkjump",
        handStyle: "custom1",
        canvasBg: "white",
        annotations: [],
        annotationConfig: { enabled: true, speed: 1, defaultStyle: { strokeColor: "#000000", strokeWidth: 2 } },
        // no audio, no transcript
      },
    };

    const merged = mergeStoryboardStorePersistedState(legacyPersisted, makeCurrentState());

    expect(merged.whiteboardConfig.audio).toBeNull();
    expect(merged.whiteboardConfig.transcript).toEqual([]);
    // Le merge de zustand remplace l'objet en bloc : sans la fusion d'un cran
    // plus profond, un champ ajoute apres coup revient `undefined`, pas `[]`.
    expect(merged.whiteboardConfig.transcription).toEqual([]);
  });

  it("keeps persisted audio and transcript when present", () => {
    const track: AudioTrack = {
      id: "audio-1", url: "blob:fake", source: "upload", name: "narration.mp3",
      volume: 0.5, muted: false, offsetMs: 0, durationMs: 3000,
    };
    const cues: TranscriptCue[] = [{ id: "cue-1", startMs: 0, endMs: 1000, text: "Hi" }];
    const persisted = {
      whiteboardConfig: {
        animStyle: "chunkjump",
        handStyle: "custom1",
        canvasBg: "white",
        annotations: [],
        annotationConfig: { enabled: true, speed: 1, defaultStyle: { strokeColor: "#000000", strokeWidth: 2 } },
        audio: track,
        transcript: cues,
      },
    };

    const merged = mergeStoryboardStorePersistedState(persisted, makeCurrentState());

    expect(merged.whiteboardConfig.audio).toMatchObject({
      id: "audio-1",
      name: "narration.mp3",
      volume: 0.5,
      durationMs: 3000,
    });
    expect(merged.whiteboardConfig.transcript).toEqual(cues);
  });

  it("survives a save/load round trip without losing the durable audio URL", () => {
    // The regression this guards: hydration rewrites `url` into a fresh blob:
    // for playback, and persisting the state verbatim wrote that blob: back
    // over the data: original. One more reload and the track was gone for good.
    const dataUrl = "data:audio/mpeg;base64,SUQzBAAAAAA=";
    const saved: AudioTrack = {
      id: "audio-1", url: dataUrl, source: "upload", name: "narration.mp3",
      volume: 1, muted: false, offsetMs: 0, durationMs: 3000,
    };

    const loadOnce = (stored: AudioTrack) =>
      mergeStoryboardStorePersistedState(
        { whiteboardConfig: { audio: stored } },
        makeCurrentState()
      ).whiteboardConfig.audio!;

    let live = loadOnce(saved);
    expect(live.persistUrl).toBe(dataUrl);

    // Two full cycles: the old code already lost the URL on the second.
    for (let i = 0; i < 2; i++) {
      const stored = serializeAudioTrack(live)!;
      expect(stored.url).toBe(dataUrl);
      expect(stored.persistUrl).toBeUndefined();
      live = loadOnce(stored);
    }

    expect(live.persistUrl).toBe(dataUrl);
  });

  it("falls back to current state entirely when nothing was persisted", () => {
    const merged = mergeStoryboardStorePersistedState(undefined, makeCurrentState());
    expect(merged.whiteboardConfig.audio).toBeNull();
    expect(merged.whiteboardConfig.transcript).toEqual([]);
  });
});
