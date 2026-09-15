import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { type CreditAction, PURCHASED_CREDITS_VALIDITY_MONTHS } from "./catalog";
import { UnknownCreditActionError } from "./errors";
import { debitSplitSchema, planDebit } from "./ledger";
import { getOrgPlan, invalidatePlanCache } from "./plan-gating";
import { addMonths } from "./wallet-policy";

type Tx = Prisma.TransactionClient;

interface LockedWallet {
  id: string;
  organizationId: string;
  planCredits: number;
  purchasedCredits: number;
  resetAt: Date;
}

async function planAllowance(organizationId: string): Promise<number> {
  const plan = await getOrgPlan(organizationId);
  return Math.max(0, plan.quotas.monthly_credits ?? 0);
}

async function ensureWallet(tx: Tx, organizationId: string): Promise<void> {
  const existing = await tx.creditWallet.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  if (existing) return;

  const credits = await planAllowance(organizationId);
  // Concurrent first requests block on the unique index; only one inserts and grants.
  const created = await tx.creditWallet.createMany({
    data: [{ organizationId, planCredits: credits, resetAt: addMonths(new Date(), 1) }],
    skipDuplicates: true,
  });
  if (created.count === 0) return;

  await tx.creditTransaction.create({
    data: {
      organizationId,
      type: "plan_grant",
      amount: credits,
      balance: credits,
      source: "plan",
      description: "Initial plan credits",
    },
  });
}

async function lockWallet(tx: Tx, organizationId: string): Promise<LockedWallet> {
  await ensureWallet(tx, organizationId);
  const [wallet] = await tx.$queryRaw<LockedWallet[]>`
    SELECT id, "organizationId", "planCredits", "purchasedCredits", "resetAt"
    FROM "CreditWallet"
    WHERE "organizationId" = ${organizationId}
    FOR UPDATE
  `;
  if (!wallet) throw new Error(`Credit wallet missing for organization ${organizationId}`);
  return wallet;
}

async function availablePurchased(tx: Tx, organizationId: string, now: Date): Promise<number> {
  const result = await tx.creditPurchase.aggregate({
    where: { organizationId, expiresAt: { gt: now }, remainingCredits: { gt: 0 } },
    _sum: { remainingCredits: true },
  });
  return result._sum.remainingCredits ?? 0;
}

function inTransaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(run, { timeout: 15_000 });
}

export interface WalletSummary {
  planCredits: number;
  purchasedCredits: number;
  totalBalance: number;
  resetAt: Date;
}

export function getWallet(organizationId: string): Promise<WalletSummary> {
  return inTransaction(async (tx) => {
    await ensureWallet(tx, organizationId);
    const wallet = await tx.creditWallet.findUniqueOrThrow({ where: { organizationId } });
    const purchasedCredits = await availablePurchased(tx, organizationId, new Date());
    return {
      planCredits: wallet.planCredits,
      purchasedCredits,
      totalBalance: wallet.planCredits + purchasedCredits,
      resetAt: wallet.resetAt,
    };
  });
}

export async function getActionCost(action: CreditAction): Promise<number> {
  const cost = await prisma.creditActionCost.findUnique({ where: { action } });
  if (!cost) throw new UnknownCreditActionError(action);
  return cost.cost;
}

export interface ConsumeInput {
  organizationId: string;
  userId: string;
  action: CreditAction;
  referenceId?: string;
}

