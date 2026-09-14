import { db as prisma } from "./db";
import { type Access, resolveAccess } from "./rbac";

export async function getAccess(userId: string): Promise<Access> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isAdmin: true,
      role: {
        select: {
          name: true,
          isSystem: true,
          rolePermissions: { select: { permission: { select: { resource: true, action: true } } } },
        },
      },
    },
  });

  if (!user) return resolveAccess(null);

  return resolveAccess({
    isAdmin: user.isAdmin,
    role: user.role
      ? {
          name: user.role.name,
          isSystem: user.role.isSystem,
          permissions: user.role.rolePermissions.map((rp) => rp.permission),
        }
      : null,
  });
}

export async function hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
  return (await getAccess(userId)).can(resource, action);
}

export async function canAccessUser(
  editorId: string,
  targetUserId: string,
  action: "read" | "update" = "update",
): Promise<boolean> {
  if (editorId === targetUserId) return true;
  return hasPermission(editorId, "user", action);
}

export async function hasRole(userId: string, roleNames: string[]): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || !user.role) return false;

  return roleNames.includes(user.role.name);
}

export async function canAccessProtectedRoutes(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });

  return Boolean(user?.isAdmin);
}
