import { describe, expect, it } from "vitest";
import { parseTranscript } from "./transcript";

describe("parseTranscript - json", () => {
  it("parses an array of cues", () => {
    const json = JSON.stringify([
      { startMs: 0, endMs: 1500, text: "Hello" },
      { startMs: 1500, endMs: 3000, text: "World" },
    ]);
    const cues = parseTranscript(json, "json");
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ startMs: 0, endMs: 1500, text: "Hello" });
    expect(cues[1]).toMatchObject({ startMs: 1500, endMs: 3000, text: "World" });
  });

  it("assigns a unique id to each cue", () => {
    const json = JSON.stringify([
      { startMs: 0, endMs: 1000, text: "A" },
      { startMs: 1000, endMs: 2000, text: "B" },
    ]);
    const cues = parseTranscript(json, "json");
    expect(cues[0].id).toBeTruthy();
    expect(cues[1].id).toBeTruthy();
    expect(cues[0].id).not.toBe(cues[1].id);
  });

  it("throws on malformed json", () => {
    expect(() => parseTranscript("not json", "json")).toThrow();
  });

  it("drops cues where endMs <= startMs", () => {
    const json = JSON.stringify([
      { startMs: 0, endMs: 1000, text: "valid" },
      { startMs: 2000, endMs: 1000, text: "inverted" },
      { startMs: 3000, endMs: 3000, text: "zero-length" },
    ]);
    const cues = parseTranscript(json, "json");
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("valid");
  });
});

describe("parseTranscript - srt", () => {
  it("parses standard SRT blocks", () => {
    const srt = [
      "1",
      "00:00:00,000 --> 00:00:01,500",
      "Hello",
      "",
      "2",
      "00:00:01,500 --> 00:00:03,000",
      "World",
      "",
    ].join("\n");
    const cues = parseTranscript(srt, "srt");
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ startMs: 0, endMs: 1500, text: "Hello" });
    expect(cues[1]).toMatchObject({ startMs: 1500, endMs: 3000, text: "World" });
  });

  it("joins multi-line cue text with a space", () => {
    const srt = [
      "1",
      "00:00:00,000 --> 00:00:02,000",
      "Line one",
      "Line two",
      "",
    ].join("\n");
    const cues = parseTranscript(srt, "srt");
    expect(cues[0].text).toBe("Line one Line two");
  });

  it("handles hour-scale timestamps", () => {
    const srt = ["1", "01:02:03,456 --> 01:02:04,789", "Late cue", ""].join("\n");
    const cues = parseTranscript(srt, "srt");
    expect(cues[0].startMs).toBe(((1 * 3600 + 2 * 60 + 3) * 1000) + 456);
    expect(cues[0].endMs).toBe(((1 * 3600 + 2 * 60 + 4) * 1000) + 789);
  });
});

describe("parseTranscript - vtt", () => {
  it("parses WEBVTT blocks, ignoring the header", () => {
    const vtt = [
      "WEBVTT",
      "",
      "00:00:00.000 --> 00:00:01.500",
      "Hello",
      "",
      "00:00:01.500 --> 00:00:03.000",
      "World",
      "",
    ].join("\n");
    const cues = parseTranscript(vtt, "vtt");
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ startMs: 0, endMs: 1500, text: "Hello" });
  });

  it("ignores numeric cue identifiers before the timestamp line", () => {
    const vtt = [
      "WEBVTT",
      "",
      "cue-1",
      "00:00:00.000 --> 00:00:01.000",
      "Hello",
      "",
    ].join("\n");
    const cues = parseTranscript(vtt, "vtt");
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello");
  });
});

describe("parseTranscript - ordering", () => {
  it("returns cues sorted by startMs regardless of input order", () => {
    const json = JSON.stringify([
      { startMs: 5000, endMs: 6000, text: "second" },
      { startMs: 0, endMs: 1000, text: "first" },
    ]);
    const cues = parseTranscript(json, "json");
    expect(cues.map((c) => c.text)).toEqual(["first", "second"]);
  });
});
