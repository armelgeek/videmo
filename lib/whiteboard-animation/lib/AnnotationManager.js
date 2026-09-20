/**
 * AnnotationManager — schedules and tracks the annotation timeline.
 *
 * An annotation answers ONE question: when does it start drawing, and when
 * is it done?
 *
 *   reveal: { from: 2950, to: 8500 }
 *
 * Everything else is computed and therefore not stored: the duration is
 * `to - from`, the pause is the gap between one annotation's `to` and the
 * next one's `from` (the hand disappears there), the end of the video is the
 * last `to`.
 *
 * These two numbers come from the upstream alignment: the AI reads the
 * timestamped narration transcript and assigns its segment to each region.
 * The sentence split is ITS working material, not our data model — the
 * engine only needs the result.
 *
 * Without audio, `from`/`to` are absent: annotations then chain by
 * `durationMs`, as before. That is the only fallback.
 */

const { repartirDurees } = require('./poids-region');

/** Explicit bounds of an annotation, or null if it has none. */
function bornes(annot) {
  const r = (annot && annot.reveal) || {};
  if (r.from == null || r.to == null) {
    if (r.startMs != null) {
      const from = Math.max(0, Number(r.startMs) || 0);
      const dur = Number(r.durationMs) || 1000;
      const to = Math.max(from + 1, from + dur);
      return { from, to };
    }
    return null;
  }
  const from = Math.max(0, Number(r.from) || 0);
  const to = Math.max(from + 1, Number(r.to) || 0);
  return { from, to };
}

/**
 * The fallback durations, one per annotation.
 *
 * By default it is the stored value, hence the exact old behaviour. With
 * `state.dureesPonderees`, annotations WITHOUT explicit bounds share their
 * common budget in proportion to what they have to get read and drawn (see
 * poids-region.js): a dense region then stops getting the same time as a
 * three-word title.
 *
 * Only annotations without bounds take part in the split. Those that have
 * bounds are placed by the narration alignment, and their time is not ours.
 *
 * A free function, not a method: buildSchedule is called by harnesses on an
 * object carrying only its annotations, without the prototype.
 */
function fallbackDurations(annotations, state) {
  const durations = annotations.map((a) => ((a.reveal || {}).durationMs) || 1000);
  if (!state || !state.dureesPonderees) return durations;

  const free = [];
  annotations.forEach((annot, idx) => { if (!bornes(annot)) free.push(idx); });
  if (free.length < 2) return durations;

  const budget = state.budgetMs || free.reduce((t, idx) => t + durations[idx], 0);
  const parts = repartirDurees(free.map((idx) => annotations[idx]), budget);
  free.forEach((idx, rank) => { durations[idx] = parts[rank]; });
  return durations;
}

class AnnotationManager {
  constructor(state, offscreen) {
    this.state = state;
    this.offscreen = offscreen;
    this.annotations = state.annotations || [];
    // In multi-scene, the clock starts at the scene's GLOBAL instant.
    this.elapsedMs = state.departMs || 0;
    this.schedule = this.buildSchedule(state.departMs || 0);
    this.conflits = this.schedule.filter(s => s.conflit);
  }

  /**
   * @param {number} start  start instant on the global clock, used only by
   *   the no-audio fallback (explicit bounds are already expressed on this
   *   clock).
   */
  buildSchedule(start = 0) {
    const fallback = fallbackDurations(this.annotations, this.state);
    let cursor = start;
    return this.annotations.map((annot, idx) => {
      const b = bornes(annot);
      const startMs = b ? b.from : cursor;
      const endMs = b ? b.to : startMs + fallback[idx];
      cursor = endMs;
      return { idx, annot, startMs, endMs, durationMs: endMs - startMs, explicite: !!b };
    }).map((s, i, all) => {
      // An overlap means the drawing does not fit before the next region: the
      // stroke will have to speed up. We flag it rather than hide it, it is an
      // upstream alignment error.
      const next = all[i + 1];
      return { ...s, conflit: !!(next && next.startMs < s.endMs) };
    });
  }

  /**
   * Advances the clock and returns the annotations active at that instant.
   *
   * A single loop, with no intermediate array: called on every frame of every
   * style, the original filter+map pair allocated three objects per frame to
   * describe, almost always, just one.
   */
  tick(deltaMs) {
    this.elapsedMs += deltaMs;
    const t = this.elapsedMs;
    const actives = [];
    for (let i = 0; i < this.schedule.length; i++) {
      const s = this.schedule[i];
      if (t < s.startMs || t >= s.endMs) continue;
      actives.push({ idx: s.idx, annot: s.annot, startMs: s.startMs,
                     durationMs: s.durationMs,
                     progress: (t - s.startMs) / s.durationMs });
    }
    return actives;
  }

  /** True once past the last `to`. */
  isFinished() {
    return this.elapsedMs >= this.endMs();
  }

  /**
   * End of the timeline.
   *
   * Memoized while the schedule is the same list: it does not change midway,
   * and this pass was done TWICE per frame — timeline end and progress. The
   * cache keys on the identity of `schedule` rather than on construction: the
   * schedule can be set afterwards, and a cache frozen in the constructor
   * would then return undefined.
   */
  endMs() {
    if (this._endMsFor !== this.schedule) {
      this._endMs = this.schedule.reduce((max, s) => Math.max(max, s.endMs), 0);
      this._endMsFor = this.schedule;
    }
    return this._endMs;
  }

  /** Progress (0-1) of the current annotation. */
  getActiveProgress() {
    const active = this.tick(0);
    return active.length ? active[active.length - 1].progress : 0;
  }
}

module.exports = AnnotationManager;
module.exports.bornes = bornes;
