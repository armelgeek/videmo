import { beforeEach, describe, expect, it } from "vitest";
import { useStoryboardStore, mergeStoryboardStorePersistedState } from "./store";
import type { AudioTrack, TranscriptCue } from "@/lib/whiteboard-animation/audio/types";
import type { StoryboardStoreState } from "./store";

function resetStore() {
  useStoryboardStore.setState({
    whiteboardConfig: {
      animStyle: "chunkjump",
      handStyle: "custom1",
      canvasBg: "white",
      annotations: [],
      annotationConfig: { enabled: true, speed: 1, defaultStyle: { strokeColor: "#000000", strokeWidth: 2 } },
      audio: null,
      transcript: [],
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
      volume: 1,
      muted: false,
      offsetMs: 0,
      durationMs: 5000,
    };
    useStoryboardStore.getState().setAudioTrack(track);
    expect(useStoryboardStore.getState().whiteboardConfig.audio).toEqual(track);
  });

  it("setAudioTrack(null) clears the track", () => {
    useStoryboardStore.getState().setAudioTrack({
      id: "audio-1", url: "blob:fake", source: "upload",
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
  });

  it("keeps persisted audio and transcript when present", () => {
    const track: AudioTrack = {
      id: "audio-1", url: "blob:fake", source: "upload",
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

    expect(merged.whiteboardConfig.audio).toEqual(track);
    expect(merged.whiteboardConfig.transcript).toEqual(cues);
  });

  it("falls back to current state entirely when nothing was persisted", () => {
    const merged = mergeStoryboardStorePersistedState(undefined, makeCurrentState());
    expect(merged.whiteboardConfig.audio).toBeNull();
    expect(merged.whiteboardConfig.transcript).toEqual([]);
  });
});
