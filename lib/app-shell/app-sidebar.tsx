"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Folder, Loader2, LogOut, Mail, Palette, Plus, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { appConfig } from "@/lib/config";
import { authClient, useSession } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditBalanceBadge } from "./credit-balance-badge";
import { OrganizationSwitcher } from "./organization-switcher";
import { useSignOut } from "./use-sign-out";
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

/**
 * What the organization generates against, rather than what it is working on:
 * the logo, the formats and the styles, under the one name people look for.
 */
const LIBRARY_ITEMS = [{ href: "/workspace/brand", icon: Palette, label: "Brand kit" }] as const;

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

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="sk-scribble mb-2 px-2 text-base">
      {children}
    </h2>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
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
}

export function AppSidebar(_props: AppSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const pendingInvitations = usePendingInvitations(pathname);
  const isCreating = pathname === "/new-project";
  const { handleSignOut, isSigningOut } = useSignOut();

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
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} isActive={pathname === item.href} />
          ))}
        </div>

        <section aria-labelledby="library">
          <SectionTitle id="library">brand</SectionTitle>
          <div className="space-y-1">
            {LIBRARY_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              />
            ))}
          </div>
        </section>

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
      </nav>

      <div className="border-t-2 border-dashed border-border px-3 py-3">
        <CreditBalanceBadge />
      </div>

      {session?.user && (
        <div className="mx-2 mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group w-full flex items-center gap-3 rounded-lg border-2 border-border px-3 py-3 outline-none transition-all hover:border-ink hover:bg-card focus-visible:ring-2 focus-visible:ring-highlight">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full border-2 border-ink object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-highlight">
                    <span className="text-sm font-bold text-highlight-foreground">
                      {(session.user.name?.[0] || session.user.email?.[0] || "U").toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {session.user.name || "Account"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
                {isSigningOut ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                    <span>Sign out</span>
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}

export function AppSidebarSkeleton() {
  return (
    <aside className="fixed bottom-0 left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-hidden border-r-2 border-ink bg-background shadow-[4px_0_0_hsl(var(--highlight))]">
      <div className="flex items-center px-4 pb-3 pt-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      <div className="px-3 pb-4">
        <Skeleton className="h-10 w-full rounded-full" />
      </div>

      <nav className="flex-1 space-y-2 border-t-2 border-dashed border-border px-3 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </nav>

      <div className="border-t-2 border-dashed border-border px-3 py-3">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      <div className="mx-2 mb-3">
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    </aside>
  );
}

export default AppSidebar;
