import { z } from "zod";
import { db as prisma } from "@/lib/db";
import {
  BUILT_IN_WHITEBOARD_STYLES,
  DEFAULT_WHITEBOARD_STYLE_ID,
  builtInWhiteboardStyle,
} from "./built-in";
import type { ManagedWhiteboardStyle, WhiteboardStyle } from "./types";

const rowSchema = z.object({
  key: z.string(),
  label: z.string(),
  hint: z.string(),
  animStyle: z.string(),
  handStyle: z.string(),
});

function toStyle(row: unknown): WhiteboardStyle | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;
  return { id: r.key, label: r.label, hint: r.hint, animStyle: r.animStyle, handStyle: r.handStyle };
}

/**
 * Every whiteboard style this organization can pick: the shipped ones plus its
 * own. Saving under the key of a shipped style overrides it for this
 * organization only — the organization's row wins, the original stays intact.
 *
 * Falls back to the code definitions when the table is empty, so a fresh
 * install works before anyone has run the seed.
 */
export async function listManagedWhiteboardStylesFor(
  organizationId: string | null,
): Promise<ManagedWhiteboardStyle[]> {
  const rows = await prisma.whiteboardStyle.findMany({
    where: {
      deletedAt: null,
      OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])],
    },
    // The organization's own rows come last, so they overwrite the shipped
    // ones of the same key when collected into the map below.
    orderBy: [{ organizationId: "asc" }, { createdAt: "asc" }],
  });

  const byKey = new Map<string, ManagedWhiteboardStyle>();
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
    return BUILT_IN_WHITEBOARD_STYLES.map((style) => ({
      style,
      rowId: null,
      isOwn: false,
      isBuiltIn: true,
    }));
  }
  return [...byKey.values()];
}

export async function listWhiteboardStylesFor(
  organizationId: string | null,
): Promise<WhiteboardStyle[]> {
  return (await listManagedWhiteboardStylesFor(organizationId)).map((m) => m.style);
}

/**
 * One style, resolved for this organization. An unknown key falls back to the
 * default rather than throwing: a project saved against a style that has since
 * been deleted must still open.
 */
export async function resolveWhiteboardStyle(
  key: string | undefined,
  organizationId: string | null,
): Promise<WhiteboardStyle> {
  const styles = await listWhiteboardStylesFor(organizationId);
  const wanted = styles.find((s) => s.id === (key ?? DEFAULT_WHITEBOARD_STYLE_ID));
  if (wanted) return wanted;

  if (key) console.warn(`Unknown whiteboard style "${key}", falling back to a default`);
  return styles.find((s) => s.id === DEFAULT_WHITEBOARD_STYLE_ID) ?? builtInWhiteboardStyle(undefined);
}
