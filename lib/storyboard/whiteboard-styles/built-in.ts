import type { WhiteboardStyle } from "./types";

/**
 * The styles shipped with the product.
 *
 * Seed data and fallback, not a registry: the running app reads styles from
 * the database, where an organization overrides any of them or adds its own.
 * Each pairs an animation the engine implements with one of its hand sprites,
 * so every entry renders as described.
 */
export const BUILT_IN_WHITEBOARD_STYLES: readonly WhiteboardStyle[] = [
  {
    id: "doodle",
    label: "Doodle",
    hint: "Block by block, the pencil hand jumping to each new one.",
    animStyle: "chunkjump",
    handStyle: "custom1",
  },
  {
    id: "clean-line",
    label: "Clean line",
    hint: "Every outline traced first, shapes settle in after.",
    animStyle: "contour",
    handStyle: "custom4",
  },
  {
    id: "reveal",
    label: "Reveal",
    hint: "A band sweeps across and leaves the artwork behind it.",
    animStyle: "scanner",
    handStyle: "custom2",
  },
  {
    id: "line-art",
    label: "Line art",
    hint: "Line work alone, no colour fill.",
    animStyle: "outlineonly",
    handStyle: "custom1",
  },
  {
    id: "illustration",
    label: "Illustration",
    hint: "Outline by hand, then every colour laid in.",
    animStyle: "illustfill",
    handStyle: "custom2",
  },
  {
    id: "brushed",
    label: "Brushed",
    hint: "Hatched strokes on small areas, one angled sweep on large ones.",
    animStyle: "brushfill",
    handStyle: "custom3",
  },
  {
    id: "scribble",
    label: "Scribble",
    hint: "Loose scribbled strokes that fill as they go.",
    animStyle: "scribble",
    handStyle: "custom3",
  },
  {
    id: "nervous",
    label: "Nervous",
    hint: "A quick, jittery line with visible hesitation.",
    animStyle: "nervous",
    handStyle: "custom1",
  },
];

export const DEFAULT_WHITEBOARD_STYLE_ID = "doodle";

const BY_ID = new Map(BUILT_IN_WHITEBOARD_STYLES.map((s) => [s.id, s]));

export function builtInWhiteboardStyle(id: string | undefined): WhiteboardStyle {
  return (
    BY_ID.get(id ?? DEFAULT_WHITEBOARD_STYLE_ID) ??
    (BY_ID.get(DEFAULT_WHITEBOARD_STYLE_ID) as WhiteboardStyle)
  );
}

export function isBuiltInWhiteboardStyle(id: string): boolean {
  return BY_ID.has(id);
}
