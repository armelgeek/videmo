import { Skeleton } from "@/components/ui/skeleton";

export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 border-r-2 border-border bg-background/80 p-4 space-y-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-24" />
        </div>

        {/* Org Switcher */}
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />

        {/* Nav Items */}
        <div className="space-y-2 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`nav-${i}`} className="h-10 w-full rounded-lg" />
          ))}
        </div>

        {/* Space filler */}
        <div className="flex-1" />

        {/* Credit Badge */}
        <Skeleton className="h-12 w-full rounded-lg" />

        {/* User Profile */}
        <Skeleton className="h-14 w-full rounded-lg" />
      </aside>

      {/* Main Content */}
      <main className="ml-64 min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border p-6 space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`content-${i}`} className="space-y-4 rounded-lg border border-border p-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="pt-2 flex gap-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
