export type FormatFamily = "explainer" | "story";

export type LabelPolicy = "every-subject" | "key-subjects" | "none";

/**
 * What a format changes in the image prompt. The engine constraints (white
 * background, continuous strokes, separated subjects) are not part of it: they
 * describe what the animation engine can read, whatever the format.
 */
export interface VisualPreset {
  id: string;
  vocabulary: string[];
  accentColors: string[];
  labels: LabelPolicy;
  defaultAnimationStyle: string;
}

/** The single recurring character of a story format, shipped with the format. */
export interface FormatCharacter {
  name?: string;
  description: string;
  referenceImageUrl: string;
}

/**
 * A format together with what the management screen needs to act on it.
 *
 * Lives here rather than next to the database code so a client component can
 * import the type without pulling the server module behind it.
 */
export interface ManagedFormat {
  format: VideoFormat;
  /** The row to edit or delete. Null when it comes from the code fallback. */
  rowId: string | null;
  /** Written by this organization, so it can be edited and retired. */
  isOwn: boolean;
  /** Shipped with the product: read-only, overridden rather than changed. */
  isBuiltIn: boolean;
}

export interface VideoFormat {
  /** Stored in the project params (`format`): never rename an existing id. */
  id: string;
  version: number;
  label: string;
  hint: string;
  family: FormatFamily;
  thumbnailUrl: string;
  script: {
    paragraphs: number;
    structure: string[];
    defaultTone: string;
  };
  breakdown: {
    rules: string[];
  };
  visual: VisualPreset;
  character?: FormatCharacter;
}
