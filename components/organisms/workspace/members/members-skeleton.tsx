"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PANEL } from "./types";

export function MembersSkeleton() {
  return (
    <div className="flex min-h-screen flex-col animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4 sm:px-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
        </div>
      </header>

      {/* Main Grid Skeleton */}
      <div className="flex-1 px-6 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Brand Logo Panel Skeleton */}
          <section className={cn(PANEL, "space-y-4")}>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-64" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-24 w-40 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24 rounded-lg" />
                  <Skeleton className="h-9 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          </section>

          {/* People Panel Skeleton */}
          <section className={cn(PANEL, "p-0 overflow-hidden lg:col-span-2")}>
            <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-8 w-full sm:w-64 rounded-md" />
            </div>

            <ul className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, index) => (
                <li key={index} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="size-8 rounded-md" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
