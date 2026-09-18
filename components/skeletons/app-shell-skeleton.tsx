import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebarSkeleton } from "@/lib/app-shell/app-sidebar";

export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AppSidebarSkeleton />

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
