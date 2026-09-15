"use server";

import {
  BillingAccessError,
  billingAccessMessage,
  getBillingViewer,
} from "@/lib/billing/billing-access";
import { listTransactions } from "@/lib/billing/credit-service";

export interface CreditTransactionRow {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string | null;
  createdAt: string;
  userName: string | null;
}

export interface CreditTransactionPage {
  data: CreditTransactionRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listCreditTransactions(
  page = 1,
): Promise<CreditTransactionPage | { error: string }> {
  try {
    const viewer = await getBillingViewer();
    const result = await listTransactions(viewer.organizationId, Number(page) || 1, 10);
    return {
      ...result,
      data: result.data.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        balance: transaction.balance,
        description: transaction.description,
        createdAt: transaction.createdAt.toISOString(),
        userName: transaction.user?.name ?? null,
      })),
    };
  } catch (error) {
    if (error instanceof BillingAccessError) return { error: billingAccessMessage(error) };
    console.error("[billing] Failed to list credit transactions:", error);
    return { error: "Could not load credit history" };
  }
}
