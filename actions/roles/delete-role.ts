"use server";

import { db as prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth-helpers";

export async function deleteRole(id: string) {
  
  await requirePermission("role", "delete");

  if (!id) {
    return { error: "Role ID is required" };
  }

  try {
    
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return { error: "Role not found" };
    }

    if (role.isSystem) {
      return {
        error: "System roles can't be deleted.",
      };
    }

    const usersWithRole = await prisma.user.count({
      where: { roleId: id },
    });

    if (usersWithRole > 0) {
      return {
        error: `This role is assigned to ${usersWithRole} ${usersWithRole === 1 ? "user" : "users"}. Give them another role first.`,
      };
    }

    await prisma.role.delete({
      where: { id },
    });

    return { success: "Role deleted successfully" };
  } catch (error: unknown) {
    console.error(error);
    return { error: "Failed to delete role: " + String(error) };
  }
}
