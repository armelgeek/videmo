import { BarChart3, Users, Zap } from "lucide-react";

interface StatsOverviewProps {
  totalProjects: number;
  projectsInProgress: number;
  teamMembers: number;
}

export function StatsOverview({ totalProjects, projectsInProgress, teamMembers }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 py-4">
      <div className="rounded-lg border-2 border-border bg-card p-4 shadow-[3px_3px_0_hsl(var(--offset))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Total Projects</p>
            <p className="text-3xl font-bold text-foreground mt-1">{totalProjects}</p>
          </div>
          <BarChart3 className="h-8 w-8 text-muted-foreground opacity-50" />
        </div>
      </div>

      <div className="rounded-lg border-2 border-border bg-card p-4 shadow-[3px_3px_0_hsl(var(--offset))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">In Progress</p>
            <p className="text-3xl font-bold text-foreground mt-1">{projectsInProgress}</p>
          </div>
          <Zap className="h-8 w-8 text-muted-foreground opacity-50" />
        </div>
      </div>

      <div className="rounded-lg border-2 border-border bg-card p-4 shadow-[3px_3px_0_hsl(var(--offset))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Team Members</p>
            <p className="text-3xl font-bold text-foreground mt-1">{teamMembers}</p>
          </div>
          <Users className="h-8 w-8 text-muted-foreground opacity-50" />
        </div>
      </div>
    </div>
  );
}
