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
    <article className="group relative rounded-xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20 hover:bg-white/[0.06]">
      <Link
        href={`/storyboard?project=${project.id}`}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-rose-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
      >
        <ProjectThumbnail
          previewUrl={project.previewUrl}
          aspectRatio={project.aspectRatio}
          className="rounded-t-xl border-b border-white/10"
        >
          {editedBy && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-neutral-950/80 px-2 py-1 text-[11px] font-medium text-amber-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 motion-safe:animate-pulse" />
              {editedBy} is editing
            </span>
          )}
          <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 text-[11px] font-medium">
            <span className="rounded-md bg-neutral-950/75 px-1.5 py-0.5 text-gray-300 backdrop-blur">
              {project.aspectRatio}
            </span>
            {project.sceneCount > 0 && (
              <span className="rounded-md bg-neutral-950/75 px-1.5 py-0.5 text-gray-300 backdrop-blur">
                {project.sceneCount} {project.sceneCount === 1 ? "scene" : "scenes"}
              </span>
            )}
          </div>
        </ProjectThumbnail>

        <div className="space-y-3 p-4">
          <div className="pr-8">
            <h3 className="truncate text-sm font-semibold text-gray-100">{project.title}</h3>
            <p className="mt-1 truncate text-xs text-gray-500">
              Edited {formatDistanceToNowStrict(new Date(project.updatedAt), { addSuffix: true })}
              {project.createdBy ? ` · ${project.createdBy.name}` : ""}
            </p>
          </div>

          <div>
            <div className="flex gap-1" aria-hidden>
              {STEPS.map((step, index) => (
                <span
                  key={step.id}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    index <= stepIndex ? "bg-gradient-to-r from-rose-500 to-violet-500" : "bg-white/10",
                  )}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500">
              <span className="text-gray-300">{STEPS[stepIndex].label}</span> · step {stepIndex + 1} of{" "}
              {STEPS.length}
            </p>
          </div>
        </div>
      </Link>

      {(canUpdate || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${project.title}`}
            className="absolute right-2 top-[calc(56.25%+0.75rem)] flex h-8 w-8 items-center justify-center rounded-md text-gray-400 outline-none transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-rose-500/70 data-[state=open]:bg-white/10 data-[state=open]:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 border-white/10 bg-neutral-900 text-gray-100">
            {canUpdate && (
              <DropdownMenuItem onSelect={() => onRename(project)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
            )}
            {canUpdate && canDelete && <DropdownMenuSeparator className="bg-white/10" />}
            {canDelete && (
              <DropdownMenuItem
                onSelect={() => onDelete(project)}
                className="text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
              >
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
