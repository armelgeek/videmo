import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/db", () => ({ db: { visualStyle: { findMany } } }));

const { listManagedVisualStylesFor, resolveVisualStyle } = await import("./repository");
const { BUILT_IN_VISUAL_STYLES, DEFAULT_VISUAL_STYLE_ID } = await import("./built-in");

const row = (over: Record<string, unknown> = {}) => ({
  id: "row-1",
  key: "doodle",
  organizationId: null,
  isBuiltIn: true,
  label: "Doodle",
  hint: "Simple.",
  artDirection: "Simple pencil doodle",
  accentColors: ["red"],
  vocabulary: ["arrows"],
  labels: "every-subject",
  ...over,
});

beforeEach(() => findMany.mockReset());

describe("listManagedVisualStylesFor", () => {
  it("lets an organization's style override a shipped one of the same key", async () => {
    findMany.mockResolvedValue([
      row(),
      row({ id: "row-2", organizationId: "org-1", isBuiltIn: false, label: "Our doodle", labels: "none" }),
    ]);

    const [only, ...rest] = await listManagedVisualStylesFor("org-1");

    expect(rest).toEqual([]);
    expect(only.style.label).toBe("Our doodle");
    expect(only.style.labels).toBe("none");
    expect(only.isOwn).toBe(true);
    expect(only.rowId).toBe("row-2");
  });

  it("marks a shipped row as neither own nor writable", async () => {
    findMany.mockResolvedValue([row()]);

    const [entry] = await listManagedVisualStylesFor("org-1");

    expect(entry.isOwn).toBe(false);
    expect(entry.isBuiltIn).toBe(true);
  });

  it("falls back to the shipped definitions when the table is empty", async () => {
    findMany.mockResolvedValue([]);

    const list = await listManagedVisualStylesFor(null);

    expect(list).toHaveLength(BUILT_IN_VISUAL_STYLES.length);
    expect(list.every((m) => m.rowId === null && m.isBuiltIn)).toBe(true);
  });

  it("skips an unreadable row instead of breaking the list", async () => {
    // Styles are user-written: one malformed row must not take the picker down.
    findMany.mockResolvedValue([row(), row({ id: "bad", key: "bad", accentColors: "red" })]);

    const list = await listManagedVisualStylesFor("org-1");

    expect(list.map((m) => m.style.id)).toEqual(["doodle"]);
  });

  it("asks only for the shipped styles when there is no organization", async () => {
    findMany.mockResolvedValue([row()]);

    await listManagedVisualStylesFor(null);

    expect(findMany.mock.calls[0][0].where.OR).toEqual([{ organizationId: null }]);
  });
});

describe("resolveVisualStyle", () => {
  it("falls back to the default for a key that no longer exists", async () => {
    // A project saved against a deleted style must still generate images.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findMany.mockResolvedValue([]);

    expect((await resolveVisualStyle("gone", "org-1")).id).toBe(DEFAULT_VISUAL_STYLE_ID);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