export function consume(input: ConsumeInput) {
  const { organizationId, userId, action, referenceId } = input;
  return inTransaction(async (tx) => {
    const actionCost = await tx.creditActionCost.findUnique({ where: { action } });
    if (!actionCost) throw new UnknownCreditActionError(action);

    const wallet = await lockWallet(tx, organizationId);
    const now = new Date();
    const purchases = await tx.creditPurchase.findMany({
      where: { organizationId, expiresAt: { gt: now }, remainingCredits: { gt: 0 } },
      select: { id: true, remainingCredits: true, expiresAt: true },
    });

    const debit = planDebit(wallet.planCredits, purchases, actionCost.cost, now);
    const fromPurchased = debit.fromPurchases.reduce((sum, p) => sum + p.amount, 0);

    for (const { id, amount } of debit.fromPurchases) {
      await tx.creditPurchase.update({
        where: { id },
        data: { remainingCredits: { decrement: amount } },
      });
    }
    const updated = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: {
        planCredits: { decrement: debit.fromPlan },
        purchasedCredits: { decrement: Math.min(fromPurchased, wallet.purchasedCredits) },
      },
    });

    const purchasedLeft = purchases.reduce((sum, p) => sum + p.remainingCredits, 0) - fromPurchased;
    return tx.creditTransaction.create({
      data: {
        organizationId,
        userId,
        type: "consumption",
        amount: -actionCost.cost,
        balance: updated.planCredits + purchasedLeft,
        source: debit.source,
        action,
        referenceId,
        description: actionCost.label,
        metadata: { fromPlan: debit.fromPlan, fromPurchases: debit.fromPurchases },
      },
    });
  });
}

// Idempotent: a second refund of the same consumption returns the first one.
export function refund(consumptionId: string, reason = "Generation failed") {
  return inTransaction(async (tx) => {
    const consumption = await tx.creditTransaction.findUnique({ where: { id: consumptionId } });
    if (!consumption || consumption.type !== "consumption") {
      throw new Error(`Transaction ${consumptionId} is not a consumption`);
    }

    const wallet = await lockWallet(tx, consumption.organizationId);
    const existing = await tx.creditTransaction.findFirst({
      where: { type: "refund", referenceId: consumption.id },
    });
    if (existing) return existing;

    const split = debitSplitSchema.parse(consumption.metadata);
    const now = new Date();

    // Credits from a purchase that expired meanwhile are not given back.
    let restoredPurchased = 0;
    for (const { id, amount } of split.fromPurchases) {
      const restored = await tx.creditPurchase.updateMany({
        where: { id, expiresAt: { gt: now } },
        data: { remainingCredits: { increment: amount } },
      });
      restoredPurchased += restored.count * amount;
    }

    const updated = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: {
        planCredits: { increment: split.fromPlan },
        purchasedCredits: { increment: restoredPurchased },
      },
    });

    return tx.creditTransaction.create({
      data: {
        organizationId: consumption.organizationId,
        userId: consumption.userId,
        type: "refund",
        amount: split.fromPlan + restoredPurchased,
        balance:
          updated.planCredits + (await availablePurchased(tx, consumption.organizationId, now)),
        source: consumption.source,
        action: consumption.action,
        referenceId: consumption.id,
        description: reason,
      },
    });
  });
}

export interface PurchaseGrant {
  organizationId: string;
  userId: string | null;
  stripePaymentId: string;
  credits: number;
  amount: number;
  currency: string;
}

// Returns null when this Stripe payment was already granted.
export function grantPurchasedCredits(grant: PurchaseGrant) {
  return inTransaction(async (tx) => {
    const wallet = await lockWallet(tx, grant.organizationId);
    const already = await tx.creditPurchase.findUnique({
      where: { stripePaymentId: grant.stripePaymentId },
      select: { id: true },
    });
    if (already) return null;

    const now = new Date();
    const purchase = await tx.creditPurchase.create({
      data: {
        organizationId: grant.organizationId,
        userId: grant.userId,
        stripePaymentId: grant.stripePaymentId,
        credits: grant.credits,
        amount: grant.amount,
        currency: grant.currency,
        remainingCredits: grant.credits,
        expiresAt: addMonths(now, PURCHASED_CREDITS_VALIDITY_MONTHS),
      },
    });
    const updated = await tx.creditWallet.update({
      where: { id: wallet.id },
      data: { purchasedCredits: { increment: grant.credits } },
    });

    return tx.creditTransaction.create({
      data: {
        organizationId: grant.organizationId,
        userId: grant.userId,
        type: "purchase",
        amount: grant.credits,
        balance: updated.planCredits + (await availablePurchased(tx, grant.organizationId, now)),
        source: "purchased",
        referenceId: purchase.id,
        description: `${grant.credits} credits purchased`,
      },
    });
  });
}

