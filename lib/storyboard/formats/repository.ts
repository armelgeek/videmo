import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { BUILT_IN_FORMATS, DEFAULT_FORMAT_ID, builtInFormat } from "./built-in";
import type { ManagedFormat, VideoFormat } from "./types";

/**
 * The shape of the JSON columns.
 *
 * A format can be written by a user through the editor, so what comes back
 * from the database is input, not internal state: a `visual` without its
 * `vocabulary` array would throw inside the prompt builder, far from the row
 * that caused it.
 */
const visualSchema = z.object({
  id: z.string(),
  vocabulary: z.array(z.string()),
  accentColors: z.array(z.string()),
  labels: z.enum(["every-subject", "key-subjects", "none"]),
  defaultAnimationStyle: z.string(),
});

const characterSchema = z.object({
  name: z.string().optional(),
  description: z.string(),
  referenceImageUrl: z.string(),
});

const rowSchema = z.object({
  key: z.string(),
  version: z.number(),
  label: z.string(),
  hint: z.string(),
  family: z.enum(["explainer", "story"]),
  thumbnailUrl: z.string().nullable(),
  paragraphs: z.number(),
  structure: z.array(z.string()),
  defaultTone: z.string(),
  breakdownRules: z.array(z.string()),
  visual: visualSchema,
  character: characterSchema.nullable(),
});

/** A stored row, in the shape the prompt builders expect. */
function toFormat(row: unknown): VideoFormat | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) return null;

  const r = parsed.data;
  return {
    id: r.key,
    version: r.version,
    label: r.label,
    hint: r.hint,
    family: r.family,
    thumbnailUrl: r.thumbnailUrl ?? "",
    script: {
      paragraphs: r.paragraphs,
      structure: r.structure,
      defaultTone: r.defaultTone,
    },
    breakdown: { rules: r.breakdownRules },
    visual: r.visual,
    ...(r.character ? { character: r.character } : {}),
  };
}

/**
 * Every format this organization can write against: the shipped ones, plus
 * its own. An organization overrides a shipped format by saving one under the
 * same key — its version wins, and the shipped one disappears from its list.
 *
 * Falls back to the code definitions when the table is empty, so a fresh
 * install can generate before anyone has run the seed.
 */
export async function listManagedFormatsFor(
  organizationId: string | null,
): Promise<ManagedFormat[]> {
  const rows = await prisma.videoFormat.findMany({
    where: {
      deletedAt: null,
      OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])],
    },
    // The organization's own rows come last, so they overwrite the shipped
    // ones of the same key when collected into the map below.
    orderBy: [{ organizationId: "asc" }, { label: "asc" }],
  });

  const byKey = new Map<string, ManagedFormat>();
  for (const row of rows) {
    const format = toFormat(row);
    if (!format) continue;

    // The scalar columns are guaranteed by the table; only the JSON ones are
    // worth validating, which is what `toFormat` already did.
    const scalars = row as { id?: string; organizationId?: string | null; isBuiltIn?: boolean };
    byKey.set(format.id, {
      format,
      rowId: scalars.id ?? null,
      isOwn: scalars.organizationId != null && scalars.organizationId === organizationId,
      isBuiltIn: Boolean(scalars.isBuiltIn),
    });
  }

  if (byKey.size === 0) {
    return BUILT_IN_FORMATS.map((format) => ({
      format,
      rowId: null,
      isOwn: false,
      isBuiltIn: true,
    }));
  }

  return [...byKey.values()];
}

/** The formats alone, for the places that only need to pick or resolve one. */
export async function listFormatsFor(
  organizationId: string | null,
): Promise<VideoFormat[]> {
  const managed = await listManagedFormatsFor(organizationId);
  return managed.map((m) => m.format);
}

/**
 * One format, resolved for this organization.
 *
 * An unknown key falls back to the default rather than throwing: a project
 * saved against a format that has since been deleted must still open.
 */
export async function resolveFormat(
  key: string | undefined,
  organizationId: string | null,
): Promise<VideoFormat> {
  const formats = await listFormatsFor(organizationId);
  const wanted = formats.find((f) => f.id === (key ?? DEFAULT_FORMAT_ID));
  if (wanted) return wanted;

  if (key) console.warn(`Unknown video format "${key}", falling back to a default`);
  return formats.find((f) => f.id === DEFAULT_FORMAT_ID) ?? builtInFormat(undefined);
}
