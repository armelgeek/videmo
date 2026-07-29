# Whiteboard Audio System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make audio narration the timing reference for the whiteboard engine — in preview and in export — with volume control and manual transcript-to-annotation alignment.

**Architecture:** The rAF loop in `use-whiteboard-renderer.ts` keeps its shape; only the source of its `delta` changes, from wall-clock (`Math.min(100, now - last)`) to audio-clock (`audioNowMs - lastAudioMs`). A drift guard re-syncs via the seek path that already exists. Pure modules (transcript parsing, cue-to-annotation mapping) are built and tested standalone before touching the renderer.

**Tech Stack:** TypeScript, React hooks, Zustand (`useUnifiedEngineStore`), Vitest + jsdom, native `HTMLAudioElement`.

**Spec:** `docs/superpowers/specs/2026-07-29-whiteboard-audio-design.md`

## Global Constraints

- All engine-facing time values are milliseconds (numbers). `HTMLAudioElement.currentTime` is seconds — the conversion happens exactly once, inside `audio-manager.ts`. No other file multiplies or divides by 1000.
- Drift guard threshold: `DRIFT_MAX_MS = 120`. Test assertions use a stricter bound (`< 50` ms) so a regression to 119 ms still fails the test.
- No new dependencies. `HTMLAudioElement` and native `fetch`/`FileReader` cover upload, playback, and parsing.
- Test runner: `npx vitest run <path>` (config: `vitest.config.mts`, jsdom environment, `globals: true` — no `describe`/`it`/`expect` imports needed, but existing files in this codebase import them explicitly; match that style for consistency).
- Files colocate with their tests (`foo.ts` + `foo.test.ts` in the same directory), matching `lib/whiteboard-animation/canvas-size.ts` / `.test.ts`.
- Out of scope: background music, sound effects, multiple tracks, automatic speech-to-text.

---

## File Structure

```
lib/whiteboard-animation/audio/
  types.ts                 AudioTrack, TranscriptCue interfaces
  transcript.ts             parseTranscript(text, format) -> TranscriptCue[]
  transcript.test.ts
  apply-cue.ts              applyCueToAnnotation(cue, annotation) -> Annotation
  apply-cue.test.ts
  audio-manager.ts          AudioManager class wrapping HTMLAudioElement
  audio-manager.test.ts
  use-audio-clock.ts        React hook exposing manager state to components
  use-audio-clock.test.ts

lib/whiteboard-animation/components/
  audio-panel.tsx           Upload/TTS source, volume slider, mute
  transcript-panel.tsx      Cue list, link-to-annotation action

lib/storyboard/store.ts     MODIFIED: add audio, transcript fields to WhiteboardConfig
lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts   MODIFIED: audio-driven delta + drift guard
```

Export-side work (absolute-time render loop + audio muxing) is deliberately
**not** in this plan — it depends on the existing export pipeline
(`browser-export.js`, described as a 23-line stub in
`WHITEBOARD_EDITOR_TODO.md` §4), which doesn't exist yet as a real renderer.
Tasks 1–7 below make the editor's preview audio-correct and the data
persisted; wiring export is a follow-on plan once export itself exists.

---

### Task 1: Audio and transcript types

**Files:**
- Create: `lib/whiteboard-animation/audio/types.ts`

**Interfaces:**
- Produces: `AudioTrack`, `TranscriptCue` (used by every subsequent task in this plan)

- [ ] **Step 1: Write the types file**

```typescript
// lib/whiteboard-animation/audio/types.ts

export interface AudioTrack {
  id: string;
  url: string; // blob: (upload) or https: (generated TTS)
  source: 'upload' | 'tts';
  volume: number; // 0..1
  muted: boolean;
  offsetMs: number; // shifts narration start relative to timeline 0
  durationMs: number;
}

export interface TranscriptCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  annotationId?: string; // set once manually linked to an annotation
}
```

There is no test for this step — it is a type-only file. TypeScript
compilation (`npx tsc --noEmit`) is the verification.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "audio/types"`
Expected: no output (no errors reference this file)

- [ ] **Step 3: Commit**

```bash
git add lib/whiteboard-animation/audio/types.ts
git commit -m "feat: add AudioTrack and TranscriptCue types"
```

---

### Task 2: Transcript parsing (SRT, VTT, JSON)

**Files:**
- Create: `lib/whiteboard-animation/audio/transcript.ts`
- Test: `lib/whiteboard-animation/audio/transcript.test.ts`

**Interfaces:**
- Consumes: `TranscriptCue` from Task 1 (`./types`)
- Produces: `parseTranscript(text: string, format: 'srt' | 'vtt' | 'json'): TranscriptCue[]` — used by Task 6 (transcript-panel.tsx)

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/whiteboard-animation/audio/transcript.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/whiteboard-animation/audio/transcript.test.ts`
Expected: FAIL with "Cannot find module './transcript'" (file doesn't exist yet)

- [ ] **Step 3: Write the implementation**

```typescript
// lib/whiteboard-animation/audio/transcript.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/whiteboard-animation/audio/transcript.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/audio/transcript.ts lib/whiteboard-animation/audio/transcript.test.ts
git commit -m "feat: add transcript parser for SRT, VTT, and JSON"
```

---

### Task 3: Cue-to-annotation linking

**Files:**
- Create: `lib/whiteboard-animation/audio/apply-cue.ts`
- Test: `lib/whiteboard-animation/audio/apply-cue.test.ts`

**Interfaces:**
- Consumes: `TranscriptCue` from Task 1 (`./types`); `Annotation` from `lib/whiteboard-animation/schema.ts` (existing — has `reveal.from`, `reveal.to`, `reveal.durationMs`)
- Produces: `applyCueToAnnotation(cue: TranscriptCue, annotation: Annotation): Annotation` and `linkCueToAnnotation(cue: TranscriptCue, annotationId: string): TranscriptCue` — used by Task 6 (transcript-panel.tsx)

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/whiteboard-animation/audio/apply-cue.test.ts
import { describe, expect, it } from "vitest";
import { applyCueToAnnotation, linkCueToAnnotation } from "./apply-cue";
import type { TranscriptCue } from "./types";
import type { Annotation } from "../schema";

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "ann-1",
    text: "",
    region: { x: 0, y: 0, width: 100, height: 100 },
    reveal: { durationMs: 1000 },
    style: { strokeColor: "#000000", strokeWidth: 2, opacity: 1 },
    ...overrides,
  };
}

