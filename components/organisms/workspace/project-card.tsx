"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <article className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-ink hover:shadow-lg">
      <Link
        href={`/storyboard?project=${project.id}`}
        className="flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-highlight"
      >
        <ProjectThumbnail
          previewUrl={project.previewUrl}
          aspectRatio={project.aspectRatio}
          className="border-b border-border bg-white"
        >
          {editedBy && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-highlight px-2 py-1 text-xs font-semibold text-highlight-foreground">
              <span className="h-1 w-1 rounded-full bg-ink motion-safe:animate-pulse" />
              {editedBy}
            </span>
          )}
        </ProjectThumbnail>

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

      {(canUpdate || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${project.title}`}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded bg-background/80 text-muted-foreground opacity-0 transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-highlight focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
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
