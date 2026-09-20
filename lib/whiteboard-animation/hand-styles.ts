/**
 * The hand sprites the engine can draw with.
 *
 * `key` is the entry in the engine's CUSTOM_HANDS table: a style naming a hand
 * that is not there renders without one. hand-styles.test.ts ties this list to
 * that table so the two cannot drift.
 */
export const HAND_STYLES = [
  { key: "custom1", label: "Pencil Hand (Male)" },
  { key: "custom2", label: "Marker Hand (Female)" },
  { key: "custom3", label: "Chalk Hand" },
  { key: "custom4", label: "Stylus Hand" },
] as const;

export type HandStyleKey = (typeof HAND_STYLES)[number]["key"];

export const HAND_STYLE_KEYS = HAND_STYLES.map((h) => h.key) as [HandStyleKey, ...HandStyleKey[]];

export function isHandStyle(key: string): key is HandStyleKey {
  return HAND_STYLE_KEYS.includes(key as HandStyleKey);
}
