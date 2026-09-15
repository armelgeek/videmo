import Link from "next/link";
import { format } from "date-fns";
import { MoreVertical } from "lucide-react";
import { ProjectThumbnail } from "./project-thumbnail";
import type { ProjectListItem } from "./types";

interface ProjectListViewProps {
  projects: ProjectListItem[];
  canUpdate: boolean;
  canDelete: boolean;
  onRename: (project: ProjectListItem) => void;
  onDelete: (project: ProjectListItem) => void;
}

export function ProjectListView({
  projects,
  canUpdate,
  canDelete,
  onRename,
  onDelete,
}: ProjectListViewProps) {
  return (
    <div className="overflow-x-auto px-4 sm:px-6">
      <table className="w-full text-sm">
        <thead className="border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-foreground">Project</th>
            <th className="px-4 py-3 text-left font-semibold text-foreground">Created</th>
            <th className="px-4 py-3 text-left font-semibold text-foreground">Modified</th>
            {(canUpdate || canDelete) && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((project) => (
            <tr key={project.id} className="hover:bg-accent/50 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/storyboard?project=${project.id}`}
                  className="flex items-center gap-3 group hover:text-foreground"
                >
                  <ProjectThumbnail
                    compact
                    previewUrl={project.previewUrl}
                    aspectRatio={project.aspectRatio}
                    className="w-12 h-7 shrink-0 rounded border border-border"
                  />
                  <span className="font-medium text-foreground group-hover:underline">
                    {project.title}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {format(new Date(project.createdAt), "MMM d, yyyy")}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {format(new Date(project.updatedAt), "MMM d, yyyy")}
              </td>
              {(canUpdate || canDelete) && (
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (canUpdate) onRename(project);
                    }}
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
