"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Plus, Search, X } from "lucide-react";
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
import type { ProjectListItem, ProjectListResponse } from "./types";

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

    const res = await api.get<ProjectListResponse>(`/api/video-projects?${params}`);
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
    return () => window.removeEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
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
          : res.error ?? "Project could not be deleted.",
      );
      return;
    }
    toast.success(`Deleted "${deleting.title}"`);
    setDeleting(null);
    load();
  };

  const projects = response?.data ?? [];
  const viewer = response?.viewer;
  const isInitialLoad = !response && isFetching;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/10 px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {response?.organization ? (
              <OrganizationNameEditor
                organizationId={response.organization.id}
                organizationName={response.organization.name}
                isPersonal={response.organization.isPersonal}
                onUpdated={(newName) => {
                  setResponse((prev) =>
                    prev
                      ? { ...prev, organization: { ...prev.organization, name: newName } }
                      : prev
                  );
                }}
              />
            ) : (
              <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-rose-300/80">
                {" "}
              </p>
            )}
            <h1 className="mt-1 text-3xl font-bold text-white">Projects</h1>
            <p className="mt-1 text-sm text-gray-400">
              {response
                ? `${response.total} ${response.total === 1 ? "project" : "projects"} in this workspace`
                : "Loading projects…"}
            </p>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="relative flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Search projects</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-8 text-sm text-white placeholder:text-gray-500 outline-none transition focus:border-rose-500/50 focus:bg-white/10 [&::-webkit-search-cancel-button]:hidden"
              />
              {isFetching && response ? (
                <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-500" />
              ) : (
                query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </label>
            {viewer?.canCreate !== false && (
              <Link
                href="/new-project"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-rose-500/70"
              >
                <Plus className="h-4 w-4" />
                New project
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          {error && !response ? (
            <div className="flex flex-col items-center rounded-xl border border-rose-500/20 bg-rose-500/5 px-6 py-14 text-center">
              <AlertCircle className="h-6 w-6 text-rose-400" />
              <p className="mt-3 font-medium text-white">Projects could not be loaded</p>
              <p className="mt-1 text-sm text-gray-400">{error}</p>
              <button
                type="button"
                onClick={load}
                className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Try again
              </button>
            </div>
          ) : isInitialLoad ? (
            <ProjectGridSkeleton />
          ) : projects.length === 0 ? (
            search ? (
              <div className="rounded-xl border border-white/10 px-6 py-14 text-center">
                <p className="font-medium text-white">No project matches "{search}"</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-3 text-sm font-medium text-rose-300 hover:text-rose-200"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <EmptyWorkspace canCreate={viewer?.canCreate ?? false} />
            )
          ) : (
            <>
              <div
                className={`grid grid-cols-1 gap-5 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${isFetching ? "opacity-60" : ""}`}
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

              {response && response.totalPages > 1 && (
                <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Pagination">
                  <p className="text-xs text-gray-500">
                    Page {response.page} of {response.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <PageButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The project and its storyboard leave this workspace for everyone in it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Keep project</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              className="bg-rose-600 text-white hover:bg-rose-500"
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
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

function EmptyWorkspace({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-white/15 px-6 py-16 text-center">
      <div
        className="flex h-24 w-40 items-center justify-center rounded-lg bg-[#f4f4ef] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(23,23,23,0.13) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      >
        <Plus className="h-6 w-6 text-neutral-400" />
      </div>
      <p className="mt-6 text-lg font-semibold text-white">Your workspace is empty</p>
      <p className="mt-1 max-w-sm text-sm text-gray-400">
        Start from an idea: write a prompt, get a storyboard, then animate it on the whiteboard.
      </p>
      {canCreate && (
        <Link
          href="/new-project"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white outline-none transition hover:shadow-lg hover:shadow-rose-500/20 focus-visible:ring-2 focus-visible:ring-rose-300"
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
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="aspect-video bg-white/5 motion-safe:animate-pulse" />
          <div className="space-y-3 p-4">
            <div className="h-3.5 w-2/3 rounded bg-white/10 motion-safe:animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-white/5 motion-safe:animate-pulse" />
            <div className="h-1 rounded-full bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
