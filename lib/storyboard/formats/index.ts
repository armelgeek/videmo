/**
 * Video formats.
 *
 * A format is DATA: it lives in the `VideoFormat` table, and an organization
 * writes its own without a deploy. This entry point carries only what is safe
 * in a browser bundle — the types, and the shipped definitions used as seed
 * data and as a fallback.
 *
 * Reading the formats an organization actually has is a server concern:
 * import `listFormatsFor` / `resolveFormat` from `./repository`.
 */

export type {
  FormatCharacter,
  FormatFamily,
  LabelPolicy,
  ManagedFormat,
  VideoFormat,
  VisualPreset,
} from "./types";

export {
  BUILT_IN_FORMATS,
  DEFAULT_FORMAT_ID,
  builtInFormat,
  isBuiltInFormat,
} from "./built-in";
