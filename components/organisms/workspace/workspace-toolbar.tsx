"use client";

import Link from "next/link";
import { Plus, X, Loader2 } from "lucide-react";
import { WorkspaceControls } from "./workspace-controls";

interface WorkspaceToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  isFetching: boolean;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  sortBy: "recent" | "oldest" | "a-z" | "z-a";
  onSortChange: (sort: "recent" | "oldest" | "a-z" | "z-a") => void;
  timeFilter: "all" | "week" | "month";
  onTimeFilterChange: (filter: "all" | "week" | "month") => void;
  canCreate?: boolean;
}

export function WorkspaceToolbar({
  query,
  onQueryChange,
  isFetching,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  timeFilter,
  onTimeFilterChange,
  canCreate = true,
}: WorkspaceToolbarProps) {
  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 py-4 border-b border-border">
      {/* Search Row */}
      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search projects..."
            className="h-9 w-full rounded-lg border-2 border-border px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition hover:border-ink focus:border-ink focus:shadow-[2px_2px_0_hsl(var(--offset))]"
          />
          {isFetching ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </label>
        {canCreate && (
          <Link
            href="/new-project"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            New project
          </Link>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">Projects</h2>
        <WorkspaceControls
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          sortBy={sortBy}
          onSortChange={onSortChange}
          timeFilter={timeFilter}
          onTimeFilterChange={onTimeFilterChange}
        />
      </div>
    </div>
  );
}
