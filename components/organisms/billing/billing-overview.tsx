"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { notifyCreditsChanged } from "@/lib/billing/billing-notice";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";
import { SketchHint } from "@/components/molecules/sketch-hint";
import { CreditHistory } from "./credit-history";
import { CreditTopupDialog } from "./credit-topup-dialog";

const UNLIMITED = -1;

const PRIMARY_ACTION =
  "inline-flex h-10 items-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px";

function UsageRow({
  label,
  current,
  limit,
  unit = "",
}: { label: string; current: number; limit: number; unit?: string }) {
  const unlimited = limit === UNLIMITED;
  const percent = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((current / limit) * 100));

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {current.toLocaleString("en-US")} / {unlimited ? "∞" : limit.toLocaleString("en-US")}
          {unit}
        </span>
      </div>
      {!unlimited && <Progress value={percent} className="h-1.5" aria-label={`${label}: ${percent}% used`} />}
    </div>
  );
}

interface BillingOverviewProps {
  hasSubscription: boolean;
  subscriptionSlot: ReactNode;
}

export function BillingOverview({ hasSubscription, subscriptionSlot }: BillingOverviewProps) {
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
      <p className="rounded-lg border-2 border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
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
  const runningLow = summary.monthlyAllowance > 0 && summary.balance < summary.monthlyAllowance * 0.2;

  return (
    <div className="space-y-8">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="plan-heading"
          className="rounded-xl border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))] sm:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {summary.organizationName}
          </p>
          <h2 id="plan-heading" className="mt-2 font-display text-3xl font-extrabold text-foreground">
            <span className="sk-marker">{summary.planName}</span> plan
          </h2>
          <div className="mt-6">{subscriptionSlot}</div>
        </section>

        <section
          aria-labelledby="credits-heading"
          className="rounded-xl border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))] sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Credits
              </p>
              <h2 id="credits-heading" className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold tabular-nums text-foreground">
                  {summary.balance.toLocaleString("en-US")}
                </span>
                <span className="text-sm text-muted-foreground">available</span>
              </h2>
            </div>

            {summary.canManage && (
              <div className="flex flex-wrap items-center gap-3">
                {runningLow && (
                  <SketchHint direction="right" className="hidden text-lg xl:flex">
                    running low, top up here
                  </SketchHint>
                )}
                <button type="button" onClick={() => setIsTopupOpen(true)} className={PRIMARY_ACTION}>
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  Buy credits
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-2">
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-foreground">Monthly plan credits</span>
              <span className="tabular-nums text-muted-foreground">
                {summary.planCredits.toLocaleString("en-US")} /{" "}
                {summary.monthlyAllowance.toLocaleString("en-US")}
              </span>
            </div>
            <Progress value={planPercent} aria-label={`${planPercent}% of monthly plan credits left`} />
            <p className="text-xs text-muted-foreground">
              Resets on {format(new Date(summary.resetAt), "MMMM d, yyyy")}.
              {summary.purchasedCredits > 0 &&
                ` ${summary.purchasedCredits.toLocaleString("en-US")} purchased credits stay until they expire.`}
              {!summary.canManage && " Ask an owner or admin to buy more credits."}
            </p>
          </div>

          <div className="mt-6 grid gap-4 border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground">Plan usage</h3>
            <UsageRow
              label="Projects"
              current={summary.usage.projects.current}
              limit={summary.usage.projects.limit}
            />
            <UsageRow
              label="Members"
              current={summary.usage.members.current}
              limit={summary.usage.members.limit}
            />
            <UsageRow
              label="Storage"
              current={summary.usage.storageGb.current}
              limit={summary.usage.storageGb.limit}
              unit=" GB"
            />
            {summary.usage.organizations && (
              <UsageRow
                label="Organizations you own"
                current={summary.usage.organizations.current}
                limit={summary.usage.organizations.limit}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Exports up to{" "}
              {summary.maxExportResolution === UNLIMITED
                ? "any resolution"
                : `${summary.maxExportResolution}p`}
              {!hasSubscription && summary.canManage && (
                <>
                  {" · "}
                  <Link href="/billing#plans" className="font-medium text-foreground underline">
                    upgrade for more
                  </Link>
                </>
              )}
            </p>
          </div>
        </section>
      </div>

      <CreditHistory />

      {summary.canManage && <CreditTopupDialog open={isTopupOpen} onOpenChange={setIsTopupOpen} />}
    </div>
  );
}
