"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { notifyCreditsChanged } from "@/lib/billing/billing-notice";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";
import { CreditHistory } from "./credit-history";
import { CreditTopupDialog } from "./credit-topup-dialog";

const UNLIMITED = -1;

function UsageRow({ label, current, limit }: { label: string; current: number; limit: number }) {
  const unlimited = limit === UNLIMITED;
  const percent = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((current / limit) * 100));

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {current.toLocaleString("en-US")} / {unlimited ? "Unlimited" : limit.toLocaleString("en-US")}
        </span>
      </div>
      {!unlimited && <Progress value={percent} aria-label={`${label}: ${percent}% used`} />}
    </div>
  );
}

export function BillingOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { summary, error } = useCreditSummary();
  const [isTopupOpen, setIsTopupOpen] = useState(() => searchParams.get("topup") === "open");
  const handledTopupParam = useRef(false);

  useEffect(() => {
    const topup = searchParams.get("topup");
    if (!topup || handledTopupParam.current) return;
    handledTopupParam.current = true;

    if (topup === "success") {
      toast.success("Payment received. Your credits appear in a few seconds.");
      // Credits are granted by the Stripe webhook, which usually lands just after the redirect.
      setTimeout(notifyCreditsChanged, 4000);
    }
    if (topup === "cancel") toast("Checkout canceled. No payment was taken.");
    router.replace("/billing", { scroll: false });
  }, [router, searchParams]);

  if (error) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-sm text-muted-foreground">
        {error}
      </p>
    );
  }

  if (!summary) {
    return <div aria-hidden="true" className="h-48 rounded-lg bg-muted motion-safe:animate-pulse" />;
  }

  const planPercent =
    summary.monthlyAllowance > 0
      ? Math.min(100, Math.round((summary.planCredits / summary.monthlyAllowance) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="credits-heading" className="space-y-4 rounded-lg border bg-card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 id="credits-heading" className="text-lg font-semibold">
                Credits
              </h2>
              <p className="text-sm text-muted-foreground">
                {summary.organizationName} · {summary.planName} plan
              </p>
            </div>
            {summary.canManage && (
              <Button onClick={() => setIsTopupOpen(true)}>
                <Zap className="mr-2 h-4 w-4" aria-hidden="true" />
                Buy credits
              </Button>
            )}
          </div>

          <p className="flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">
              {summary.balance.toLocaleString("en-US")}
            </span>
            <span className="text-muted-foreground">credits available</span>
          </p>

          <div className="grid gap-2">
            <div className="flex justify-between gap-2 text-sm">
              <span>Monthly plan credits</span>
              <span className="tabular-nums text-muted-foreground">
                {summary.planCredits.toLocaleString("en-US")} /{" "}
                {summary.monthlyAllowance.toLocaleString("en-US")}
              </span>
            </div>
            <Progress value={planPercent} aria-label={`${planPercent}% of monthly plan credits left`} />
            <p className="text-xs text-muted-foreground">
              Unused plan credits reset on {format(new Date(summary.resetAt), "MMMM d, yyyy")}.
              {summary.purchasedCredits > 0 &&
                ` ${summary.purchasedCredits.toLocaleString("en-US")} purchased credits stay until they expire.`}
            </p>
          </div>

          {!summary.canManage && (
            <p className="text-xs text-muted-foreground">
              Ask an owner or admin of this organization to buy more credits.
            </p>
          )}
        </section>

        <section aria-labelledby="usage-heading" className="space-y-4 rounded-lg border bg-card p-6">
          <h2 id="usage-heading" className="text-lg font-semibold">
            Plan usage
          </h2>
          <UsageRow
            label="Projects"
            current={summary.usage.projects.current}
            limit={summary.usage.projects.limit}
          />
          <UsageRow
            label="Members and invitations"
            current={summary.usage.members.current}
            limit={summary.usage.members.limit}
          />
          <p className="text-xs text-muted-foreground">
            Exports up to {summary.maxExportResolution === UNLIMITED ? "any resolution" : `${summary.maxExportResolution}p`}.
          </p>
        </section>
      </div>

      <CreditHistory />

      {summary.canManage && <CreditTopupDialog open={isTopupOpen} onOpenChange={setIsTopupOpen} />}
    </div>
  );
}
