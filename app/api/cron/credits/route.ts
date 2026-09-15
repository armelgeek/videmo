import { type NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/billing/cron-auth";
import { expirePurchases, runDueResets } from "@/lib/billing/credit-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const resets = await runDueResets(now);
    const expiredPurchases = await expirePurchases(now);
    return NextResponse.json({ resets, expiredPurchases, ranAt: now.toISOString() });
  } catch (error) {
    console.error("[cron] credits job failed:", error);
    return NextResponse.json({ error: "Credits job failed" }, { status: 500 });
  }
}
