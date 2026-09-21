import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { videoFormat: { findMany }, organization: { findUnique } },
}));

const { listFormatsFor, resolveFormat } = await import("./repository");
const { BUILT_IN_FORMATS, DEFAULT_FORMAT_ID } = await import("./built-in");

const row = (over: Record<string, unknown> = {}) => ({
  key: "tutorial",
  label: "Tutorial",
  hint: "Step by step.",
  thumbnailUrl: null,
  paragraphs: 8,
  structure: ["Intro", "Steps"],
  defaultTone: "instructional",
  breakdownRules: ["Number the steps"],
  usesCharacter: false,
  ...over,
});

beforeEach(() => {
  findMany.mockReset();
  findUnique.mockReset();
  findUnique.mockResolvedValue(null);
});

describe("listFormatsFor", () => {
  it("returns what the database holds", async () => {
    findMany.mockResolvedValue([row()]);

    const formats = await listFormatsFor("org-1");

    expect(formats).toHaveLength(1);
    expect(formats[0].id).toBe("tutorial");
    expect(formats[0].script.paragraphs).toBe(8);
    expect(formats[0].breakdown.rules).toEqual(["Number the steps"]);
  });

  it("lets an organization's format override a shipped one of the same key", async () => {
    // This is how a format is changed without a deploy: the shipped row stays
    // untouched for everyone else, the organization sees its own instead.
    findMany.mockResolvedValue([
      row({ label: "Tutorial", paragraphs: 8 }),
      row({ label: "Our tutorial", paragraphs: 20 }),
    ]);

    const formats = await listFormatsFor("org-1");

    expect(formats).toHaveLength(1);
    expect(formats[0].label).toBe("Our tutorial");
    expect(formats[0].script.paragraphs).toBe(20);
  });

  it("falls back to the shipped definitions when the table is empty", async () => {
    // A fresh install must be able to generate before anyone runs the seed.
    findMany.mockResolvedValue([]);

    const formats = await listFormatsFor(null);

    expect(formats).toHaveLength(BUILT_IN_FORMATS.length);
  });

  it("skips a row it cannot read instead of breaking the whole list", async () => {
    // Formats are user-written: one malformed `structure` must not take the
    // format picker down with it.
    findMany.mockResolvedValue([row(), row({ key: "broken", structure: { nope: true } })]);

    const formats = await listFormatsFor("org-1");

    expect(formats.map((f) => f.id)).toEqual(["tutorial"]);
  });

  it("asks only for the shipped formats when there is no organization", async () => {
    findMany.mockResolvedValue([row()]);

    await listFormatsFor(null);

    expect(findMany.mock.calls[0][0].where.OR).toEqual([{ organizationId: null }]);
  });
});

describe("resolveFormat", () => {
  it("returns the format asked for", async () => {
    findMany.mockResolvedValue([row()]);

    expect((await resolveFormat("tutorial", "org-1")).id).toBe("tutorial");
  });

  it("falls back to the default for a key that no longer exists", async () => {
    // A project saved against a deleted format must still open.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    findMany.mockResolvedValue([]);

    expect((await resolveFormat("deleted-format", "org-1")).id).toBe(DEFAULT_FORMAT_ID);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("starts on the organization's own default when no key is given", async () => {
    // What "New project" opens on once an organization has picked a format.
    findMany.mockResolvedValue([row(), row({ key: "brief", label: "Brief" })]);
    findUnique.mockResolvedValue({ defaultFormatKey: "brief" });

    expect((await resolveFormat(undefined, "org-1")).id).toBe("brief");
  });

  it("ignores the organization's default when a format is asked for by name", async () => {
    findMany.mockResolvedValue([row(), row({ key: "brief", label: "Brief" })]);
    findUnique.mockResolvedValue({ defaultFormatKey: "brief" });

    expect((await resolveFormat("tutorial", "org-1")).id).toBe("tutorial");
  });

  it("uses the product default when no key is given", async () => {
    findMany.mockResolvedValue([]);

    expect((await resolveFormat(undefined, null)).id).toBe(DEFAULT_FORMAT_ID);
  });
});
