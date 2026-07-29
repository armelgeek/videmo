import type { TranscriptCue } from "./types";

type TranscriptFormat = "srt" | "vtt" | "json";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `cue-${Date.now()}-${idCounter}`;
}

export function parseTranscript(
  text: string,
  format: TranscriptFormat
): TranscriptCue[] {
  const raw =
    format === "json"
      ? parseJson(text)
      : format === "srt"
        ? parseSrt(text)
        : parseVtt(text);

  return raw
    .filter((cue) => cue.endMs > cue.startMs)
    .sort((a, b) => a.startMs - b.startMs)
    .map((cue) => ({ ...cue, id: nextId() }));
}

function parseJson(text: string): Omit<TranscriptCue, "id">[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error("Transcript JSON must be an array of cues");
  }
  return data.map((entry) => ({
    startMs: Number(entry.startMs),
    endMs: Number(entry.endMs),
    text: String(entry.text ?? ""),
  }));
}

// "00:00:01,500" (SRT, comma) or "00:00:01.500" (VTT, dot) -> milliseconds.
// Also accepts "MM:SS.mmm" (no hour segment), which some VTT exports use.
function timestampToMs(raw: string): number {
  const normalized = raw.replace(",", ".");
  const parts = normalized.split(":");
  const secondsAndMs = parts.pop() ?? "0";
  const [secStr, msStr = "0"] = secondsAndMs.split(".");
  const seconds = Number(secStr);
  const ms = Number(msStr.padEnd(3, "0").slice(0, 3));
  const minutes = parts.length > 0 ? Number(parts.pop()) : 0;
  const hours = parts.length > 0 ? Number(parts.pop()) : 0;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + ms;
}

const TIMESTAMP_LINE = /^(\d{2}:\d{2}(?::\d{2})?[.,]\d{3})\s*-->\s*(\d{2}:\d{2}(?::\d{2})?[.,]\d{3})/;

function parseBlocks(text: string): Omit<TranscriptCue, "id">[] {
  const cues: Omit<TranscriptCue, "id">[] = [];
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const timestampLineIndex = lines.findIndex((l) => TIMESTAMP_LINE.test(l));
    if (timestampLineIndex === -1) continue;

    const match = lines[timestampLineIndex].match(TIMESTAMP_LINE);
    if (!match) continue;

    const startMs = timestampToMs(match[1]);
    const endMs = timestampToMs(match[2]);
    const textLines = lines.slice(timestampLineIndex + 1);
    cues.push({ startMs, endMs, text: textLines.join(" ") });
  }

  return cues;
}

function parseSrt(text: string): Omit<TranscriptCue, "id">[] {
  return parseBlocks(text);
}

function parseVtt(text: string): Omit<TranscriptCue, "id">[] {
  const withoutHeader = text.replace(/^WEBVTT.*\n/, "");
  return parseBlocks(withoutHeader);
}
