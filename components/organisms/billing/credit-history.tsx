"use client";

import { useCallback, useEffect, useState } from "react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import {
  type CreditTransactionPage,
  listCreditTransactions,
} from "@/actions/billing/list-credit-transactions";
import { CREDITS_CHANGED_EVENT } from "@/lib/billing/billing-notice";
import { cn } from "@/lib/utils";
import {
  History,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShoppingCart,
  RotateCcw,
  Zap,
  Timer,
  AlertCircle,
  Coins,
  Calendar,
  Clock,
} from "lucide-react";

// ─── Config ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  {
    label: string;
    pill: string;
    pillText: string;
    icon: React.ReactNode;
    iconBg: string;
    positive: boolean;
  }
> = {
  plan_grant: {
    label: "Monthly plan credits",
    pill: "border border-ink bg-highlight text-highlight-foreground font-bold shadow-[1px_1px_0_hsl(var(--offset))]",
    pillText: "Plan grant",
    icon: <Sparkles className="h-4 w-4" />,
    iconBg:
      "border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]",
    positive: true,
  },
  purchase: {
    label: "Credit pack purchase",
    pill: "border border-ink bg-highlight text-highlight-foreground font-bold shadow-[1px_1px_0_hsl(var(--offset))]",
    pillText: "Purchase",
    icon: <ShoppingCart className="h-4 w-4" />,
    iconBg:
      "border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]",
    positive: true,
  },
  refund: {
    label: "Refunded credits",
    pill: "border border-border bg-card text-foreground font-semibold",
    pillText: "Refund",
    icon: <RotateCcw className="h-4 w-4" />,
    iconBg:
      "border-2 border-ink bg-card text-foreground shadow-[2px_2px_0_hsl(var(--offset))]",
    positive: true,
  },
  consumption: {
    label: "Credits used",
    pill: "border border-border bg-muted/60 text-muted-foreground font-semibold",
    pillText: "Usage",
    icon: <Zap className="h-4 w-4" />,
    iconBg:
      "border-2 border-ink bg-card text-foreground shadow-[2px_2px_0_hsl(var(--offset))]",
    positive: false,
  },
  expiration: {
    label: "Expired credits",
    pill: "border border-border bg-muted/60 text-muted-foreground font-semibold",
    pillText: "Expiry",
    icon: <Timer className="h-4 w-4" />,
    iconBg:
      "border-2 border-ink bg-card text-muted-foreground shadow-[2px_2px_0_hsl(var(--offset))]",
    positive: false,
  },
};

const FALLBACK_CONFIG = {
  label: "Transaction",
  pill: "border border-border bg-muted/60 text-muted-foreground font-semibold",
  pillText: "Other",
  icon: <Coins className="h-4 w-4" />,
  iconBg:
    "border-2 border-ink bg-card text-foreground shadow-[2px_2px_0_hsl(var(--offset))]",
  positive: false,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCredits(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.abs(n));
}

function groupLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

type GroupedTransactions = {
  label: string;
  items: NonNullable<CreditTransactionPage>["data"];
}[];

