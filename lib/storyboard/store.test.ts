import { beforeEach, describe, expect, it } from "vitest";
import { useStoryboardStore } from "./store";
import type { AudioTrack, TranscriptCue } from "@/lib/whiteboard-animation/audio/types";

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
