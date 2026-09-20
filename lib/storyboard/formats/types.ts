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

/**
 * The type of video a script is written against: how long, in which narrative
 * movements, with which rules for the split.
 *
 * It says nothing about how the result LOOKS — that is the whiteboard style,
 * chosen separately, so any type works with any look.
 */
export interface VideoFormat {
  /** Stored in the project params (`format`): never rename an existing id. */
  id: string;
  version: number;
  label: string;
  hint: string;
  thumbnailUrl: string | null;
  script: {
    paragraphs: number;
    structure: string[];
    defaultTone: string;
  };
  breakdown: {
    rules: string[];
  };
  /**
   * Tells a story around one recurring character, picked from the character
   * library when the project is created.
   */
  usesCharacter: boolean;
}
