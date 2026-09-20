export type LabelPolicy = "every-subject" | "key-subjects" | "none";

/**
 * How the drawings themselves look.
 *
 * Every style is still a doodle the engine can trace: clean continuous line
 * work on a pure white background, no gradients, no shadows, subjects kept
 * apart. Those constraints are not fields here — they live in the image prompt
 * and never vary. A style only changes what is left free.
 */
export interface VisualStyle {
  /** Stored in the project params: never rename an existing id. */
  id: string;
  label: string;
  hint: string;
  /** The character of the drawing, in one sentence. */
  artDirection: string;
  /** Allowed as small flat accents. Empty means uncoloured line work only. */
  accentColors: string[];
  /** What the drawing is made of: "arrows", "circles", "boxes"... */
  vocabulary: string[];
  labels: LabelPolicy;
}

/**
 * A style together with what the management screen needs to act on it.
 * Lives here so a client component can import the type without pulling the
 * database module behind it.
 */
export interface ManagedVisualStyle {
  style: VisualStyle;
  /** The row to edit or delete. Null when it comes from the code fallback. */
  rowId: string | null;
  /** Written by this organization, so it can be edited and retired. */
  isOwn: boolean;
  /** Shipped with the product: read-only, overridden rather than changed. */
  isBuiltIn: boolean;
}