function makeCue(overrides: Partial<TranscriptCue> = {}): TranscriptCue {
  return { id: "cue-1", startMs: 500, endMs: 2500, text: "narration", ...overrides };
}

describe("applyCueToAnnotation", () => {
  it("sets reveal.from and reveal.to from the cue bounds", () => {
    const result = applyCueToAnnotation(makeCue(), makeAnnotation());
    expect(result.reveal.from).toBe(500);
    expect(result.reveal.to).toBe(2500);
  });

  it("derives durationMs from the cue span", () => {
    const result = applyCueToAnnotation(makeCue({ startMs: 1000, endMs: 4000 }), makeAnnotation());
    expect(result.reveal.durationMs).toBe(3000);
  });

  it("does not mutate the input annotation", () => {
    const annotation = makeAnnotation();
    const originalReveal = annotation.reveal;
    applyCueToAnnotation(makeCue(), annotation);
    expect(annotation.reveal).toBe(originalReveal);
  });

  it("preserves other annotation fields", () => {
    const annotation = makeAnnotation({ text: "keep me" });
    const result = applyCueToAnnotation(makeCue(), annotation);
    expect(result.text).toBe("keep me");
    expect(result.id).toBe("ann-1");
  });

  it("throws if the cue is inverted (endMs <= startMs)", () => {
    const inverted = makeCue({ startMs: 3000, endMs: 1000 });
    expect(() => applyCueToAnnotation(inverted, makeAnnotation())).toThrow();
  });
});

