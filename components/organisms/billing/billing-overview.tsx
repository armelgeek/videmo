"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  Zap,
  AlertTriangle,
  Layers,
  Users,
  HardDrive,
  Building2,
  CalendarClock,
  TrendingUp,
  ShoppingBag,
  Video,
  ArrowUpRight,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { notifyCreditsChanged } from "@/lib/billing/billing-notice";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";
import { SketchHint } from "@/components/molecules/sketch-hint";
import { CreditHistory } from "./credit-history";
import { CreditTopupDialog } from "./credit-topup-dialog";

const UNLIMITED = -1;

// ─── StatChip ──────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border-2 border-border/80 bg-muted/20 px-3 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-[1px_1px_0_hsl(var(--offset))]">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xs font-extrabold text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface BillingOverviewProps {
  hasSubscription: boolean;
  subscriptionSlot: ReactNode;
  onSelectPlansTab?: () => void;
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function BillingOverview({
  hasSubscription,
  subscriptionSlot,
  onSelectPlansTab,
}: BillingOverviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { summary, error } = useCreditSummary();
  const [isTopupOpen, setIsTopupOpen] = useState(
    () => searchParams.get("topup") === "open",
  );
  const handledTopupParam = useRef(false);

  useEffect(() => {
    const topup = searchParams.get("topup");
    if (!topup || handledTopupParam.current) return;
    handledTopupParam.current = true;

    if (topup === "success") {
      toast.success("Payment received. Your credits will appear in a few moments.");
      setTimeout(notifyCreditsChanged, 4000);
    }
    if (topup === "cancel") toast("Checkout canceled. No payment was taken.");
    router.replace("/billing", { scroll: false });
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        <p className="font-semibold">Unable to load billing data</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 rounded-xl bg-muted/40 motion-safe:animate-pulse" />
        <div className="h-80 rounded-xl bg-muted/40 motion-safe:animate-pulse" />
      </div>
    );
  }

  const planPercent =
    summary.monthlyAllowance > 0
      ? Math.min(
          100,
          Math.round((summary.planCredits / summary.monthlyAllowance) * 100),
        )
      : 0;

  const runningLow =
    summary.monthlyAllowance > 0 &&
    summary.balance < summary.monthlyAllowance * 0.2;

  const handleUpgradeClick = (e: React.MouseEvent) => {
    if (onSelectPlansTab) {
      e.preventDefault();
      onSelectPlansTab();
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid items-stretch gap-6 lg:grid-cols-2">

        {/* ── Current Plan Card ── */}
        <section
          aria-labelledby="plan-heading"
          className="flex flex-col gap-6 rounded-xl border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))] sm:p-7"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {summary.organizationName}
              </p>
              <h2
                id="plan-heading"
                className="mt-1 text-2xl font-extrabold text-foreground sm:text-3xl"
              >
                <span className="sk-marker">{summary.planName}</span>
                <span className="ml-1.5 text-lg font-medium text-muted-foreground/60 sm:text-xl">
                  plan
                </span>
              </h2>
            </div>
            <span className="shrink-0 rounded-full border-2 border-ink bg-highlight px-2.5 py-1 text-[11px] font-bold text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
              Active
            </span>
          </div>

          {/* Subscription slot */}
          <div className="flex-1">{subscriptionSlot}</div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 gap-2">
            <StatChip
              icon={Video}
              label="Export quality"
              value={
                summary.maxExportResolution === UNLIMITED
                  ? "Up to 4K"
                  : `${summary.maxExportResolution}p`
              }
            />
            <StatChip
              icon={Users}
              label="Members"
              value={`${summary.usage.members.current} / ${summary.usage.members.limit === UNLIMITED ? "∞" : summary.usage.members.limit}`}
            />
            <StatChip
              icon={Layers}
              label="Projects"
              value={`${summary.usage.projects.current} / ${summary.usage.projects.limit === UNLIMITED ? "∞" : summary.usage.projects.limit}`}
            />
            <StatChip
              icon={HardDrive}
              label="Storage"
              value={`${summary.usage.storageGb.current} / ${summary.usage.storageGb.limit === UNLIMITED ? "∞" : summary.usage.storageGb.limit} GB`}
            />
          </div>

          {/* Upgrade link */}
          {!hasSubscription && summary.canManage && (
            <Link
              href="/billing#plans"
              onClick={handleUpgradeClick}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Upgrade for higher quotas
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </section>

        {/* ── Credits & Usage Card ── */}
        <section
          aria-labelledby="credits-heading"
          className="flex flex-col gap-6 rounded-xl border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))] sm:p-7"
        >
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Available Balance
                </p>
                {runningLow && (
                  <span className="inline-flex items-center gap-1 rounded-md border-2 border-ink bg-highlight px-2 py-0.5 text-[11px] font-bold text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
                    <AlertTriangle className="h-3 w-3" />
                    Running low
                  </span>
                )}
              </div>
              <h2 id="credits-heading" className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums text-foreground sm:text-4xl">
                  {summary.balance.toLocaleString("en-US")}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  credits
                </span>
              </h2>
            </div>

            {summary.canManage && (
              <div className="flex items-center gap-2">
                {runningLow && (
                  <SketchHint direction="right" className="hidden text-lg xl:flex">
                    running low, top up here
                  </SketchHint>
                )}
                <button
                  type="button"
                  onClick={() => setIsTopupOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight"
                >
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  Top up
                </button>
              </div>
            )}
          </div>

          {/* Credit breakdown chips */}
          <div className="grid grid-cols-2 gap-2">
            <StatChip
              icon={TrendingUp}
              label="Plan credits"
              value={summary.planCredits.toLocaleString("en-US")}
            />
            <StatChip
              icon={ShoppingBag}
              label="Purchased"
              value={summary.purchasedCredits.toLocaleString("en-US")}
            />
            <StatChip
              icon={Coins}
              label="Monthly allowance"
              value={summary.monthlyAllowance.toLocaleString("en-US")}
            />
            <StatChip
              icon={CalendarClock}
              label="Resets on"
              value={format(new Date(summary.resetAt), "MMM d, yyyy")}
            />
          </div>

          {/* Monthly plan progress */}
          <div className="rounded-lg border-2 border-ink bg-card shadow-[2px_2px_0_hsl(var(--offset))]">
            {/* Top row: label + ratio */}
            <div className="flex items-baseline justify-between gap-4 px-4 pt-4 pb-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Plan credits this month
              </p>
              <p className="shrink-0 tabular-nums">
                <span className="text-lg font-extrabold text-foreground">
                  {summary.planCredits.toLocaleString("en-US")}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {" "}/ {summary.monthlyAllowance.toLocaleString("en-US")} cr
                </span>
              </p>
            </div>

            {/* Bar */}
            <div className="px-4">
              <Progress
                value={planPercent}
                className="h-3 rounded-full bg-muted/60 [&>div]:bg-highlight [&>div]:rounded-full"
                aria-label={`${planPercent}% of monthly plan credits used`}
              />
            </div>

            {/* Bottom row: reset + purchased */}
            <div className="flex items-center justify-between px-4 pt-2 pb-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3 shrink-0" />
                Resets {format(new Date(summary.resetAt), "MMM d")}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {planPercent}% used
                </span>
                {summary.purchasedCredits > 0 && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>
                      +{summary.purchasedCredits.toLocaleString("en-US")} purchased
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Organizations quota */}
          {summary.usage.organizations && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Other quotas
              </p>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-medium">Organizations</span>
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {summary.usage.organizations.current} /{" "}
                  {summary.usage.organizations.limit === UNLIMITED
                    ? "∞"
                    : summary.usage.organizations.limit}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Credit activity timeline */}
      <CreditHistory />

      {summary.canManage && (
        <CreditTopupDialog open={isTopupOpen} onOpenChange={setIsTopupOpen} />
      )}
    </div>
  );
}
