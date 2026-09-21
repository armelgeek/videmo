import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({ db: { organizationMember: { findUnique } } }));

const { canCurateLibrary, viewerCanCurate } = await import("./library-access");

beforeEach(() => findUnique.mockReset());

describe("canCurateLibrary", () => {
  it("lets owners and admins curate", () => {
    expect(canCurateLibrary("owner")).toBe(true);
    expect(canCurateLibrary("admin")).toBe(true);
  });

  it("keeps plain members out", () => {
    // A format or a style is shared: one member must not be able to rewrite
    // what every project in the organization generates against.
    expect(canCurateLibrary("member")).toBe(false);
    expect(canCurateLibrary(null)).toBe(false);
    expect(canCurateLibrary(undefined)).toBe(false);
  });
});

describe("viewerCanCurate", () => {
  it("says no without an organization, without asking the database", async () => {
    expect(await viewerCanCurate(null, "user-1")).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("reads the caller's role in that organization", async () => {
    findUnique.mockResolvedValue({ role: "admin" });

    expect(await viewerCanCurate("org-1", "user-1")).toBe(true);
    expect(findUnique.mock.calls[0][0].where).toEqual({
      organizationId_userId: { organizationId: "org-1", userId: "user-1" },
    });
  });

  it("says no when the caller is not a member at all", async () => {
    findUnique.mockResolvedValue(null);

    expect(await viewerCanCurate("org-1", "stranger")).toBe(false);
  });
});