async function resetPlanCredits(
  tx: Tx,
  wallet: LockedWallet,
  allowance: number,
  nextResetAt: Date,
  description: string,
): Promise<void> {
  const now = new Date();
  const purchased = await availablePurchased(tx, wallet.organizationId, now);

  if (wallet.planCredits > 0) {
    await tx.creditTransaction.create({
      data: {
        organizationId: wallet.organizationId,
        type: "expiration",
        amount: -wallet.planCredits,
        balance: purchased,
        source: "plan",
        description: "Unused plan credits expired",
      },
    });
  }

  await tx.creditWallet.update({
    where: { id: wallet.id },
    data: { planCredits: allowance, resetAt: nextResetAt },
  });

  await tx.creditTransaction.create({
    data: {
      organizationId: wallet.organizationId,
      type: "plan_grant",
      amount: allowance,
      balance: allowance + purchased,
      source: "plan",
      description,
    },
  });
}

// Call after the subscription row reflects the new plan (or its removal).
export async function switchPlan(organizationId: string): Promise<void> {
  invalidatePlanCache(organizationId);
  const plan = await getOrgPlan(organizationId);
  const allowance = Math.max(0, plan.quotas.monthly_credits ?? 0);

  await inTransaction(async (tx) => {
    const wallet = await lockWallet(tx, organizationId);
    await resetPlanCredits(
      tx,
      wallet,
      allowance,
      addMonths(new Date(), 1),
      `${plan.name} plan credits`,
    );
  });
}

export async function runDueResets(now = new Date(), batchSize = 500): Promise<number> {
  const due = await prisma.creditWallet.findMany({
    where: { resetAt: { lte: now } },
    select: { organizationId: true },
    take: batchSize,
  });

  let resetCount = 0;
  for (const { organizationId } of due) {
    const allowance = await planAllowance(organizationId);
    const didReset = await inTransaction(async (tx) => {
      const wallet = await lockWallet(tx, organizationId);
      // Another run may have reset it between the scan and the lock.
      if (wallet.resetAt > now) return false;

      let next = wallet.resetAt;
      while (next <= now) next = addMonths(next, 1);
      await resetPlanCredits(tx, wallet, allowance, next, "Monthly plan credits");
      return true;
    });
    if (didReset) resetCount++;
  }
  return resetCount;
}

export async function expirePurchases(now = new Date(), batchSize = 500): Promise<number> {
  const expired = await prisma.creditPurchase.findMany({
    where: { expiresAt: { lte: now }, remainingCredits: { gt: 0 } },
    select: { id: true, organizationId: true },
    take: batchSize,
  });

  let expiredCount = 0;
  for (const { id, organizationId } of expired) {
    const didExpire = await inTransaction(async (tx) => {
      const wallet = await lockWallet(tx, organizationId);
      const purchase = await tx.creditPurchase.findUniqueOrThrow({ where: { id } });
      if (purchase.remainingCredits <= 0) return false;

      await tx.creditPurchase.update({ where: { id }, data: { remainingCredits: 0 } });
      const updated = await tx.creditWallet.update({
        where: { id: wallet.id },
        data: {
          purchasedCredits: {
            decrement: Math.min(purchase.remainingCredits, wallet.purchasedCredits),
          },
        },
      });
      await tx.creditTransaction.create({
        data: {
          organizationId,
          userId: purchase.userId,
          type: "expiration",
          amount: -purchase.remainingCredits,
          balance: updated.planCredits + (await availablePurchased(tx, organizationId, now)),
          source: "purchased",
          referenceId: purchase.id,
          description: "Purchased credits expired",
        },
      });
      return true;
    });
    if (didExpire) expiredCount++;
  }
  return expiredCount;
}

export async function listTransactions(organizationId: string, page = 1, limit = 20) {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage = Math.max(1, page);
  const where = { organizationId };

  const [data, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      select: {
        id: true,
        type: true,
        amount: true,
        balance: true,
        source: true,
        action: true,
        description: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.creditTransaction.count({ where }),
  ]);

  return { data, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
}
