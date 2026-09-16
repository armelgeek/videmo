import { Skeleton } from "@/components/ui/skeleton";

export function BillingPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-6 sm:px-12">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-xl border-2 border-border bg-card p-6 sm:p-8">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-2 border-t border-border pt-5">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>

        <div className="space-y-6 rounded-xl border-2 border-border bg-card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-10 w-28" />
            </div>
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="space-y-4 border-t border-border pt-6">
            <Skeleton className="h-4 w-24" />
            {[0, 1, 2].map((row) => (
              <div key={row} className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card px-5 py-4">
        <Skeleton className="h-5 w-32" />
      </div>
    </div>
  );
}
