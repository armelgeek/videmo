import Link from "next/link";
import { format } from "date-fns";
import { Download, MoreVertical } from "lucide-react";
import { ProjectThumbnail } from "./project-thumbnail";
import type { ProjectListItem } from "./types";

interface ProjectListViewProps {
  projects: ProjectListItem[];
  canUpdate: boolean;
  canDelete: boolean;
  onRename: (project: ProjectListItem) => void;
  onDelete: (project: ProjectListItem) => void;
}

function formatDate(date: any): string {
  try {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return format(d, "MMM d, yyyy");
  } catch {
    return "—";
  }
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
            <th className="px-4 py-3 text-right">Actions</th>
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
                {formatDate(project.createdAt)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(project.updatedAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-3">
                  {project.latestExport && (
                    <a
                      href={`/api/whiteboard/render/${project.latestExport.jobId}/file`}
                      download
                      aria-label={`Download the video of ${project.title}`}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border-2 border-ink bg-highlight px-2 text-xs font-semibold text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Video
                    </a>
                  )}
                  {(canUpdate || canDelete) && (
                    <button
                      type="button"
                      aria-label={`Actions for ${project.title}`}
                      onClick={() => {
                        if (canUpdate) onRename(project);
                      }}
                      className="text-muted-foreground hover:text-foreground transition"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
