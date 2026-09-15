"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  type CreditTransactionPage,
  listCreditTransactions,
} from "@/actions/billing/list-credit-transactions";
import { Button } from "@/components/ui/button";
import { CREDITS_CHANGED_EVENT } from "@/lib/billing/billing-notice";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  plan_grant: "Plan credits",
  consumption: "Used",
  purchase: "Purchased",
  expiration: "Expired",
  refund: "Refunded",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  plan_grant: <TrendingUp className="h-4 w-4" />,
  consumption: <TrendingDown className="h-4 w-4" />,
  purchase: <TrendingUp className="h-4 w-4" />,
  expiration: <Clock className="h-4 w-4" />,
  refund: <TrendingUp className="h-4 w-4" />,
};

export function CreditHistory() {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<CreditTransactionPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((next: CreditTransactionPage | { error: string }) => {
    if ("error" in next) {
      setError(next.error);
      return;
    }
    setError(null);
    setResult(next);
  }, []);

  useEffect(() => {
    let active = true;
    const load = () =>
      listCreditTransactions(page).then((next) => {
        if (active) apply(next);
      });

    void load();
    window.addEventListener(CREDITS_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(CREDITS_CHANGED_EVENT, load);
    };
  }, [apply, page]);

  return (
    <section aria-labelledby="credit-history-heading" className="space-y-4 rounded-lg border-2 border-border bg-card p-6 shadow-[3px_3px_0_hsl(var(--offset))]">
      <h2 id="credit-history-heading" className="text-lg font-semibold">
        Credit history
      </h2>

      {error ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : !result ? (
        <div aria-hidden="true" className="h-32 rounded-md bg-muted motion-safe:animate-pulse" />
      ) : result.data.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">No credit activity yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {result.data.map((transaction, index) => (
              <div key={transaction.id} className="flex gap-4">
                {/* Timeline dot and line */}
                <div className="flex flex-col items-center">
                  <div className="rounded-full border-2 border-border bg-card p-2 text-muted-foreground">
                    {TYPE_ICONS[transaction.type] || <Clock className="h-4 w-4" />}
                  </div>
                  {index < result.data.length - 1 && (
                    <div className="my-2 h-8 w-0.5 bg-border" />
                  )}
                </div>

                {/* Transaction details */}
                <div className="flex-1 py-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {TYPE_LABELS[transaction.type] ?? transaction.type}
                      </p>
                      {transaction.description && (
                        <p className="text-xs text-muted-foreground">
                          {transaction.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(transaction.createdAt), "MMM d, yyyy HH:mm")}
                        {transaction.userName && ` • ${transaction.userName}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          transaction.amount < 0 ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Balance: {transaction.balance}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {result && result.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm pt-4 border-t border-border">
              <span className="text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= result.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
