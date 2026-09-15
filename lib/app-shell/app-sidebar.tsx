"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Folder, Loader2, LogOut, Mail, Plus, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client";
import { appConfig } from "@/lib/config";
import { authClient, signOut, useSession } from "@/lib/auth-client";
import { ProjectThumbnail } from "@/components/organisms/workspace/project-thumbnail";
import type { ProjectListResponse } from "@/components/organisms/workspace/types";
import { CreditBalanceBadge } from "./credit-balance-badge";
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
  { href: "/workspace", icon: Folder, label: "Projects" },
  { href: "/workspace/members", icon: Users, label: "Members" },
  { href: "/billing", icon: CreditCard, label: "Billing" },
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

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="sk-scribble mb-2 px-2 text-base">
      {children}
    </h2>
  );
}

export function AppSidebar(_props: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openProjectId = searchParams.get("project");
  const { data: session } = useSession();
  const recentProjects = useRecentProjects(pathname);
  const pendingInvitations = usePendingInvitations(pathname);
  const isCreating = pathname === "/new-project";
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success("You're signed out.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out failed.");
      setIsSigningOut(false);
    }
  };

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-hidden border-r-2 border-ink bg-background shadow-[4px_0_0_hsl(var(--highlight))]">
      <div className="flex items-center px-4 pb-3 pt-5">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-foreground">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border-2 border-ink bg-highlight" />
          {appConfig.name}
        </Link>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <OrganizationSwitcher />
        <CreditBalanceBadge />
      </div>

      <div className="px-3 pb-4">
        <Link
          href="/new-project"
          aria-current={isCreating ? "page" : undefined}
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight"
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto border-t-2 border-dashed border-border px-3 py-4">
        <div className="space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-sm font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-highlight",
                  isActive
                    ? "border-ink bg-card text-foreground shadow-[3px_3px_0_hsl(var(--offset))]"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {isActive && <span aria-hidden="true" className="ml-auto h-2 w-2 rounded-full bg-highlight ring-2 ring-ink" />}
              </Link>
            );
          })}
        </div>

        {pendingInvitations.length > 0 && (
          <section aria-labelledby="pending-invitations">
            <SectionTitle id="pending-invitations">invitations</SectionTitle>
            <ul className="space-y-1.5">
              {pendingInvitations.map((invitation) => (
                <li key={invitation.id}>
                  <Link
                    href={`/invite/${invitation.id}`}
                    className="flex -rotate-1 items-center gap-3 bg-highlight p-2.5 text-highlight-foreground shadow-[2px_3px_0_hsl(0_0%_0%/0.2)] outline-none transition-transform hover:rotate-0 focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {invitation.organizationName ?? "An organization"}
                      </span>
                      <span className="block text-xs opacity-80">Review invitation →</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="recent-projects">
          <SectionTitle id="recent-projects">recent</SectionTitle>
          {recentProjects === null ? (
            <div className="space-y-1 px-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="h-7 w-12 rounded bg-muted motion-safe:animate-pulse" />
                  <div className="h-3 flex-1 rounded bg-muted motion-safe:animate-pulse" />
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">Projects you open show up here.</p>
          ) : (
            <ul className="space-y-1">
              {recentProjects.map((project) => {
                const isOpen = openProjectId === project.id;
                return (
                  <li key={project.id}>
                    <Link
                      href={`/storyboard?project=${project.id}`}
                      aria-current={isOpen ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg border-2 p-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-highlight",
                        isOpen ? "border-ink bg-card" : "border-transparent hover:border-border",
                      )}
                    >
                      <ProjectThumbnail
                        compact
                        previewUrl={project.previewUrl}
                        aspectRatio={project.aspectRatio}
                        className="w-12 shrink-0 rounded border-[1.5px] border-ink"
                      />
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
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
        <div className="mx-2 mb-2 flex items-stretch gap-2">
        <Link
          href="/profile"
          className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border-2 border-border px-3 py-3 outline-none transition-all hover:border-ink hover:bg-card focus-visible:ring-2 focus-visible:ring-highlight"
        >
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full border-2 border-ink object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-highlight">
              <span className="text-xs font-bold text-highlight-foreground">
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
          <Settings className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:text-foreground" />
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          aria-label="Sign out"
          title="Sign out"
          className="flex w-11 shrink-0 items-center justify-center rounded-lg border-2 border-border text-muted-foreground outline-none transition-all hover:border-ink hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-highlight disabled:opacity-60"
        >
          {isSigningOut ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        </div>
      )}
    </aside>
  );
}

export default AppSidebar;
