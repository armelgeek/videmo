import { BarChart3, Users, Zap } from "lucide-react";

interface StatsOverviewProps {
  totalProjects: number;
  projectsInProgress: number;
  teamMembers: number;
}

export function StatsOverview({ totalProjects, projectsInProgress, teamMembers }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 py-2">
      <div className="rounded-xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_hsl(var(--offset))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Projects</p>
            <p className="text-3xl font-extrabold text-foreground mt-1 tabular-nums">{totalProjects}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_hsl(var(--offset))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In Progress</p>
            <p className="text-3xl font-extrabold text-foreground mt-1 tabular-nums">{projectsInProgress}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <Zap className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-ink bg-card p-4 shadow-[3px_3px_0_hsl(var(--offset))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Members</p>
            <p className="text-3xl font-extrabold text-foreground mt-1 tabular-nums">{teamMembers}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
