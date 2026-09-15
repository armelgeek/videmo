import { Skeleton } from "@/components/ui/skeleton";

export function BillingPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50 px-8 py-4 sm:px-12">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      {/* Free plan banner (if applicable) */}
      <div className="px-8 sm:px-12 py-4">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>

      {/* Stats/Overview cards */}
      <div className="px-8 sm:px-12 py-6">
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>

        {/* Credits card */}
        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 space-y-4 rounded-lg border border-border bg-card p-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>

          {/* Usage card */}
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <Skeleton className="h-6 w-32" />
            {[0, 1].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Credit history timeline */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-6">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manage subscription card */}
        <div className="mt-8 space-y-4 rounded-lg border border-border bg-card p-6">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-3 sm:gap-2">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
