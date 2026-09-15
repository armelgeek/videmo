"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  type CreditTransactionPage,
  listCreditTransactions,
} from "@/actions/billing/list-credit-transactions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CREDITS_CHANGED_EVENT } from "@/lib/billing/billing-notice";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  plan_grant: "Plan credits",
  consumption: "Used",
  purchase: "Purchased",
  expiration: "Expired",
  refund: "Refunded",
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
    // Paging quickly must not let an older page's response replace the current one.
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
    <section aria-labelledby="credit-history-heading" className="space-y-4 rounded-lg border bg-card p-6">
      <h2 id="credit-history-heading" className="text-lg font-semibold">
        Credit history
      </h2>

      {error ? (
        <p className="text-sm text-muted-foreground">{error}</p>
      ) : !result ? (
        <div aria-hidden="true" className="h-32 rounded-md bg-muted motion-safe:animate-pulse" />
      ) : result.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No credit activity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(transaction.createdAt), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {TYPE_LABELS[transaction.type] ?? transaction.type}
                    </span>
                    {transaction.description && (
                      <span className="block text-xs text-muted-foreground">
                        {transaction.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {transaction.userName ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      transaction.amount < 0 ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{transaction.balance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {result && result.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
    </section>
  );
}
