import { type NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/billing/cron-auth";
import { enqueueMonthlyDigests } from "@/lib/email-sequences/enqueue";
import { processDueEmails } from "@/lib/email-sequences/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  try {
    const digestsQueued = await enqueueMonthlyDigests(now);
    const emails = await processDueEmails(now);
    return NextResponse.json({ digestsQueued, ...emails, ranAt: now.toISOString() });
  } catch (error) {
    console.error("[cron] emails job failed:", error);
    return NextResponse.json({ error: "Emails job failed" }, { status: 500 });
  }
}
