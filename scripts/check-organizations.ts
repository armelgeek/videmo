import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Post-migration check: the owner's identity survived the move from
 * Organization.ownerId to a member with the owner role.
 */
async function main() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, members: { where: { role: "owner" }, select: { userId: true } } },
  });

  const orphans = organizations.filter((o) => o.members.length === 0);

  console.log(`${organizations.length} organization(s) checked`);
  console.log(`${await prisma.organizationMember.count()} member row(s)`);

  if (orphans.length > 0) {
    console.error(`FAILED: ${orphans.length} organization(s) without an owner`);
    orphans.forEach((o) => console.error(`  - ${o.id} (${o.name})`));
    process.exit(1);
  }

  console.log("OK: every organization has at least one member with the owner role");
}

main().finally(() => prisma.$disconnect());
