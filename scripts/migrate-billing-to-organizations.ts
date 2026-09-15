import "dotenv/config";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import { initialResetAt, isPaidStatus, PAID_SUBSCRIPTION_STATUSES } from "@/lib/billing/wallet-policy";
import { prisma } from "@/lib/prisma";

const dryRun = process.argv.includes("--dry-run");

async function monthlyCreditsForPlan(planId: string): Promise<number> {
  const quota = await prisma.planQuota.findFirst({ where: { planId, key: "monthly_credits" } });
  if (!quota) throw new Error(`Plan ${planId} has no monthly_credits quota — run seed:plans first`);
  return quota.value;
}

async function attachSubscriptionsToOrganizations(): Promise<number> {
  const orphans = await prisma.subscription.findMany({
    where: { organizationId: null },
    select: { id: true, userId: true, stripeCustomerId: true },
  });

  for (const subscription of orphans) {
    const organizationId = await prismaOrganizationRepository.ensurePersonalOrganization(
      subscription.userId,
    );
    console.log(`  subscription ${subscription.id} → org ${organizationId}`);
    if (dryRun) continue;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { organizationId },
    });
    await prisma.organization.updateMany({
      where: { id: organizationId, stripeCustomerId: null },
      data: { stripeCustomerId: subscription.stripeCustomerId },
    });
  }
  return orphans.length;
}

async function createMissingWallets(): Promise<number> {
  const freePlan = await prisma.plan.findFirst({ where: { tier: "free" } });
  if (!freePlan) throw new Error("No free plan — run seed:plans first");
  const freeCredits = await monthlyCreditsForPlan(freePlan.id);

  const organizations = await prisma.organization.findMany({
    where: { creditWallet: null },
    select: {
      id: true,
      subscriptions: {
        where: { status: { in: [...PAID_SUBSCRIPTION_STATUSES] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { planId: true, status: true, currentPeriodEnd: true },
      },
    },
  });

  const now = new Date();
  for (const organization of organizations) {
    const [subscription] = organization.subscriptions;
    const paid = subscription && isPaidStatus(subscription.status);
    const credits = paid ? await monthlyCreditsForPlan(subscription.planId) : freeCredits;
    const resetAt = initialResetAt(now, paid ? subscription.currentPeriodEnd : null);

    console.log(`  org ${organization.id}: ${credits} credits, reset ${resetAt.toISOString()}`);
    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      // A concurrent lazy wallet creation wins; skip instead of double-granting.
      const created = await tx.creditWallet.createMany({
        data: [{ organizationId: organization.id, planCredits: credits, resetAt }],
        skipDuplicates: true,
      });
      if (created.count === 0) return;

      await tx.creditTransaction.create({
        data: {
          organizationId: organization.id,
          type: "plan_grant",
          amount: credits,
          balance: credits,
          source: "plan",
          description: "Initial credits (billing migration)",
        },
      });
    });
  }
  return organizations.length;
}

async function main() {
  console.log(dryRun ? "Dry run — nothing will be written\n" : "Migrating billing to organizations\n");

  console.log("Attaching subscriptions to organizations...");
  const attached = await attachSubscriptionsToOrganizations();

  console.log("Creating missing wallets...");
  const wallets = await createMissingWallets();

  console.log(`\nDone: ${attached} subscription(s) attached, ${wallets} wallet(s) created.`);
  const remaining = await prisma.subscription.count({ where: { organizationId: null } });
  if (!dryRun && remaining > 0) {
    console.error(`⚠️  ${remaining} subscription(s) still without organization.`);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