function groupByDay(
  data: NonNullable<CreditTransactionPage>["data"],
): GroupedTransactions {
  const groups: GroupedTransactions = [];
  const seen = new Map<string, number>();

  for (const tx of data) {
    const day = format(parseISO(tx.createdAt), "yyyy-MM-dd");
    if (!seen.has(day)) {
      seen.set(day, groups.length);
      groups.push({ label: groupLabel(tx.createdAt), items: [] });
    }
    groups[seen.get(day)!].items.push(tx);
  }
  return groups;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TransactionSkeleton() {
  return (
    <div className="relative flex gap-4 pb-6">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 shrink-0 rounded-lg border-2 border-border bg-muted/60 motion-safe:animate-pulse" />
        <div className="mt-1 w-0.5 flex-1 bg-border/60" />
      </div>
      <div className="flex-1 space-y-2 rounded-xl border border-border/50 bg-card p-4">
        <div className="h-4 w-40 rounded bg-muted/60 motion-safe:animate-pulse" />
        <div className="h-3 w-24 rounded bg-muted/40 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-ink bg-highlight text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))]">
        <History className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground">No activity yet</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Transactions will appear here once your organization uses or purchases
          credits.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/10 py-10 text-center">
      <AlertCircle className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function DayGroup({
  label,
  items,
  isLast,
}: {
  label: string;
  items: NonNullable<CreditTransactionPage>["data"];
  isLast: boolean;
}) {
  return (
    <div className="relative">
      {/* Date Header Anchor */}
      <div className="relative mb-5 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
          <Calendar className="h-3.5 w-3.5" />
        </div>
        <span className="rounded-md border-2 border-ink bg-card px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
          {label}
        </span>
      </div>

      {/* Vertical line and items */}
      <div className="ml-3.5 border-l-2 border-ink/30 pl-7">
        {items.map((tx, idx) => {
          const cfg = TYPE_CONFIG[tx.type] ?? FALLBACK_CONFIG;
          const isPositive = tx.amount > 0;
          const formatted = formatCredits(tx.amount);
          const isLastItem = isLast && idx === items.length - 1;

          return (
            <div
              key={tx.id}
              className={cn(
                "group relative flex items-start gap-4",
                isLastItem ? "pb-2" : "pb-6",
              )}
            >
              {/* Icon node on the timeline line */}
              <div
                className={cn(
                  "absolute -left-[2.85rem] flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110",
                  cfg.iconBg,
                )}
              >
                {cfg.icon}
              </div>

              {/* Transaction Card */}
              <div className="flex w-full min-w-0 items-stretch justify-between gap-0 overflow-hidden rounded-xl border-2 border-ink bg-card shadow-[3px_3px_0_hsl(var(--offset))] transition-all hover:-translate-x-px hover:-translate-y-px">
                {/* Left details */}
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold text-foreground">
                      {cfg.label}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] leading-none",
                        cfg.pill,
                      )}
                    >
                      {cfg.pillText}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(tx.createdAt), "HH:mm")}
                    </span>
                    {tx.description && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="truncate max-w-[220px]">
                          {tx.description}
                        </span>
                      </>
                    )}
                    {tx.userName && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="font-semibold text-foreground/70">
                          {tx.userName}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-px self-stretch bg-border" />

                {/* Right: amount + balance */}
                <div className="flex shrink-0 flex-col items-end justify-center gap-1.5 px-5 py-3.5 text-right bg-muted/20">
                  {isPositive ? (
                    <span className="inline-flex items-center rounded-md border-2 border-ink bg-highlight px-2.5 py-1 text-sm font-extrabold tabular-nums text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
                      +{formatted}
                      <span className="ml-1 text-[11px] font-medium opacity-70">cr</span>
                    </span>
                  ) : (
                    <p className="text-base font-extrabold tabular-nums leading-none text-foreground">
                      −{formatted}
                      <span className="ml-1 text-[11px] font-medium opacity-50">cr</span>
                    </p>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-foreground/80 shadow-[1px_1px_0_hsl(var(--offset))]">
                    Balance: {formatCredits(tx.balance)} cr
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isLast && <div className="mb-2" />}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function CreditHistory() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CreditTransactionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apply = useCallback(
    (next: CreditTransactionPage | { error: string }) => {
      if ("error" in next) {
        setError(next.error);
        return;
      }
      setError(null);
      setResult(next);
    },
    [],
  );

  const loadData = useCallback(() => {
    setLoading(true);
    listCreditTransactions(page)
      .then(apply)
      .finally(() => setLoading(false));
  }, [apply, page]);

  useEffect(() => {
    loadData();
    window.addEventListener(CREDITS_CHANGED_EVENT, loadData);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, loadData);
  }, [loadData]);

  const pageNumbers = result
    ? Array.from({ length: result.totalPages }, (_, i) => i + 1).filter(
        (p) => result.totalPages <= 5 || Math.abs(p - page) <= 2,
      )
    : [];

  const groups = result ? groupByDay(result.data) : [];

  return (
    <div className="rounded-xl border-2 border-ink bg-card shadow-[5px_5px_0_hsl(var(--offset))]">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              Credit Activity
            </h3>
            <p className="text-xs text-muted-foreground">
              Allowances, purchases &amp; usage history
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border-2 border-ink bg-card px-3 text-xs font-semibold text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5">
        {error ? (
          <ErrorState message={error} />
        ) : !result && loading ? (
          <div className="ml-3.5 border-l-2 border-ink/20 pl-7 space-y-0">
            {[1, 2, 3, 4].map((i) => (
              <TransactionSkeleton key={i} />
            ))}
          </div>
        ) : !result || result.data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-0">
            {/* ── Timeline ── */}
            <div className="space-y-3">
              {groups.map((group, idx) => (
                <DayGroup
                  key={group.label}
                  label={group.label}
                  items={group.items}
                  isLast={idx === groups.length - 1}
                />
              ))}
            </div>

            {/* ── Pagination ── */}
            {result.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 mt-4 text-xs">
                <span className="text-muted-foreground">
                  {result.total} transaction{result.total !== 1 ? "s" : ""} ·
                  page{" "}
                  <span className="font-semibold text-foreground">
                    {result.page}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-foreground">
                    {result.totalPages}
                  </span>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border-2 border-ink bg-card text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px hover:bg-accent disabled:opacity-40 disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={loading}
                      onClick={() => setPage(p)}
                      className={cn(
                        "inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border-2 px-1.5 text-xs font-semibold transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-60",
                        p === page
                          ? "border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]"
                          : "border-ink bg-card text-foreground shadow-[2px_2px_0_hsl(var(--offset))] hover:bg-accent",
                      )}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={page >= result.totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border-2 border-ink bg-card text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px hover:bg-accent disabled:opacity-40 disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
