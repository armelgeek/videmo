export const SUPER_ADMIN_ROLE = "Super Admin";

export const PERMISSION_ACTIONS = ["create", "read", "update", "delete"] as const;

export const PERMISSION_RESOURCES = {
  user: "users",
  role: "roles",
  permission: "permissions",
  setting: "settings",
  blog: "blog posts",
  organization: "organizations",
  showcase: "showcase videos",
} as const;

export function permissionCatalog() {
  return Object.entries(PERMISSION_RESOURCES).flatMap(([resource, label]) =>
    PERMISSION_ACTIONS.map((action) => ({
      name: `${resource}:${action}`,
      resource,
      action,
      description: `${action[0].toUpperCase()}${action.slice(1)} ${label}`,
    })),
  );
}

export interface RoleSnapshot {
  name: string;
  isSystem: boolean;
  permissions: { resource: string; action: string }[];
}

export interface Access {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  granted: string[];
  can(resource: string, action: string): boolean;
}

export function isSuperAdminRole(role: { name: string; isSystem: boolean } | null | undefined): boolean {
  return Boolean(role?.isSystem && role.name === SUPER_ADMIN_ROLE);
}

/**
 * Roles only take effect with admin access, and the Super Admin role holds every
 * permission implicitly so resources added later never lock it out.
 */
export function resolveAccess(user: { isAdmin: boolean; role: RoleSnapshot | null } | null): Access {
  if (!user?.isAdmin || !user.role) {
    return { isAdmin: Boolean(user?.isAdmin), isSuperAdmin: false, granted: [], can: () => false };
  }

  if (isSuperAdminRole(user.role)) {
    return {
      isAdmin: true,
      isSuperAdmin: true,
      granted: permissionCatalog().map((permission) => permission.name),
      can: () => true,
    };
  }

  const granted = user.role.permissions.map(({ resource, action }) => `${resource}:${action}`);
  const set = new Set(granted);
  return {
    isAdmin: true,
    isSuperAdmin: false,
    granted,
    can: (resource, action) => set.has(`${resource}:${action}`),
  };
}

export function checkRoleAssignment({
  actorId,
  targetId,
  actor,
  touchesSuperAdmin,
}: {
  actorId: string;
  targetId: string | null;
  actor: Access;
  touchesSuperAdmin: boolean;
}): string | null {
  if (actorId === targetId) return "You can't change your own role or admin access.";
  if (!actor.can("role", "update")) return "Assigning roles or admin access requires the role:update permission.";
  if (touchesSuperAdmin && !actor.isSuperAdmin) return "Only a Super Admin can grant or remove the Super Admin role.";
  return null;
}

export function checkRoleUpdate({
  isSystem,
  renamed,
  permissionsChanged,
}: {
  isSystem: boolean;
  renamed: boolean;
  permissionsChanged: boolean;
}): string | null {
  if (isSystem && renamed) return "System roles can't be renamed.";
  if (isSystem && permissionsChanged) return "System roles always keep every permission.";
  return null;
}
