import "dotenv/config";
import { syncPlanCatalog } from "../lib/billing/sync-catalog";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("Seeding plans, quotas, feature gates and credit costs...");
  await syncPlanCatalog(prisma);

  const plans = await prisma.plan.findMany({
    select: { tier: true, interval: true, amount: true, stripePriceId: true },
    orderBy: [{ amount: "asc" }],
  });
  console.table(plans);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
