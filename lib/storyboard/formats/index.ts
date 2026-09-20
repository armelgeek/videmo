import { briefFormat } from "./brief";
import { explainerFormat } from "./explainer";
import { tutorialFormat } from "./tutorial";
import { storyFormat } from "./story";
import { productDemoFormat } from "./product-demo";
import { educationalFormat } from "./educational";
import type { VideoFormat } from "./types";

export type { FormatCharacter, FormatFamily, LabelPolicy, VideoFormat, VisualPreset } from "./types";
export type { PromptConfig, PromptTemplateKey } from "./prompt-templates";
export { generatePrompt, getPromptTemplate, PROMPT_TEMPLATES } from "./prompt-templates";

export const DEFAULT_FORMAT_ID = "explainer";

const FORMATS: readonly VideoFormat[] = [
  briefFormat,
  explainerFormat,
  tutorialFormat,
  storyFormat,
  productDemoFormat,
  educationalFormat,
];

const BY_ID = new Map(FORMATS.map((f) => [f.id, f]));

export function listFormats(): readonly VideoFormat[] {
  return FORMATS;
}

export function listFormatsByFamily(family: string): readonly VideoFormat[] {
  return FORMATS.filter((f) => f.family === family);
}

export function isKnownFormat(id: string): boolean {
  return BY_ID.has(id);
}

/**
 * Unknown ids fall back to the default rather than throwing: a project saved
 * with a format that was later removed must still open.
 */
export function getFormat(id: string | undefined): VideoFormat {
  const format = id ? BY_ID.get(id) : undefined;
  if (format) return format;
  if (id) console.warn(`Unknown video format "${id}", falling back to "${DEFAULT_FORMAT_ID}"`);
  return BY_ID.get(DEFAULT_FORMAT_ID) as VideoFormat;
}
