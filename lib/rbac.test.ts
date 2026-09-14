import { describe, expect, it } from "vitest";
import {
  SUPER_ADMIN_ROLE,
  checkRoleAssignment,
  checkRoleUpdate,
  permissionCatalog,
  resolveAccess,
} from "./rbac";

const editor = { name: "Editor", isSystem: false, permissions: [{ resource: "blog", action: "update" }] };
const superAdmin = { name: SUPER_ADMIN_ROLE, isSystem: true, permissions: [] };

describe("resolveAccess", () => {
  it("grants nothing without admin access, even with a role", () => {
    const access = resolveAccess({ isAdmin: false, role: editor });
    expect(access.can("blog", "update")).toBe(false);
    expect(access.granted).toEqual([]);
  });

  it("grants exactly the role's permissions to an admin", () => {
    const access = resolveAccess({ isAdmin: true, role: editor });
    expect(access.can("blog", "update")).toBe(true);
    expect(access.can("blog", "delete")).toBe(false);
    expect(access.isSuperAdmin).toBe(false);
  });

  it("grants every permission to the system Super Admin role, including ones it was never given", () => {
    const access = resolveAccess({ isAdmin: true, role: superAdmin });
    expect(access.can("organization", "delete")).toBe(true);
    expect(access.granted).toHaveLength(permissionCatalog().length);
  });

  it("does not treat a custom role that copies the Super Admin name as Super Admin", () => {
    const impostor = { name: SUPER_ADMIN_ROLE, isSystem: false, permissions: [] };
    expect(resolveAccess({ isAdmin: true, role: impostor }).can("user", "delete")).toBe(false);
  });

  it("handles a missing user", () => {
    expect(resolveAccess(null).can("user", "read")).toBe(false);
  });
});

describe("checkRoleAssignment", () => {
  const roleManager = resolveAccess({
    isAdmin: true,
    role: { name: "Manager", isSystem: false, permissions: [{ resource: "role", action: "update" }] },
  });
  const userManager = resolveAccess({
    isAdmin: true,
    role: { name: "Support", isSystem: false, permissions: [{ resource: "user", action: "update" }] },
  });

  it("refuses changes to one's own role, even for a Super Admin", () => {
    const actor = resolveAccess({ isAdmin: true, role: superAdmin });
    expect(checkRoleAssignment({ actorId: "u1", targetId: "u1", actor, touchesSuperAdmin: false })).toMatch(/own role/);
  });

  it("refuses when the actor can edit users but not roles", () => {
    expect(
      checkRoleAssignment({ actorId: "u1", targetId: "u2", actor: userManager, touchesSuperAdmin: false }),
    ).toMatch(/role:update/);
  });

  it("refuses granting or removing Super Admin to anyone but a Super Admin", () => {
    expect(
      checkRoleAssignment({ actorId: "u1", targetId: "u2", actor: roleManager, touchesSuperAdmin: true }),
    ).toMatch(/Only a Super Admin/);
  });

  it("allows a role manager to assign an ordinary role to someone else", () => {
    expect(
      checkRoleAssignment({ actorId: "u1", targetId: "u2", actor: roleManager, touchesSuperAdmin: false }),
    ).toBeNull();
  });
});

describe("checkRoleUpdate", () => {
  it("lets a system role's description change", () => {
    expect(checkRoleUpdate({ isSystem: true, renamed: false, permissionsChanged: false })).toBeNull();
  });

  it("refuses renaming or changing permissions of a system role", () => {
    expect(checkRoleUpdate({ isSystem: true, renamed: true, permissionsChanged: false })).not.toBeNull();
    expect(checkRoleUpdate({ isSystem: true, renamed: false, permissionsChanged: true })).not.toBeNull();
  });

  it("allows any change on a custom role", () => {
    expect(checkRoleUpdate({ isSystem: false, renamed: true, permissionsChanged: true })).toBeNull();
  });
});
