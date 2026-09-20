/**
 * Locate each narration beat WITHIN one continuous recording.
 *
 * The voice used to be produced beat by beat, to know each one's duration.
 * That solved a measurement problem with a production split, and it caused
 * three defects — a concatenation, a mix, and each beat's end clipped at the
 * switch — plus a fourth, silent one: a TTS restarted on every sentence starts
 * from scratch, with no linking or momentum.
 *
 * So we record in one take and find the beats through the transcription. Each
 * beat's text is known — it comes from the script, word for word — so the job
 * is not understanding, only re-aligning.
 */

export interface TranscriptWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface AlignedBeat {
  /** Start of the beat in the recording. */
  startMs: number;
  /**
   * What the beat OCCUPIES: up to the start of the next one, silence included.
   *
   * Not `end - start`: `deriveTimeline` chains annotations on their durations,
   * so returning the spoken duration would leave pauses out and the drawing
   * would run ahead at every breath.
   */
  durationMs: number;
  /** End of speech, for whoever needs the actual spoken duration. */
  spokenEndMs: number;
}

/**
 * Reduces a word to what can be compared: no case, no accents, no
 * punctuation. The transcription returns « c'est » where the script writes
 * « C'est, », and « 2 » where it writes « deux » — the first gap is absorbed
 * here, the second is not, which is why the alignment tolerates not landing
 * exactly.
 */
export function normalizeToken(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** The words of a text, normalized, empty ones dropped. */
export function tokenize(text: string): string[] {
  return text.split(/\s+/).map(normalizeToken).filter(Boolean);
}

/**
 * How many words we are willing to search around the expected position.
 *
 * The transcription does not return the script's exact words: it sometimes
 * merges two words, writes one as digits, drops one. Without a window, a
 * single-word error would shift ALL following beats.
 */
const WINDOW = 4;

/**
 * Places each beat on the recording.
 *
 * Beats cover the script in order with no gaps: so we walk the transcription,
 * consuming as many words per beat as it contains — then correct locally by
 * looking for its LAST word around the reached position.
 *
 * A beat that cannot be found keeps the slot its word count gives it: an
 * approximate beat is better than an alignment that derails.
 */
export function alignBeats(input: {
  beats: { narration: string }[];
  words: TranscriptWord[];
  /** End of the recording, to bound the last beat. */
  audioDurationMs: number;
}): AlignedBeat[] {
  const { words, audioDurationMs } = input;
  if (words.length === 0 || input.beats.length === 0) return [];

  const bounds: { start: number; end: number }[] = [];
  let cursor = 0;

  for (const beat of input.beats) {
    const tokens = tokenize(beat.narration);
    const startIdx = Math.min(cursor, words.length - 1);

    let endIdx = Math.min(cursor + tokens.length - 1, words.length - 1);

    // Local correction: the beat's last word should be read here. If it is a
    // bit further or a bit earlier, follow the text rather than the count.
    const last = tokens[tokens.length - 1];
    if (last) {
      for (let d = 0; d <= WINDOW; d++) {
        const before = endIdx - d;
        const after = endIdx + d;
        if (before >= startIdx && normalizeToken(words[before]?.word ?? "") === last) {
          endIdx = before;
          break;
        }
        if (after < words.length && normalizeToken(words[after]?.word ?? "") === last) {
          endIdx = after;
          break;
        }
      }
    }

    bounds.push({ start: startIdx, end: Math.max(endIdx, startIdx) });
    cursor = Math.max(endIdx + 1, startIdx + 1);
  }

  return bounds.map((bound, i) => {
    // The first beat starts at ZERO, not at the first word: the recording often
    // opens with a breath. Leaving it out made the drawing start ahead by all
    // that silence — 680 ms measured on one image. This way the beats cover
    // the recording exactly.
    const startMs = i === 0 ? 0 : words[bound.start].startMs;
    const spokenEndMs = words[bound.end].endMs;
    // The beat lasts until the next one starts: the breath between two
    // sentences belongs to the preceding beat, otherwise the drawing runs ahead.
    const next = bounds[i + 1];
    const durationMs =
      (next ? words[next.start].startMs : audioDurationMs) - startMs;

    return { startMs, durationMs: Math.max(1, durationMs), spokenEndMs };
  });
}
