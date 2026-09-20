/**
 * How the whiteboard looks while it draws.
 *
 * `animStyle` and `handStyle` both point at things the engine really has:
 * naming one it lacks makes the render fall back to the default with no
 * warning, which is exactly how the landing once advertised styles that
 * existed nowhere.
 */
export interface WhiteboardStyle {
  /** Stored in the project params: never rename an existing id. */
  id: string;
  label: string;
  hint: string;
  /** An id known to AnimationFactory. */
  animStyle: string;
  /** A key of the engine's hand sprites. */
  handStyle: string;
}

/**
 * A style together with what the management screen needs to act on it.
 * Lives here so a client component can import the type without pulling the
 * database module behind it.
 */
export interface ManagedWhiteboardStyle {
  style: WhiteboardStyle;
  /** The row to edit or delete. Null when it comes from the code fallback. */
  rowId: string | null;
  /** Written by this organization, so it can be edited and retired. */
  isOwn: boolean;
  /** Shipped with the product: read-only, overridden rather than changed. */
  isBuiltIn: boolean;
}
