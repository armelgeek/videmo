import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Controle post-migration : l'identite du proprietaire a bien survecu au
 * passage de Organization.ownerId vers un membre de role owner.
 */
async function main() {
  const organisations = await prisma.organization.findMany({
    select: { id: true, name: true, members: { where: { role: "owner" }, select: { userId: true } } },
  });

  const orphelines = organisations.filter((o) => o.members.length === 0);

  console.log(`${organisations.length} organisation(s) verifiee(s)`);
  console.log(`${await prisma.organizationMember.count()} ligne(s) de membre`);

  if (orphelines.length > 0) {
    console.error(`ECHEC : ${orphelines.length} organisation(s) sans proprietaire`);
    orphelines.forEach((o) => console.error(`  - ${o.id} (${o.name})`));
    process.exit(1);
  }

  console.log("OK : chaque organisation a au moins un membre de role owner");
}

main().finally(() => prisma.$disconnect());
