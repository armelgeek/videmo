"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Folder, FolderPlus, Mail, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client";
import { LogoIcon } from "@/lib/editor/components/icons";
import { authClient, useSession } from "@/lib/auth-client";
import { ProjectThumbnail } from "@/components/organisms/workspace/project-thumbnail";
import type { ProjectListResponse } from "@/components/organisms/workspace/types";
import { OrganizationSwitcher } from "./organization-switcher";
import { ORGANIZATION_CHANGED_EVENT } from "./organization-events";

export type SidebarView =
  | "library"
  | "create"
  | "settings"
  | "transitions"
  | "inspector"
  | "storyboard";

interface AppSidebarProps {
  activeView?: SidebarView;
  isPanelOpen?: boolean;
  onViewChange?: (view: SidebarView) => void;
  onTogglePanel?: () => void;
}

const NAV_ITEMS = [
  { href: "/new-project", icon: FolderPlus, label: "New project" },
  { href: "/workspace", icon: Folder, label: "Projects" },
  { href: "/workspace/members", icon: Users, label: "Members" },
] as const;

interface PendingInvitation {
  id: string;
  status: string;
  expiresAt: string | Date;
  organizationName?: string;
}

function usePendingInvitations(pathname: string) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);

  useEffect(() => {
    authClient.organization.listUserInvitations().then(({ data }) => {
      const now = new Date();
      setInvitations(
        ((data ?? []) as unknown as PendingInvitation[]).filter(
          (invitation) => invitation.status === "pending" && new Date(invitation.expiresAt) > now,
        ),
      );
    });
  }, [pathname]);

  return invitations;
}

function useRecentProjects(pathname: string) {
  const [projects, setProjects] = useState<ProjectListResponse["data"] | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<ProjectListResponse>("/api/video-projects?limit=5");
    setProjects(res.ok ? res.data.data : []);
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    window.addEventListener(ORGANIZATION_CHANGED_EVENT, load);
    return () => window.removeEventListener(ORGANIZATION_CHANGED_EVENT, load);
  }, [load]);

  return projects;
}

export function AppSidebar(_props: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openProjectId = searchParams.get("project");
  const { data: session } = useSession();
  const recentProjects = useRecentProjects(pathname);
  const pendingInvitations = usePendingInvitations(pathname);

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-hidden border-r border-border bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <Link href="/" className="flex flex-1 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
            <LogoIcon className="h-4 w-4 text-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground">Studio</span>
        </Link>
      </div>

      <div className="border-b border-border px-2 py-2">
        <OrganizationSwitcher />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-highlight",
                  isActive
                    ? "border-ink bg-gradient-to-r from-highlight/25 to-highlight/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>

        {pendingInvitations.length > 0 && (
          <section aria-labelledby="pending-invitations">
            <h2
              id="pending-invitations"
              className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Invitations
            </h2>
            <ul className="space-y-1">
              {pendingInvitations.map((invitation) => (
                <li key={invitation.id}>
                  <Link
                    href={`/invite/${invitation.id}`}
                    className="flex items-center gap-3 rounded-lg border border-ink bg-highlight/15 p-2 outline-none transition-colors hover:bg-highlight/15 focus-visible:ring-2 focus-visible:ring-highlight"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-highlight/20 text-foreground">
                      <Mail className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">
                        {invitation.organizationName ?? "An organization"}
                      </span>
                      <span className="block text-xs text-foreground">Review invitation</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="recent-projects">
          <h2
            id="recent-projects"
            className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Recent
          </h2>
          {recentProjects === null ? (
            <div className="space-y-1 px-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="h-7 w-12 rounded bg-card motion-safe:animate-pulse" />
                  <div className="h-3 flex-1 rounded bg-card motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <p className="px-3 text-xs text-muted-foreground">Projects you open show up here.</p>
          ) : (
            <ul className="space-y-0.5">
              {recentProjects.map((project) => {
                const isOpen = openProjectId === project.id;
                return (
                  <li key={project.id}>
                    <Link
                      href={`/storyboard?project=${project.id}`}
                      aria-current={isOpen ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg p-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-highlight",
                        isOpen ? "bg-accent" : "hover:bg-accent",
                      )}
                    >
                      <ProjectThumbnail
                        compact
                        previewUrl={project.previewUrl}
                        aspectRatio={project.aspectRatio}
                        className="w-12 shrink-0 rounded ring-1 ring-border"
                      />
                      <span className="min-w-0 truncate text-sm text-foreground group-hover:text-foreground">
                        {project.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </nav>

      {session?.user && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-3">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt=""
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <span className="text-xs font-bold text-foreground">
                {(session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {session.user.name || session.user.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
          </div>
        </div>
      )}
    </aside>
  );
}

export default AppSidebar;
