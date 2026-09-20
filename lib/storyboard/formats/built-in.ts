import { briefFormat } from "./brief";
import { educationalFormat } from "./educational";
import { explainerFormat } from "./explainer";
import { productDemoFormat } from "./product-demo";
import { storyFormat } from "./story";
import { tutorialFormat } from "./tutorial";
import type { VideoFormat } from "./types";

/**
 * The formats shipped with the product.
 *
 * They are seed data, not a registry: the running app reads formats from the
 * database, where an organization can override any of them or add its own.
 * They stay in code so a fresh install has something to generate with before
 * anyone has written a format, and so `npm run seed:video-formats` has a
 * source to insert from.
 */
export const BUILT_IN_FORMATS: readonly VideoFormat[] = [
  briefFormat,
  explainerFormat,
  tutorialFormat,
  storyFormat,
  productDemoFormat,
  educationalFormat,
];

export const DEFAULT_FORMAT_ID = "explainer";

const BY_ID = new Map(BUILT_IN_FORMATS.map((f) => [f.id, f]));

export function builtInFormat(id: string | undefined): VideoFormat {
  return BY_ID.get(id ?? DEFAULT_FORMAT_ID) ?? (BY_ID.get(DEFAULT_FORMAT_ID) as VideoFormat);
}

export function isBuiltInFormat(id: string): boolean {
  return BY_ID.has(id);
}
