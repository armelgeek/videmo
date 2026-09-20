import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/db", () => ({ db: { whiteboardStyle: { findMany } } }));

const { listManagedWhiteboardStylesFor, resolveWhiteboardStyle } = await import("./repository");
const { BUILT_IN_WHITEBOARD_STYLES, DEFAULT_WHITEBOARD_STYLE_ID } = await import("./built-in");

const row = (over: Record<string, unknown> = {}) => ({
  id: "row-1",
  key: "doodle",
  organizationId: null,
  isBuiltIn: true,
  label: "Doodle",
  hint: "Block by block.",
  animStyle: "chunkjump",
  handStyle: "custom1",
  ...over,
});

beforeEach(() => findMany.mockReset());

describe("listManagedWhiteboardStylesFor", () => {
  it("lets an organization's style override a shipped one of the same key", async () => {
    findMany.mockResolvedValue([
      row(),
      row({ id: "row-2", organizationId: "org-1", isBuiltIn: false, label: "Our doodle", handStyle: "custom3" }),
    ]);

    const [only, ...rest] = await listManagedWhiteboardStylesFor("org-1");

    expect(rest).toEqual([]);
    expect(only.style.label).toBe("Our doodle");
    expect(only.isOwn).toBe(true);
    expect(only.rowId).toBe("row-2");
  });

  it("marks a shipped row as neither own nor writable", async () => {
    findMany.mockResolvedValue([row()]);

    const [entry] = await listManagedWhiteboardStylesFor("org-1");

    expect(entry.isOwn).toBe(false);
    expect(entry.isBuiltIn).toBe(true);
  });

  it("falls back to the shipped definitions when the table is empty", async () => {
    findMany.mockResolvedValue([]);

    const list = await listManagedWhiteboardStylesFor(null);

    expect(list).toHaveLength(BUILT_IN_WHITEBOARD_STYLES.length);
    expect(list.every((m) => m.rowId === null && m.isBuiltIn)).toBe(true);
  });

  it("skips an unreadable row instead of breaking the list", async () => {
    findMany.mockResolvedValue([row(), row({ id: "bad", key: "bad", animStyle: undefined })]);

    const list = await listManagedWhiteboardStylesFor("org-1");

    expect(list.map((m) => m.style.id)).toEqual(["doodle"]);
  });

  it("asks only for the shipped styles when there is no organization", async () => {
    findMany.mockResolvedValue([row()]);

    await listManagedWhiteboardStylesFor(null);

    expect(findMany.mock.calls[0][0].where.OR).toEqual([{ organizationId: null }]);
  });
});

describe("resolveWhiteboardStyle", () => {
  it("falls back to the default for a key that no longer exists", async () => {
    // A project saved against a deleted style must still open.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findMany.mockResolvedValue([]);

    expect((await resolveWhiteboardStyle("gone", "org-1")).id).toBe(DEFAULT_WHITEBOARD_STYLE_ID);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
