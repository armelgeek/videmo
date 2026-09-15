"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Plus, X, List, Grid3X3 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { ORGANIZATION_CHANGED_EVENT } from "@/lib/app-shell/organization-events";
import { VideoProjectDialog } from "@/components/molecules/forms/video-project-dialog";
import { OrganizationNameEditor } from "@/components/molecules/workspace/organization-name-editor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProjectCard } from "./project-card";
import { WorkspaceControls } from "./workspace-controls";
import { ProjectListView } from "./project-list-view";
import { SketchHint } from "@/components/molecules/sketch-hint";
import { StatsOverview } from "./stats-overview";
import { WorkspaceToolbar } from "./workspace-toolbar";
import type { ProjectListItem, ProjectListResponse } from "./types";
import { NotebookBackground } from "./notebook-background";

export function WorkspaceView() {
  const [response, setResponse] = useState<ProjectListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<ProjectListItem | null>(null);
  const [deleting, setDeleting] = useState<ProjectListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "a-z" | "z-a">(
    "recent",
  );
  const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all");
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setIsFetching(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);

    const res = await api.get<ProjectListResponse>(
      `/api/video-projects?${params}`,
    );
    if (seq !== requestSeq.current) return;

    setIsFetching(false);
    if (!res.ok) {
      setError(res.error ?? "Projects could not be loaded.");
      return;
    }
    setError(null);
    // Deleting the last project of a page empties it: step back instead.
    if (res.data.data.length === 0 && page > 1) {
      setPage(page - 1);
      return;
    }
    setResponse(res.data);
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onChange = () => {
      setResponse(null);
      setPage(1);
      load();
    };
    window.addEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
    return () =>
      window.removeEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
  }, [load]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setIsDeleting(true);
    const res = await api.delete(`/api/video-projects/${deleting.id}`);
    setIsDeleting(false);
    if (!res.ok) {
      toast.error(
        res.error === "Project is being edited"
          ? "Someone is editing this project. Try again once they close it."
          : (res.error ?? "Project could not be deleted."),
      );
      return;
    }
    toast.success(`Deleted "${deleting.title}"`);
    setDeleting(null);
    load();
  };

  const projects = response?.data ?? [];
  // Not exported yet; counted on the loaded page only, the list API has no aggregate.
  const projectsInProgress = projects.filter((p) => !p.latestExport).length;
  const viewer = response?.viewer;
  const isInitialLoad = !response && isFetching;

  return (
    <div className="flex min-h-screen flex-col relative">
      <NotebookBackground />
      <header className="border-b border-border/50 relative z-10">
        <div className="px-8 sm:px-12 py-3">
          {/* Org name */}
          {response?.organization && (
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-1">
              {response.organization.name}
            </p>
          )}
          {/* Title + Actions */}
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold text-foreground whitespace-nowrap">
              <span className="sk-marker">Workspace</span>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage your projects
              </p>
            </h1>

            {/* Will be moved to toolbar below */}
          </div>
        </div>
      </header>

      <div className="flex-1 px-6 py-6 sm:px-8 relative z-10">
        <div>
          {error && !response ? (
            <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-border bg-card px-6 py-14 text-center">
              <AlertCircle className="h-6 w-6 text-foreground" />
              <p className="mt-3 font-medium text-foreground">
                Projects could not be loaded
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <button
                type="button"
                onClick={load}
                className="mt-5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Try again
              </button>
            </div>
          ) : isInitialLoad ? (
            <ProjectGridSkeleton />
          ) : projects.length === 0 ? (
            search ? (
              <div className="rounded-lg border-2 border-dashed border-border bg-card px-6 py-14 text-center">
                <p className="font-medium text-foreground">
                  No project matches "{search}"
                </p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-3 text-sm font-medium text-foreground hover:text-foreground"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <EmptyWorkspace canCreate={viewer?.canCreate ?? false} />
            )
          ) : (
            <>
              <StatsOverview
                totalProjects={response?.total ?? 0}
                projectsInProgress={projectsInProgress}
                teamMembers={1}
              />

              <div className="flex items-center justify-between gap-4 py-4 mb-5 border-b border-border">
                <h2 className="text-lg font-semibold">Projects</h2>
                <WorkspaceControls
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  timeFilter={timeFilter}
                  onTimeFilterChange={setTimeFilter}
                />
              </div>

              {viewMode === "grid" ? (
                <div>
                  <div
                    className={`grid grid-cols-1 gap-8 transition-opacity sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 ${isFetching ? "opacity-60" : ""}`}
                  >
                    {projects.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        canUpdate={viewer?.canUpdate ?? false}
                        canDelete={viewer?.canDelete ?? false}
                        onRename={setRenaming}
                        onDelete={setDeleting}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <ProjectListView
                  projects={projects}
                  canUpdate={viewer?.canUpdate ?? false}
                  canDelete={viewer?.canDelete ?? false}
                  onRename={setRenaming}
                  onDelete={setDeleting}
                />
              )}

              {response && response.totalPages > 1 && (
                <nav
                  className="mt-8 flex items-center justify-between gap-3"
                  aria-label="Pagination"
                >
                  <p className="text-xs text-muted-foreground">
                    Page {response.page} of {response.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <PageButton
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </PageButton>
                    <PageButton
                      disabled={page >= response.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </PageButton>
                  </div>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {renaming && (
        <VideoProjectDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          projectId={renaming.id}
          initialTitle={renaming.title}
          onDone={load}
        />
      )}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The project and its storyboard leave this workspace for everyone
              in it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Keep project
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              className="border-2 border-ink bg-highlight text-highlight-foreground hover:bg-highlight"
            >
              {isDeleting ? "Deleting…" : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PageButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-full border-2 border-ink bg-card px-4 py-1.5 text-sm font-semibold text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
    />
  );
}

function EmptyWorkspace({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="relative flex h-24 w-40 -rotate-2 items-center justify-center rounded-md border-2 border-ink bg-white shadow-[4px_4px_0_hsl(var(--offset))]">
        <span className="sk-tape" aria-hidden="true" />
        <Plus className="h-6 w-6 text-neutral-400" />
      </div>
      <p className="mt-6 font-display text-xl font-extrabold text-foreground">
        Your workspace is empty
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Start from an idea: write a prompt, get a storyboard, then animate it on
        the whiteboard.
      </p>
      {canCreate && (
        <SketchHint direction="down" className="mt-6">
          start here, your first video takes a few minutes
        </SketchHint>
      )}
      {canCreate && (
        <Link
          href="/new-project"
          className="mt-2 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-highlight px-5 py-2.5 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition hover:shadow-lg hover:shadow-[4px_4px_0_hsl(var(--offset))] focus-visible:ring-2 focus-visible:ring-highlight"
        >
          <Plus className="h-4 w-4" />
          Create your first project
        </Link>
      )}
    </div>
  );
}

function ProjectGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      aria-busy="true"
    >
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-border bg-card"
        >
          <div className="aspect-video bg-accent motion-safe:animate-pulse" />
          <div className="flex flex-col gap-3 p-5">
            <div className="h-4 w-2/3 rounded bg-accent motion-safe:animate-pulse" />
            <div className="h-2 w-1/3 rounded bg-accent/50 motion-safe:animate-pulse" />
            <div className="flex gap-2 pt-1">
              <div className="h-1.5 w-1/3 rounded-full bg-accent/40 motion-safe:animate-pulse" />
              <div className="h-1.5 w-1/3 rounded-full bg-accent/40 motion-safe:animate-pulse" />
              <div className="h-1.5 w-1/3 rounded-full bg-accent/40 motion-safe:animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
