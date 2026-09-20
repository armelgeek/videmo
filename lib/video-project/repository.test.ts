import { describe, expect, it } from "vitest";
import { ProjectForbiddenError, ProjectNotFoundError } from "./errors";
import {
  type ProjectAccessDeps,
  requireOrganizationRole,
  requireProjectAccess,
} from "./repository";

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

describe("requireOrganizationRole", () => {
  it("returns the active organization and the caller's role", async () => {
    const result = await requireOrganizationRole(VIEWER, deps());
    expect(result).toEqual({ organizationId: "org-1", role: "member" });
  });

  it("throws NotFound when the caller has no active organization", async () => {
    await expect(
      requireOrganizationRole({ userId: "u1", organizationId: null }, deps()),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound when the caller is not a member", async () => {
    await expect(
      requireOrganizationRole(VIEWER, deps({ findRole: async () => null })),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("looks the role up in the viewer's own organization, never elsewhere", async () => {
    const seen: string[] = [];
    await requireOrganizationRole(VIEWER, deps({
      findRole: async (organizationId) => {
        seen.push(organizationId);
        return "member";
      },
    }));
    expect(seen).toEqual(["org-1"]);
  });
});

/**
 * The two guards carried the same doctrine in two implementations that
 * nothing compared. This test is what keeps them from diverging again.
 */
describe("both guards agree on what they have in common", () => {
  const CASES = [
    { name: "no active organization", viewer: { userId: "u1", organizationId: null }, overrides: {} },
    { name: "not a member", viewer: VIEWER, overrides: { findRole: async () => null } },
    { name: "member in good standing", viewer: VIEWER, overrides: {} },
  ] as const;

  for (const { name, viewer, overrides } of CASES) {
    it(`gives the same verdict — ${name}`, async () => {
      const outcome = async (run: () => Promise<unknown>) => {
        try {
          await run();
          return "allowed";
        } catch (error) {
          return (error as Error).name;
        }
      };

      const viaOrganization = await outcome(() =>
        requireOrganizationRole(viewer, deps(overrides)),
      );
      const viaProject = await outcome(() =>
        requireProjectAccess("p1", viewer, "read", deps(overrides)),
      );

      expect(viaProject).toBe(viaOrganization);
    });
  }
});
