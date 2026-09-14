import "dotenv/config";
import { prisma } from "../lib/prisma";
import { SUPER_ADMIN_ROLE, permissionCatalog } from "../lib/rbac";

async function main() {
  const catalog = permissionCatalog();

  for (const permission of catalog) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: permission.resource, action: permission.action } },
      create: permission,
      update: { name: permission.name },
    });
  }

  const superAdmin = await prisma.role.upsert({
    where: { name: SUPER_ADMIN_ROLE },
    create: { name: SUPER_ADMIN_ROLE, description: "Full system access with all permissions", isSystem: true },
    update: { isSystem: true },
  });

  const permissions = await prisma.permission.findMany({ select: { id: true } });
  const { count } = await prisma.rolePermission.createMany({
    data: permissions.map((permission) => ({ roleId: superAdmin.id, permissionId: permission.id })),
    skipDuplicates: true,
  });

  console.log(`${catalog.length} permissions in catalog, ${count} newly attached to ${SUPER_ADMIN_ROLE}`);
}

main()
  .catch((error) => {
    console.error("Permission seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