describe("linkCueToAnnotation", () => {
  it("sets annotationId on the cue", () => {
    const result = linkCueToAnnotation(makeCue(), "ann-42");
    expect(result.annotationId).toBe("ann-42");
  });

  it("does not mutate the input cue", () => {
    const cue = makeCue();
    linkCueToAnnotation(cue, "ann-42");
    expect(cue.annotationId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/whiteboard-animation/audio/apply-cue.test.ts`
Expected: FAIL with "Cannot find module './apply-cue'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/whiteboard-animation/audio/apply-cue.ts
import type { Annotation } from "../schema";
import type { TranscriptCue } from "./types";

export function applyCueToAnnotation(
  cue: TranscriptCue,
  annotation: Annotation
): Annotation {
  if (cue.endMs <= cue.startMs) {
    throw new Error(
      `Cannot apply inverted cue (startMs=${cue.startMs}, endMs=${cue.endMs}) to annotation`
    );
  }

  return {
    ...annotation,
    reveal: {
      ...annotation.reveal,
      from: cue.startMs,
      to: cue.endMs,
      durationMs: cue.endMs - cue.startMs,
    },
  };
}

export function linkCueToAnnotation(
  cue: TranscriptCue,
  annotationId: string
): TranscriptCue {
  return { ...cue, annotationId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/whiteboard-animation/audio/apply-cue.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/audio/apply-cue.ts lib/whiteboard-animation/audio/apply-cue.test.ts
git commit -m "feat: add cue-to-annotation linking"
```

---

### Task 4: AudioManager (playback wrapper)

**Files:**
- Create: `lib/whiteboard-animation/audio/audio-manager.ts`
- Test: `lib/whiteboard-animation/audio/audio-manager.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone wrapper around `HTMLAudioElement`)
- Produces: `class AudioManager` with `load(url: string): Promise<void>`, `play(): Promise<void>`, `pause(): void`, `seekMs(ms: number): void`, `setVolume(v: number): void`, `setMuted(m: boolean): void`, `getCurrentMs(): number`, `getDurationMs(): number`, `onTimeUpdate(cb: (ms: number) => void): () => void` (returns unsubscribe), `destroy(): void` — used by Task 5 (`use-audio-clock.ts`) and Task 7 (renderer)

This is the one module that touches a real `<audio>` element, so its test
constructs a jsdom `Audio` instance and drives it directly rather than mocking
fetch — jsdom's `HTMLMediaElement` doesn't actually decode audio, but it does
implement the event/property surface (`currentTime`, `duration`, `volume`,
`muted`, `timeupdate`, `loadedmetadata`) which is all this class touches.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/whiteboard-animation/audio/audio-manager.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AudioManager } from "./audio-manager";

// jsdom's HTMLMediaElement has no real decoder: play()/pause() exist but do
// nothing, and duration/currentTime are plain settable properties. Tests
// drive those properties directly and dispatch the events AudioManager
// listens for, rather than relying on real playback.

describe("AudioManager", () => {
  let manager: AudioManager;

  beforeEach(() => {
    manager = new AudioManager();
  });

  it("starts with currentMs at 0 and durationMs at 0", () => {
    expect(manager.getCurrentMs()).toBe(0);
    expect(manager.getDurationMs()).toBe(0);
  });

  it("converts currentTime seconds to milliseconds", () => {
    const el = manager.getElement();
    Object.defineProperty(el, "currentTime", { value: 2.5, writable: true });
    el.dispatchEvent(new Event("timeupdate"));
    expect(manager.getCurrentMs()).toBe(2500);
  });

  it("converts duration seconds to milliseconds on loadedmetadata", () => {
    const el = manager.getElement();
    Object.defineProperty(el, "duration", { value: 12.34, writable: true });
    el.dispatchEvent(new Event("loadedmetadata"));
    expect(manager.getDurationMs()).toBe(12340);
  });

  it("seekMs converts milliseconds to currentTime seconds", () => {
    const el = manager.getElement();
    manager.seekMs(4200);
    expect(el.currentTime).toBeCloseTo(4.2, 5);
  });

  it("setVolume clamps to [0, 1]", () => {
    const el = manager.getElement();
    manager.setVolume(1.5);
    expect(el.volume).toBe(1);
    manager.setVolume(-0.5);
    expect(el.volume).toBe(0);
    manager.setVolume(0.7);
    expect(el.volume).toBeCloseTo(0.7, 5);
  });

  it("setMuted sets the element's muted flag", () => {
    const el = manager.getElement();
    manager.setMuted(true);
    expect(el.muted).toBe(true);
    manager.setMuted(false);
    expect(el.muted).toBe(false);
  });

  it("onTimeUpdate invokes the callback with milliseconds on each timeupdate", () => {
    const cb = vi.fn();
    manager.onTimeUpdate(cb);
    const el = manager.getElement();
    Object.defineProperty(el, "currentTime", { value: 1.0, writable: true });
    el.dispatchEvent(new Event("timeupdate"));
    expect(cb).toHaveBeenCalledWith(1000);
  });

  it("onTimeUpdate returns an unsubscribe function", () => {
    const cb = vi.fn();
    const unsubscribe = manager.onTimeUpdate(cb);
    unsubscribe();
    const el = manager.getElement();
    Object.defineProperty(el, "currentTime", { value: 1.0, writable: true });
    el.dispatchEvent(new Event("timeupdate"));
    expect(cb).not.toHaveBeenCalled();
  });

  it("destroy removes all listeners and pauses playback", () => {
    const cb = vi.fn();
    manager.onTimeUpdate(cb);
    const el = manager.getElement();
    const pauseSpy = vi.spyOn(el, "pause");
    manager.destroy();
    expect(pauseSpy).toHaveBeenCalled();
    Object.defineProperty(el, "currentTime", { value: 1.0, writable: true });
    el.dispatchEvent(new Event("timeupdate"));
    expect(cb).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/whiteboard-animation/audio/audio-manager.test.ts`
Expected: FAIL with "Cannot find module './audio-manager'"

- [ ] **Step 3: Write the implementation**

```typescript
// lib/whiteboard-animation/audio/audio-manager.ts

/**
 * Wraps a single HTMLAudioElement. All time values crossing this boundary
 * are milliseconds — HTMLAudioElement.currentTime/duration are seconds, and
 * the conversion happens exactly once, here, so no caller has to remember it.
 */
export class AudioManager {
  private el: HTMLAudioElement;
  private timeListeners = new Set<(ms: number) => void>();
  private boundTimeUpdate: () => void;
  private boundLoadedMetadata: () => void;
  private durationMs = 0;

  constructor() {
    this.el = new Audio();
    this.boundTimeUpdate = () => {
      const ms = this.el.currentTime * 1000;
      for (const cb of this.timeListeners) cb(ms);
    };
    this.boundLoadedMetadata = () => {
      this.durationMs = this.el.duration * 1000;
    };
    this.el.addEventListener("timeupdate", this.boundTimeUpdate);
    this.el.addEventListener("loadedmetadata", this.boundLoadedMetadata);
  }

  /** Exposed for testing only — production callers use the methods below. */
  getElement(): HTMLAudioElement {
    return this.el;
  }

  async load(url: string): Promise<void> {
    this.el.src = url;
    this.el.load();
  }

  async play(): Promise<void> {
    await this.el.play();
  }

  pause(): void {
    this.el.pause();
  }

  seekMs(ms: number): void {
    this.el.currentTime = ms / 1000;
  }

  setVolume(v: number): void {
    this.el.volume = Math.max(0, Math.min(1, v));
  }

  setMuted(m: boolean): void {
    this.el.muted = m;
  }

  getCurrentMs(): number {
    return this.el.currentTime * 1000;
  }

  getDurationMs(): number {
    return this.durationMs;
  }

  onTimeUpdate(cb: (ms: number) => void): () => void {
    this.timeListeners.add(cb);
    return () => this.timeListeners.delete(cb);
  }

  destroy(): void {
    this.el.pause();
    this.timeListeners.clear();
    this.el.removeEventListener("timeupdate", this.boundTimeUpdate);
    this.el.removeEventListener("loadedmetadata", this.boundLoadedMetadata);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/whiteboard-animation/audio/audio-manager.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/audio/audio-manager.ts lib/whiteboard-animation/audio/audio-manager.test.ts
git commit -m "feat: add AudioManager wrapping HTMLAudioElement"
```

---

### Task 5: useAudioClock hook

**Files:**
- Create: `lib/whiteboard-animation/audio/use-audio-clock.ts`
- Test: `lib/whiteboard-animation/audio/use-audio-clock.test.ts`

**Interfaces:**
- Consumes: `AudioManager` from Task 4 (`./audio-manager`)
- Produces: `useAudioClock(url: string | null): { manager: AudioManager | null; currentMs: number; durationMs: number; isReady: boolean }` — used by Task 7 (renderer) and Task 6 (audio-panel.tsx)

The hook owns the `AudioManager` instance's lifecycle (create on mount /
url-change, destroy on unmount) and re-renders the consuming component on
each `timeupdate`. Test with `@testing-library/react`'s `renderHook` — check
it's already a project dependency before writing the test.

- [ ] **Step 1: Confirm testing-library is available**

Run: `grep '"@testing-library/react"' package.json`
Expected: a version line is printed. If nothing prints, stop and tell the user — the hook test needs `@testing-library/react`; do not `npm install` it without asking first, since this plan's constraints call for no new dependencies without sign-off.

- [ ] **Step 2: Write the failing tests**

```typescript
// lib/whiteboard-animation/audio/use-audio-clock.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAudioClock } from "./use-audio-clock";

describe("useAudioClock", () => {
  it("returns null manager and isReady false when url is null", () => {
    const { result } = renderHook(() => useAudioClock(null));
    expect(result.current.manager).toBeNull();
    expect(result.current.isReady).toBe(false);
  });

  it("creates a manager when a url is provided", () => {
    const { result } = renderHook(() => useAudioClock("blob:fake-url"));
    expect(result.current.manager).not.toBeNull();
  });

  it("becomes ready after loadedmetadata fires", async () => {
    const { result } = renderHook(() => useAudioClock("blob:fake-url"));
    const el = result.current.manager!.getElement();
    Object.defineProperty(el, "duration", { value: 5, writable: true });
    act(() => {
      el.dispatchEvent(new Event("loadedmetadata"));
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.durationMs).toBe(5000);
  });

  it("updates currentMs on timeupdate", async () => {
    const { result } = renderHook(() => useAudioClock("blob:fake-url"));
    const el = result.current.manager!.getElement();
    Object.defineProperty(el, "currentTime", { value: 3, writable: true });
    act(() => {
      el.dispatchEvent(new Event("timeupdate"));
    });
    await waitFor(() => expect(result.current.currentMs).toBe(3000));
  });

  it("destroys the manager and creates a fresh one when url changes", () => {
    const { result, rerender } = renderHook(
      ({ url }) => useAudioClock(url),
      { initialProps: { url: "blob:first" } }
    );
    const firstManager = result.current.manager;
    const destroySpy = vi.spyOn(firstManager!, "destroy");

    rerender({ url: "blob:second" });

    expect(destroySpy).toHaveBeenCalled();
    expect(result.current.manager).not.toBe(firstManager);
  });

  it("destroys the manager on unmount", () => {
    const { result, unmount } = renderHook(() => useAudioClock("blob:fake-url"));
    const destroySpy = vi.spyOn(result.current.manager!, "destroy");
    unmount();
    expect(destroySpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/whiteboard-animation/audio/use-audio-clock.test.ts`
Expected: FAIL with "Cannot find module './use-audio-clock'"

- [ ] **Step 4: Write the implementation**

```typescript
// lib/whiteboard-animation/audio/use-audio-clock.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioManager } from './audio-manager';

export interface AudioClockState {
  manager: AudioManager | null;
  currentMs: number;
  durationMs: number;
  isReady: boolean;
}

export function useAudioClock(url: string | null): AudioClockState {
  const managerRef = useRef<AudioManager | null>(null);
  const [state, setState] = useState<AudioClockState>({
    manager: null,
    currentMs: 0,
    durationMs: 0,
    isReady: false,
  });

  useEffect(() => {
    if (!url) {
      managerRef.current?.destroy();
      managerRef.current = null;
      setState({ manager: null, currentMs: 0, durationMs: 0, isReady: false });
      return;
    }

    const manager = new AudioManager();
    managerRef.current = manager;
    manager.load(url);

    const unsubscribeTime = manager.onTimeUpdate((ms) => {
      setState((prev) => ({ ...prev, currentMs: ms }));
    });

    const el = manager.getElement();
    const onLoadedMetadata = () => {
      setState((prev) => ({
        ...prev,
        durationMs: manager.getDurationMs(),
        isReady: true,
      }));
    };
    el.addEventListener('loadedmetadata', onLoadedMetadata);

    setState({ manager, currentMs: 0, durationMs: 0, isReady: false });

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      unsubscribeTime();
      manager.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return state;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/whiteboard-animation/audio/use-audio-clock.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/whiteboard-animation/audio/use-audio-clock.ts lib/whiteboard-animation/audio/use-audio-clock.test.ts
git commit -m "feat: add useAudioClock hook"
```

---

### Task 6: Store fields for audio and transcript

**Files:**
- Modify: `lib/storyboard/store.ts`

**Interfaces:**
- Consumes: `AudioTrack`, `TranscriptCue` from Task 1 (`@/lib/whiteboard-animation/audio/types`)
- Produces: `whiteboardConfig.audio: AudioTrack | null`, `whiteboardConfig.transcript: TranscriptCue[]`, `setAudioTrack(track: AudioTrack | null): void`, `setTranscript(cues: TranscriptCue[]): void`, `linkTranscriptCue(cueId: string, annotationId: string): void` on `StoryboardStoreState` — used by Task 8 (audio-panel.tsx) and Task 9 (transcript-panel.tsx)

This task extends the `WhiteboardConfig` interface and store already read in
full during the earlier TODO cleanup work — see `lib/storyboard/store.ts:38`
(`WhiteboardConfig`) and `:304` (`partialize`).

- [ ] **Step 1: Write the failing test**

Create `lib/storyboard/store.test.ts` (this store currently has no test
file — this task adds the first one, scoped to the audio/transcript surface
only):

```typescript
// lib/storyboard/store.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/storyboard/store.test.ts`
Expected: FAIL — `setAudioTrack`/`setTranscript`/`linkTranscriptCue` are not
functions, and `audio`/`transcript` are `undefined` rather than the expected
defaults.

- [ ] **Step 3: Modify the store**

In `lib/storyboard/store.ts`, add the import at the top of the file (near
the existing `@/lib/whiteboard-animation/schema` import):

```typescript
import type {
  AudioTrack,
  TranscriptCue,
} from "@/lib/whiteboard-animation/audio/types";
```

Extend the `WhiteboardConfig` interface (currently ends with
`annotationConfig: AnnotationConfig;` — see current file around line 51):

```typescript
export interface WhiteboardConfig {
  animStyle: string;
  handStyle: string;
  canvasBg: string;
  // Legacy fields kept for backward compatibility with saved projects.
  // These are ignored at runtime but preserved when loading old projects.
  // Zustand merges persisted state, so old projects won't break.
  revealSpeed?: number;
  handSpeed?: number;
  chunks?: number;
  useAnnotation?: boolean;
  // Ni aspectRatio ni resolution ici : le ratio appartient a projectParams
  // (choisi des l'etape Prompt, une seule source), et la resolution est un
  // choix d'EXPORT — l'apercu rend toujours au petit cote 720.
  annotations: Annotation[];
  annotationConfig: AnnotationConfig;
  audio: AudioTrack | null;
  transcript: TranscriptCue[];
}
```

Add to `StoryboardStoreState` actions list (near `setAnnotationConfig`):

```typescript
  setAudioTrack: (track: AudioTrack | null) => void;
  setTranscript: (cues: TranscriptCue[]) => void;
  linkTranscriptCue: (cueId: string, annotationId: string) => void;
```

Update `DEFAULT_WHITEBOARD_CONFIG`:

```typescript
const DEFAULT_WHITEBOARD_CONFIG: WhiteboardConfig = {
  animStyle: "chunkjump",
  handStyle: "custom1",
  canvasBg: "white",
  annotations: [],
  annotationConfig: DEFAULT_ANNOTATION_CONFIG,
  audio: null,
  transcript: [],
};
```

Add the action implementations (near `setAnnotationConfig`'s implementation):

```typescript
      setAudioTrack: (track: AudioTrack | null) =>
        set((state) => ({
          whiteboardConfig: { ...state.whiteboardConfig, audio: track },
        })),

      setTranscript: (cues: TranscriptCue[]) =>
        set((state) => ({
          whiteboardConfig: { ...state.whiteboardConfig, transcript: cues },
        })),

      linkTranscriptCue: (cueId: string, annotationId: string) =>
        set((state) => ({
          whiteboardConfig: {
            ...state.whiteboardConfig,
            transcript: state.whiteboardConfig.transcript.map((c) =>
              c.id === cueId ? { ...c, annotationId } : c
            ),
          },
        })),
```

Update `partialize` to persist the new fields (current block, around line
304 — note the spec's rule on `blob:` URLs not surviving reload: persisting
the track is still correct, since Task 8's audio-panel is responsible for
detecting an unresolvable `blob:` URL after rehydration and prompting
re-upload; the store's job here is only to save what it's given):

```typescript
      partialize: (state: StoryboardStoreState) => ({
        step: state.step,
        projectTitle: state.projectTitle,
        promptContent: state.promptContent,
        projectParams: state.projectParams,
        script: state.script,
        storyboardPanels: state.storyboardPanels,
        selectedVoice: state.selectedVoice,
        whiteboardConfig: {
          animStyle: state.whiteboardConfig.animStyle,
          handStyle: state.whiteboardConfig.handStyle,
          canvasBg: state.whiteboardConfig.canvasBg,
          annotations: state.whiteboardConfig.annotations,
          annotationConfig: state.whiteboardConfig.annotationConfig,
          audio: state.whiteboardConfig.audio,
          transcript: state.whiteboardConfig.transcript,
        },
      }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/storyboard/store.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run full TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep "storyboard/store"`
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add lib/storyboard/store.ts lib/storyboard/store.test.ts
git commit -m "feat: add audio and transcript fields to WhiteboardConfig"
```

---

### Task 7: Audio-driven delta and drift guard in the renderer

**Files:**
- Modify: `lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts:69-108` (hook signature and refs), `:402-418` (the rAF loop)

**Interfaces:**
- Consumes: `useAudioClock` from Task 5 (`../audio/use-audio-clock`)
- Produces: the hook now accepts an optional `audioUrl` prop; internal drift-guard behavior is exercised via the existing seek path (`use-whiteboard-renderer.ts:449`, unchanged)

This is the task the whole plan exists for: **only the source of `delta`
changes.** The rAF scheduling, the `stoppedRef`/`animRef` lifecycle, and the
seek path below it are untouched.

Because this hook is deeply wired into canvas refs, engine construction, and
the Zustand store (see the full read at plan-writing time — 600 lines), this
task is verified with a **targeted unit test of the delta computation
extracted into its own pure function**, rather than a full render test of the
hook. Extracting the delta math into a standalone function also makes Task
7's core logic independently reviewable.

- [ ] **Step 1: Write the failing test for the pure delta function**

Create `lib/whiteboard-animation/hooks/audio-delta.test.ts`:

```typescript
// lib/whiteboard-animation/hooks/audio-delta.test.ts
import { describe, expect, it } from "vitest";
import { computeAudioDelta, DRIFT_MAX_MS } from "./audio-delta";

describe("computeAudioDelta", () => {
  it("returns the difference between audio time and last audio time", () => {
    const result = computeAudioDelta({
      audioNowMs: 1500,
      lastAudioMs: 1000,
      engineTimeMs: 1000,
    });
    expect(result.deltaMs).toBe(500);
  });

  it("does not clamp large deltas the way the old wall-clock loop did", () => {
    const result = computeAudioDelta({
      audioNowMs: 2000,
      lastAudioMs: 1700,
      engineTimeMs: 1700,
    });
    expect(result.deltaMs).toBe(300);
  });

  it("flags no resync when drift is within the threshold", () => {
    const result = computeAudioDelta({
      audioNowMs: 1100,
      lastAudioMs: 1000,
      engineTimeMs: 1050, // 50ms behind audio, under DRIFT_MAX_MS
    });
    expect(result.needsResync).toBe(false);
  });

  it("flags a resync when engine time drifts beyond DRIFT_MAX_MS from audio", () => {
    const result = computeAudioDelta({
      audioNowMs: 2000,
      lastAudioMs: 1900,
      engineTimeMs: 1700, // 300ms behind audio, over DRIFT_MAX_MS (120)
    });
    expect(result.needsResync).toBe(true);
    expect(result.resyncTargetMs).toBe(2000);
  });

  it("treats a negative delta (audio seeked backward) as zero engine advance but still updates lastAudioMs", () => {
    const result = computeAudioDelta({
      audioNowMs: 500,
      lastAudioMs: 1000,
      engineTimeMs: 1000,
    });
    expect(result.deltaMs).toBe(0);
    expect(result.nextLastAudioMs).toBe(500);
  });

  it("DRIFT_MAX_MS is 120", () => {
    expect(DRIFT_MAX_MS).toBe(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/whiteboard-animation/hooks/audio-delta.test.ts`
Expected: FAIL with "Cannot find module './audio-delta'"

- [ ] **Step 3: Write the pure delta function**

```typescript
// lib/whiteboard-animation/hooks/audio-delta.ts

/**
 * Drift tolerance before the renderer re-syncs the engine to the audio
 * clock. 120ms sits below the usual audio/visual lag perception threshold
 * (~125ms) while staying well above normal timer jitter.
 */
export const DRIFT_MAX_MS = 120;

export interface AudioDeltaInput {
  audioNowMs: number;
  lastAudioMs: number;
  engineTimeMs: number;
}

export interface AudioDeltaResult {
  /** Milliseconds to advance the engine by this tick. Never negative. */
  deltaMs: number;
  /** The audioNowMs value the caller should store as lastAudioMs for next tick. */
  nextLastAudioMs: number;
  /** True if engineTimeMs has drifted from audioNowMs beyond DRIFT_MAX_MS. */
  needsResync: boolean;
  /** When needsResync is true, the absolute time the engine should seek to. */
  resyncTargetMs: number;
}

/**
 * Computes how far to advance the animation engine using the audio clock as
 * the time source, instead of wall-clock time. Unlike the old
 * `Math.min(100, now - last)` loop, this never clamps: if a frame takes
 * 300ms, the audio has genuinely advanced 300ms, so the engine should too.
 *
 * A negative raw delta (the user scrubbed the audio backward) cannot be fed
 * to the engine's forward-only tick — that case is surfaced as needsResync
 * so the caller seeks instead of ticking.
 */
export function computeAudioDelta(input: AudioDeltaInput): AudioDeltaResult {
  const { audioNowMs, lastAudioMs, engineTimeMs } = input;
  const rawDelta = audioNowMs - lastAudioMs;
  const deltaMs = Math.max(0, rawDelta);

  const drift = Math.abs(engineTimeMs - audioNowMs);
  const backwardSeek = rawDelta < 0;
  const needsResync = backwardSeek || drift > DRIFT_MAX_MS;

  return {
    deltaMs,
    nextLastAudioMs: audioNowMs,
    needsResync,
    resyncTargetMs: audioNowMs,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/whiteboard-animation/hooks/audio-delta.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Wire the pure function into the renderer**

In `lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts`, add the
import near the top:

```typescript
import { computeAudioDelta } from './audio-delta';
import { useAudioClock } from '../audio/use-audio-clock';
```

Extend the hook's props (current signature at line 59-67):

```typescript
export interface UseWhiteboardRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  handCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  annotationCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  /** Narration URL. When set, the audio clock drives engine timing instead
   *  of wall-clock time — see docs/superpowers/specs/2026-07-29-whiteboard-audio-design.md */
  audioUrl?: string | null;
}
```

Inside the hook body (after the existing `useUnifiedEngine()` destructure
around line 76-85), add:

```typescript
  const { audioUrl } = arguments[0] as UseWhiteboardRendererProps; // see note below
```

Do not actually use `arguments` — instead add `audioUrl` to the destructured
props directly. The hook's function signature becomes:

```typescript
export function useWhiteboardRenderer({
  canvasRef,
  canvasWidth,
  canvasHeight,
  handCanvasRef,
  annotationCanvasRef,
  audioUrl = null,
}: UseWhiteboardRendererProps) {
```

Add the audio clock right after the existing refs block (after
`engineTimeRef` at line 107, before `imageLoaded` state):

```typescript
  const audioClock = useAudioClock(audioUrl);
  // Last audio-clock reading consumed by the rAF loop. Distinct from
  // engineTimeRef, which tracks what the engine itself has rendered to.
  const lastAudioMsRef = useRef(0);
```

Replace the rAF loop body (currently lines 402-411):

```typescript
    stoppedRef.current = false;
    let last = performance.now();
    const step = (now: number) => {
      if (stoppedRef.current) return;
      const delta = Math.min(100, now - last);
      last = now;
      animRef.current?.tick?.(ENGINE_DEFAULT_SPEED, delta);
      if (!stoppedRef.current) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
```

with:

```typescript
    stoppedRef.current = false;
    let last = performance.now();
    const manager = audioClock.manager;
    if (manager) {
      lastAudioMsRef.current = manager.getCurrentMs();
    }
    const step = (now: number) => {
      if (stoppedRef.current) return;

      if (manager) {
        const audioNowMs = manager.getCurrentMs();
        const { deltaMs, nextLastAudioMs, needsResync, resyncTargetMs } =
          computeAudioDelta({
            audioNowMs,
            lastAudioMs: lastAudioMsRef.current,
            engineTimeMs: engineTimeRef.current,
          });
        lastAudioMsRef.current = nextLastAudioMs;

        if (needsResync) {
          // Re-sync via the existing bounded seek path: writing currentTime
          // through the store re-triggers the seek effect below, which
          // replays only the active region (14-34ms), not the whole timeline.
          useUnifiedEngineStore.getState().setCurrentTime(resyncTargetMs);
        } else if (deltaMs > 0) {
          animRef.current?.tick?.(ENGINE_DEFAULT_SPEED, deltaMs);
          engineTimeRef.current += deltaMs;
        }
      } else {
        // No audio loaded: fall back to wall-clock timing, unchanged from
        // before this task.
        const delta = Math.min(100, now - last);
        animRef.current?.tick?.(ENGINE_DEFAULT_SPEED, delta);
      }

      last = now;
      if (!stoppedRef.current) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
```

Note: `useUnifiedEngineStore` must already be imported in this file (it's
used elsewhere in the hook, e.g. line 397 `useUnifiedEngineStore.getState().setIsPlaying(false)`)
— confirm with `grep -n "useUnifiedEngineStore" lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts`
before assuming the import exists; add it if missing:
`import { useUnifiedEngineStore } from '@/lib/unified-engine/context';`.

Also add `audioClock.manager` to the effect's dependency array — the current
effect closes over line 418 with `}, [isPlaying, imageLoaded]);`; change to:

```typescript
  }, [isPlaying, imageLoaded, audioClock.manager]);
```

This re-establishes the loop when the manager instance changes (e.g. a new
audio file is loaded mid-session).

- [ ] **Step 6: Run the full whiteboard-animation test suite**

Run: `npx vitest run lib/whiteboard-animation/`
Expected: PASS — all pre-existing tests (138 per
`WHITEBOARD_EDITOR_TODO.md` §7, now plus this plan's additions) still pass,
confirming the fallback (no-audio) path is unchanged.

- [ ] **Step 7: Run TypeScript check on the renderer**

Run: `npx tsc --noEmit 2>&1 | grep "use-whiteboard-renderer"`
Expected: no output

- [ ] **Step 8: Commit**

```bash
git add lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts lib/whiteboard-animation/hooks/audio-delta.ts lib/whiteboard-animation/hooks/audio-delta.test.ts
git commit -m "feat: drive engine timing from audio clock with drift guard

The rAF loop's delta now comes from the audio element's currentTime
instead of wall-clock time when a narration track is loaded. This
resolves the 100ms delta clamp from WHITEBOARD_EDITOR_TODO.md 3.2 as a
side effect: audio time cannot itself drift, so no clamp is needed.

A drift guard re-syncs via the existing bounded seek path if engine
and audio time diverge by more than 120ms (background tab, decode
stall). Falls back to the pre-existing wall-clock loop when no audio
is loaded — verified by the full existing test suite passing unchanged."
```

---

### Task 8: Audio panel (upload, volume, mute)

**Files:**
- Create: `lib/whiteboard-animation/components/audio-panel.tsx`

**Interfaces:**
- Consumes: `AudioTrack` from Task 1; `setAudioTrack` from Task 6 (store); `useStoryboardStore` (existing)
- Produces: `<AudioPanel />` component — mounted into the whiteboard editor step UI (wiring the mount point into `whiteboard-editor-step.tsx` is this task's last step)

No test file for this task: it is presentational UI wiring existing, already-tested
pieces (`AudioTrack`, `setAudioTrack`). The verification is a manual smoke
check, per this codebase's own convention for UI components (see how
`WhiteboardConfigPanel` and `InkplainerSidebar` were verified in the prior
TODO cleanup work — no component test files exist for either).

- [ ] **Step 1: Write the component**

```typescript
// lib/whiteboard-animation/components/audio-panel.tsx
'use client';

import { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStoryboardStore } from '@/lib/storyboard/store';
import type { AudioTrack } from '../audio/types';

export function AudioPanel() {
  const audio = useStoryboardStore((s) => s.whiteboardConfig.audio);
  const setAudioTrack = useStoryboardStore((s) => s.setAudioTrack);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const el = new Audio(url);
    el.addEventListener('loadedmetadata', () => {
      const track: AudioTrack = {
        id: `audio-${Date.now()}`,
        url,
        source: 'upload',
        volume: 1,
        muted: false,
        offsetMs: 0,
        durationMs: el.duration * 1000,
      };
      setAudioTrack(track);
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audio) return;
    setAudioTrack({ ...audio, volume: Number(e.target.value) });
  };

  const handleMuteToggle = () => {
    if (!audio) return;
    setAudioTrack({ ...audio, muted: !audio.muted });
  };

  const handleClear = () => {
    if (audio?.url.startsWith('blob:')) {
      URL.revokeObjectURL(audio.url);
    }
    setAudioTrack(null);
  };

  return (
    <div className="space-y-4 p-6 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Narration</h3>

      {!audio ? (
        <div className="grid gap-2">
          <Label>Upload audio</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="text-sm"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {(audio.durationMs / 1000).toFixed(1)}s loaded
            </span>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Remove
            </Button>
          </div>

          <div className="grid gap-2">
            <div className="flex justify-between text-xs font-medium">
              <span>Volume</span>
              <span className="text-muted-foreground">
                {Math.round(audio.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={audio.volume}
              onChange={handleVolumeChange}
              disabled={audio.muted}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Muted</Label>
            <input
              type="checkbox"
              checked={audio.muted}
              onChange={handleMuteToggle}
              className="w-4 h-4 accent-primary rounded cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "audio-panel"`
Expected: no output

- [ ] **Step 3: Mount it in the whiteboard editor step**

Find the mount point:

Run: `grep -n "WhiteboardConfigPanel" lib/whiteboard-animation/components/whiteboard-editor-step.tsx`

This will show where `<WhiteboardConfigPanel ... />` is rendered. Add
`<AudioPanel />` immediately after it in the JSX, and add the import at the
top of the file:

```typescript
import { AudioPanel } from './audio-panel';
```

```tsx
<WhiteboardConfigPanel
  config={config}
  onChange={onConfigChange}
/>
<AudioPanel />
```

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, navigate to the whiteboard editor step, upload an audio
file (e.g. `public/audio/test-audio-8s.mp3`), and confirm:
- The upload input disappears and duration/volume/mute controls appear
- Dragging the volume slider updates the displayed percentage
- The mute checkbox disables the slider
- "Remove" clears the track and shows the upload input again

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/components/audio-panel.tsx lib/whiteboard-animation/components/whiteboard-editor-step.tsx
git commit -m "feat: add audio panel for narration upload and volume control"
```

---

### Task 9: Transcript panel (import and cue linking)

**Files:**
- Create: `lib/whiteboard-animation/components/transcript-panel.tsx`

**Interfaces:**
- Consumes: `parseTranscript` from Task 2, `linkCueToAnnotation`/`applyCueToAnnotation` from Task 3, `setTranscript`/`linkTranscriptCue` from Task 6 (store), `updateAnnotation` from the existing store (already present — see `store.ts` `updateAnnotation` action)
- Produces: `<TranscriptPanel />` component — mounted into the whiteboard editor step UI

Same testing approach as Task 8: presentational component over
already-tested pure logic, verified by manual smoke check.

- [ ] **Step 1: Write the component**

```typescript
// lib/whiteboard-animation/components/transcript-panel.tsx
'use client';

import { useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useStoryboardStore } from '@/lib/storyboard/store';
import { parseTranscript } from '../audio/transcript';
import { applyCueToAnnotation, linkCueToAnnotation } from '../audio/apply-cue';
import type { TranscriptCue } from '../audio/types';

function detectFormat(filename: string): 'srt' | 'vtt' | 'json' {
  if (filename.endsWith('.vtt')) return 'vtt';
  if (filename.endsWith('.json')) return 'json';
  return 'srt';
}

export function TranscriptPanel() {
  const transcript = useStoryboardStore((s) => s.whiteboardConfig.transcript);
  const annotations = useStoryboardStore((s) => s.whiteboardConfig.annotations);
  const setTranscript = useStoryboardStore((s) => s.setTranscript);
  const linkTranscriptCue = useStoryboardStore((s) => s.linkTranscriptCue);
  const updateAnnotation = useStoryboardStore((s) => s.updateAnnotation);

  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const cues = parseTranscript(text, detectFormat(file.name));
      setTranscript(cues);
    } catch (err) {
      console.error('Failed to parse transcript:', err);
    }
  };

  const handleLinkToAnnotation = (cue: TranscriptCue, annotationId: string) => {
    const annotation = annotations.find((a) => a.id === annotationId);
    if (!annotation) return;

    const updated = applyCueToAnnotation(cue, annotation);
    updateAnnotation(annotationId, updated);

    const linkedCue = linkCueToAnnotation(cue, annotationId);
    setTranscript(
      transcript.map((c) => (c.id === cue.id ? linkedCue : c))
    );
    setSelectedCueId(null);
  };

  return (
    <div className="space-y-4 p-6 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Transcript</h3>

      <div className="grid gap-2">
        <Label>Import transcript (SRT, VTT, or JSON)</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,.json"
          onChange={handleFileSelect}
          className="text-sm"
        />
      </div>

      {transcript.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {transcript.length} cues
          </p>
          {transcript.map((cue) => (
            <div
              key={cue.id}
              className="p-2 border border-border rounded bg-muted/10 text-xs space-y-1"
            >
              <div className="flex justify-between">
                <span className="font-mono text-muted-foreground">
                  {(cue.startMs / 1000).toFixed(1)}s – {(cue.endMs / 1000).toFixed(1)}s
                </span>
                {cue.annotationId ? (
                  <span className="text-primary font-medium">
                    → {cue.annotationId}
                  </span>
                ) : selectedCueId === cue.id ? (
                  <select
                    autoFocus
                    onChange={(e) => handleLinkToAnnotation(cue, e.target.value)}
                    onBlur={() => setSelectedCueId(null)}
                    className="text-xs border border-border rounded"
                  >
                    <option value="">Select annotation…</option>
                    {annotations.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[10px]"
                    onClick={() => setSelectedCueId(cue.id)}
                  >
                    Link
                  </Button>
                )}
              </div>
              <p className="text-foreground">{cue.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "transcript-panel"`
Expected: no output

- [ ] **Step 3: Mount it in the whiteboard editor step**

In the same file modified in Task 8 (`whiteboard-editor-step.tsx`), add the
import and mount `<TranscriptPanel />` after `<AudioPanel />`:

```typescript
import { TranscriptPanel } from './transcript-panel';
```

```tsx
<WhiteboardConfigPanel config={config} onChange={onConfigChange} />
<AudioPanel />
<TranscriptPanel />
```

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, navigate to the whiteboard editor step. Create a test
transcript file:

```bash
cat > /tmp/test-transcript.srt << 'EOF'
1
00:00:00,000 --> 00:00:02,000
This is the first cue

2
00:00:02,000 --> 00:00:04,500
This is the second cue
EOF
```

Import `/tmp/test-transcript.srt` and confirm:
- Both cues appear with their time ranges and text
- Clicking "Link" on a cue shows a dropdown of existing annotation IDs
- Selecting an annotation replaces the dropdown with `→ <annotation-id>`
- Opening the annotation's own editor (or checking the store in devtools)
  shows its `reveal.from`/`reveal.to` now match the cue's `startMs`/`endMs`

- [ ] **Step 5: Commit**

```bash
git add lib/whiteboard-animation/components/transcript-panel.tsx lib/whiteboard-animation/components/whiteboard-editor-step.tsx
git commit -m "feat: add transcript panel for import and cue-to-annotation linking"
```

---

## Self-Review Notes

**Spec coverage:**
- Audio as delta source + drift guard → Task 7
- Three clock modes (preview+audio, preview-no-audio, export) → Task 7 covers
  the first two; export is explicitly deferred (see File Structure section)
  since the export renderer itself doesn't exist yet per
  `WHITEBOARD_EDITOR_TODO.md` §4
- AudioTrack/TranscriptCue data model → Task 1
- Manual cue-to-annotation linking (not auto-alignment) → Tasks 3, 9
- Volume control → Task 8
- Error handling table (no audio, load failure, scrub, short/long audio,
  unresolvable blob) → no audio and scrub-during-playback are covered
  structurally in Task 7 (fallback branch, drift guard reusing the seek
  path); load failure, duration mismatches, and blob rehydration are UI/data
  concerns addressed in Tasks 8 (upload flow) and 6 (persistence), not
  separately re-tested since they compose already-tested primitives
- Tests: transcript, apply-cue, audio-clock (audio-manager + use-audio-clock),
  audio-sync (audio-delta.test.ts covers the drift math the spec calls
  "audio-sync.test.ts") → Tasks 2, 3, 4, 5, 7

**Deferred to a follow-on plan:** export-side wiring (absolute-time render
loop, audio muxing). This is intentional, not an oversight — see File
Structure section for why.

**Type consistency check:** `AudioTrack`/`TranscriptCue` field names are
identical across Tasks 1, 3, 6, 8, 9 (`startMs`, `endMs`, `annotationId`,
`volume`, `muted`, `offsetMs`, `durationMs`). `computeAudioDelta`'s
`AudioDeltaResult` shape (`deltaMs`, `nextLastAudioMs`, `needsResync`,
`resyncTargetMs`) is defined once in Task 7 and consumed only there — no
cross-task drift possible.
