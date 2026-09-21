import { z } from "zod";
import { db as prisma } from "@/lib/db";
import { BUILT_IN_VISUAL_STYLES, DEFAULT_VISUAL_STYLE_ID, builtInVisualStyle } from "./built-in";
import type { ManagedVisualStyle, VisualStyle } from "./types";

/**
 * The shape of a stored row. A style is written by users through the editor,
 * so what comes back from the database is input, not internal state: an
 * `accentColors` that is not an array of strings would throw inside the prompt
 * builder, far from the row that caused it.
 */
const rowSchema = z.object({
  key: z.string(),
  label: z.string(),
  hint: z.string(),
  artDirection: z.string(),
  accentColors: z.array(z.string()),
  vocabulary: z.array(z.string()),
  labels: z.enum(["every-subject", "key-subjects", "none"]),
});

function toStyle(row: unknown): VisualStyle | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) return null;
  const { key, ...rest } = parsed.data;
  return { id: key, ...rest };
}

/**
 * Every visual style this organization can pick: the shipped ones plus its own.
 * Saving under the key of a shipped style overrides it for this organization
 * only — the organization's row wins, the original stays intact.
 *
 * Falls back to the code definitions when the table is empty, so a fresh
 * install works before anyone has run the seed.
 */
export async function listManagedVisualStylesFor(
  organizationId: string | null,
): Promise<ManagedVisualStyle[]> {
  const rows = await prisma.visualStyle.findMany({
    where: {
      deletedAt: null,
      OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])],
    },
    // The organization's own rows come last, so they overwrite the shipped ones
    // of the same key when collected into the map below.
    orderBy: [{ organizationId: "asc" }, { createdAt: "asc" }],
  });

  const byKey = new Map<string, ManagedVisualStyle>();
  for (const row of rows) {
    const style = toStyle(row);
    if (!style) continue;
    byKey.set(style.id, {
      style,
      rowId: row.id,
      isOwn: row.organizationId != null && row.organizationId === organizationId,
      isBuiltIn: row.isBuiltIn,
    });
  }

  if (byKey.size === 0) {
    return BUILT_IN_VISUAL_STYLES.map((style) => ({ style, rowId: null, isOwn: false, isBuiltIn: true }));
  }
  return [...byKey.values()];
}

export async function listVisualStylesFor(organizationId: string | null): Promise<VisualStyle[]> {
  return (await listManagedVisualStylesFor(organizationId)).map((m) => m.style);
}

/**
 * One style, resolved for this organization. An unknown key falls back to the
 * default rather than throwing: a project saved against a style that has since
 * been deleted must still generate.
 */
export async function resolveVisualStyle(
  key: string | undefined,
  organizationId: string | null,
): Promise<VisualStyle> {
  const styles = await listVisualStylesFor(organizationId);
  const found = styles.find((s) => s.id === (key ?? DEFAULT_VISUAL_STYLE_ID));
  if (found) return found;

  if (key) console.warn(`Unknown visual style "${key}", falling back to a default`);

  return styles.find((s) => s.id === DEFAULT_VISUAL_STYLE_ID) ?? builtInVisualStyle(undefined);
}
