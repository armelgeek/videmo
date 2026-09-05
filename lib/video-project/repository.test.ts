import { describe, expect, it } from "vitest";
import { ProjectForbiddenError, ProjectNotFoundError } from "./errors";
import { type ProjectAccessDeps, requireProjectAccess } from "./repository";

const PROJECT = { id: "p1", organizationId: "org-1", deletedAt: null };
const VIEWER = { userId: "u1", organizationId: "org-1" };

function deps(overrides: Partial<ProjectAccessDeps> = {}): ProjectAccessDeps {
  return {
    findProject: async () => PROJECT,
    findRole: async () => "member",
    ...overrides,
  };
}

describe("requireProjectAccess", () => {
  it("returns the project and the caller's role", async () => {
    const result = await requireProjectAccess("p1", VIEWER, "read", deps());
    expect(result).toEqual({ project: PROJECT, role: "member" });
  });

  it("throws NotFound when the project does not exist", async () => {
    await expect(
      requireProjectAccess("nope", VIEWER, "read", deps({ findProject: async () => null })),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound when the project is soft-deleted", async () => {
    const gone = { ...PROJECT, deletedAt: new Date() };
    await expect(
      requireProjectAccess("p1", VIEWER, "read", deps({ findProject: async () => gone })),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound — never Forbidden — for another organization's project", async () => {
    const foreign = { userId: "u1", organizationId: "org-2" };
    await expect(
      requireProjectAccess("p1", foreign, "read", deps()),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound when the caller has no active organization", async () => {
    await expect(
      requireProjectAccess("p1", { userId: "u1", organizationId: null }, "read", deps()),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound when the caller is not a member", async () => {
    await expect(
      requireProjectAccess("p1", VIEWER, "read", deps({ findRole: async () => null })),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws Forbidden when the role forbids the action", async () => {
    await expect(
      requireProjectAccess("p1", VIEWER, "delete", deps()),
    ).rejects.toBeInstanceOf(ProjectForbiddenError);
  });

  it("allows an owner to delete", async () => {
    const result = await requireProjectAccess(
      "p1",
      VIEWER,
      "delete",
      deps({ findRole: async () => "owner" }),
    );
    expect(result.role).toBe("owner");
  });
});
