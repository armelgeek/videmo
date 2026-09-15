"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { MoreHorizontal, Pencil, Play, Trash2 } from "lucide-react";
import { VideoPreviewDialog } from "@/components/molecules/video-preview-dialog";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/molecules/hint";
import { ProjectThumbnail } from "./project-thumbnail";
import type { ProjectListItem, ProjectStep } from "./types";

const STEPS: { id: ProjectStep; label: string }[] = [
  { id: "prompt", label: "Script" },
  { id: "storyboard", label: "Storyboard" },
  { id: "whiteboard", label: "Animation" },
];

interface ProjectCardProps {
  project: ProjectListItem;
  canUpdate: boolean;
  canDelete: boolean;
  onRename: (project: ProjectListItem) => void;
  onDelete: (project: ProjectListItem) => void;
}

export function ProjectCard({ project, canUpdate, canDelete, onRename, onDelete }: ProjectCardProps) {
  const stepIndex = Math.max(0, STEPS.findIndex((step) => step.id === project.step));
  const editedBy = project.lock.state === "held-by-other" ? project.lock.by?.name ?? "Someone" : null;

  return (
    <article className="group relative overflow-hidden rounded-lg border-2 border-ink bg-card shadow-[5px_5px_0_hsl(var(--offset))] transition-transform hover:-translate-y-1">
      <Link
        href={`/storyboard?project=${project.id}`}
        className="flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-highlight"
      >
        <div className="aspect-video overflow-hidden border-b border-border bg-white">
          <ProjectThumbnail
            previewUrl={project.previewUrl}
            aspectRatio={project.aspectRatio}
            className="h-full w-full"
          >
            {editedBy && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-highlight px-2 py-1 text-xs font-semibold text-highlight-foreground">
                <span className="h-1 w-1 rounded-full bg-ink motion-safe:animate-pulse" />
                {editedBy}
              </span>
            )}
          </ProjectThumbnail>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-lg text-foreground">{project.title}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {formatDistanceToNowStrict(new Date(project.updatedAt), { addSuffix: true })}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full border border-border bg-accent px-2.5 py-1 text-[11px] font-semibold text-foreground">
              {project.aspectRatio}
            </span>
            {project.sceneCount > 0 && (
              <span className="rounded-full border border-border bg-accent px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {project.sceneCount} scene{project.sceneCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex gap-1 pt-2 border-t border-border/50">
            {STEPS.map((step, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    current && "bg-highlight",
                    done && "bg-foreground",
                    !current && !done && "bg-border"
                  )}
                  title={step.label}
                />
              );
            })}
          </div>
        </div>
      </Link>

      {project.latestExport && (
        <VideoPreviewDialog jobId={project.latestExport.jobId} title={project.title}>
        <button
          type="button"
          aria-label={`Watch the video of ${project.title}`}
          className="absolute right-11 top-2 flex h-7 items-center gap-1.5 rounded-md border-2 border-ink bg-highlight px-2 text-xs font-semibold text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight"
        >
          <Play className="h-3.5 w-3.5" />
          Video
        </button>
        </VideoPreviewDialog>
      )}

      {(canUpdate || canDelete) && (
        <DropdownMenu>
          <Hint label="rename or delete">
            <DropdownMenuTrigger
              aria-label={`Actions for ${project.title}`}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded bg-background/80 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-highlight focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="end" className="w-40">
            {canUpdate && (
              <DropdownMenuItem onSelect={() => onRename(project)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
            )}
            {canUpdate && canDelete && <DropdownMenuSeparator />}
            {canDelete && (
              <DropdownMenuItem onSelect={() => onDelete(project)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </article>
  );
}
