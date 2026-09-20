/**
 * Splits drawing time between regions according to their weight.
 *
 * WHY
 * Without narration, every annotation got 1000 ms, the same for a three-word
 * title as for a diagram covering half the board. The small one dragged, the
 * large one was drawn at full speed — and since the style paces itself on the
 * window it is given (see Animation.paceStep), the hand itself visibly sped up
 * from one region to the next.
 *
 * HOW
 * The weight mixes two measures that each tell part of the truth:
 *
 *   - the CHARACTER COUNT of the annotation, which tracks how long a narrator
 *     would take to read the region;
 *   - the AREA of the bbox, which tracks what the hand actually has to draw.
 *
 * Neither alone is enough: a long text on a small area reads slowly but draws
 * quickly, a large silent illustration is the opposite. The 70/30 weighting in
 * favour of text comes from the Kinoslide engine (whiteboard-animator, MIT);
 * it puts reading ahead of drawing, because a viewer who has finished reading
 * disengages before the drawing ends.
 *
 * WHAT THIS MODULE DOES NOT DO
 * It does not touch regions that have explicit bounds. When narration is
 * aligned upstream, the audio is authoritative: the drawing follows the voice,
 * not an estimate.
 */

'use strict';

/** Share going to text. The rest goes to area. */
const TEXT_SHARE = 0.7;

/**
 * Floor, as a fraction of the average share.
 *
 * A region with neither text nor surface would drop to zero, hence to a
 * one-frame window: the style would not have time to exist and the region
 * would flicker.
 */
const FLOOR = 0.15;

/** The character count that matters: visible text, whitespace excluded. */
function charCount(annot) {
  const text = (annot && annot.text) || '';
  return text.replace(/\s+/g, '').length;
}

/** The bbox area, tolerant of both region namings encountered. */
function area(annot) {
  const r = (annot && annot.region) || {};
  const w = Number(r.width != null ? r.width : r.w) || 0;
  const h = Number(r.height != null ? r.height : r.h) || 0;
  return Math.max(0, w) * Math.max(0, h);
}

const sum = (xs) => xs.reduce((t, x) => t + x, 0);

/**
 * Relative weights of the annotations, normalized to sum to 1.
 *
 * When one of the two measures is missing everywhere — no text, or regions
 * without dimensions — its share goes to the other rather than being lost. If
 * both are missing, the split falls back to uniform: that is the old behaviour,
 * and the right one, since nothing then distinguishes the regions.
 *
 * @param {Array} annotations
 * @returns {number[]} one weight per annotation, same length, total = 1
 */
function regionWeights(annotations) {
  const n = (annotations || []).length;
  if (n === 0) return [];

  const chars = annotations.map(charCount);
  const areas = annotations.map(area);
  const totalChars = sum(chars);
  const totalArea = sum(areas);

  if (totalChars === 0 && totalArea === 0) return annotations.map(() => 1 / n);

  // A missing measure's share shifts to the other: without this carry-over,
  // silent regions would see 70% of the budget spread uniformly and area
  // would weigh only 30%, which flattens the ranking.
  const textShare = totalChars === 0 ? 0 : totalArea === 0 ? 1 : TEXT_SHARE;
  const areaShare = 1 - textShare;

  const raw = annotations.map((_, i) => {
    const pt = totalChars === 0 ? 0 : chars[i] / totalChars;
    const pa = totalArea === 0 ? 0 : areas[i] / totalArea;
    return textShare * pt + areaShare * pa;
  });

  // Floor then renormalize: raising a weight necessarily takes from the
  // others, so the total must be redone afterwards to stay at 1.
  const minimum = FLOOR / n;
  const raised = raw.map((p) => Math.max(minimum, p));
  const total = sum(raised);
  return raised.map((p) => p / total);
}

/**
 * The budget spread across the annotations, in milliseconds.
 *
 * The floor is taken FROM the other regions, never added to the budget: a
 * raised region must pay for itself, otherwise the video grows with every
 * small region and the requested total is no longer met. The deduction is
 * prorated on each region's margin above the floor, so a region already tight
 * pays almost nothing and does not drop back below the threshold.
 *
 * When the floor is untenable — more regions than the budget can hold — the
 * floor wins: better to exceed the intended duration than to make regions
 * invisible.
 *
 * @param {Array} annotations
 * @param {number} budgetMs  total time to distribute
 * @param {number} floorMs   minimum duration of a region
 * @returns {number[]} one duration per annotation
 */
function repartirDurees(annotations, budgetMs, floorMs = 200) {
  const poids = poidsRegions(annotations);
  const n = poids.length;
  if (n === 0) return [];
  if (floorMs * n >= budgetMs) return weights.map(() => floorMs);

  const durations = weights.map((p) => Math.max(floorMs, budgetMs * p));
  const margins = durations.map((d) => d - floorMs);
  const totalMargin = sum(margins);
  const excesss = sum(durations) - budgetMs;

  if (excess > 0 && totalMargin > 0) {
    const rate = Math.min(1, excess / totalMargin);
    for (let i = 0; i < n; i++) durations[i] -= margins[i] * rate;
  }

  // Rounding happens at the very end, the remainder going to the largest
  // region: rounding before the deduction would drift the total by a few ms.
  const rounded = durations.map((d) => Math.round(d));
  const remainder = budgetMs - sum(rounded);
  if (remainder !== 0) {
    const largest = rounded.indexOf(Math.max(...rounded));
    rounded[largest] = Math.max(floorMs, rounded[largest] + remainder);
  }
  return rounded;
}

module.exports = { regionWeights, repartirDurees, TEXT_SHARE };
