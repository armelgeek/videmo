"use client";

import { List, Grid3X3, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WorkspaceControlsProps {
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  sortBy: "recent" | "oldest" | "a-z" | "z-a";
  onSortChange: (sort: "recent" | "oldest" | "a-z" | "z-a") => void;
  timeFilter: "all" | "week" | "month";
  onTimeFilterChange: (filter: "all" | "week" | "month") => void;
}

export function WorkspaceControls({
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  timeFilter,
  onTimeFilterChange,
}: WorkspaceControlsProps) {
  const sortLabels = {
    recent: "Most recent",
    oldest: "Oldest first",
    "a-z": "A to Z",
    "z-a": "Z to A",
  };

  const filterLabels = {
    all: "All time",
    week: "Last week",
    month: "Last month",
  };

  return (
    <div className="flex items-center gap-2">
      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg border-2 border-border px-3 py-2 text-sm font-medium text-foreground hover:border-ink transition-all">
            {sortLabels[sortBy]}
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onSortChange("recent")}>
            Most recent
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("oldest")}>
            Oldest first
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("a-z")}>
            A to Z
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("z-a")}>
            Z to A
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Time Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg border-2 border-border px-3 py-2 text-sm font-medium text-foreground hover:border-ink transition-all">
            {filterLabels[timeFilter]}
            <ChevronDown className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onTimeFilterChange("all")}>
            All time
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onTimeFilterChange("week")}>
            Last week
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onTimeFilterChange("month")}>
            Last month
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Mode Toggle */}
      <div className="flex gap-1 rounded-lg border-2 border-border p-1">
        <button
          onClick={() => onViewModeChange("grid")}
          className={`p-2 rounded transition-all ${
            viewMode === "grid"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Grid view"
          title="Grid view"
        >
          <Grid3X3 className="h-4 w-4" />
        </button>
        <button
          onClick={() => onViewModeChange("list")}
          className={`p-2 rounded transition-all ${
            viewMode === "list"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="List view"
          title="List view"
        >
          <List className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
