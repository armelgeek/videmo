"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { LayoutGrid, Film, Plus, X, FolderPlus, Folder } from "lucide-react";
import { LogoIcon } from "@/lib/editor/components/icons";
import { UserMenu } from "@/lib/editor/components/user-menu";
import { useSession } from "@/lib/auth-client";

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
  {
    id: "storyboard",
    href: "/storyboard",
    icon: LayoutGrid,
    label: "Storyboard",
  },
  {
    id: "studio",
    href: "/timeline",
    icon: Film,
    label: "Video Timeline",
  },
] as const;

const RECENT_PROJECTS = [
  { id: 1, name: "Summer Campaign", updated: "1m", status: "Created" },
  { id: 2, name: "Product Launch", updated: "2h", status: "In Progress" },
  { id: 3, name: "Brand Refresh", updated: "5h", status: "In Review" },
];

export function AppSidebar({
  activeView,
  isPanelOpen,
  onViewChange,
  onTogglePanel,
}: AppSidebarProps) {
  const pathname = usePathname();
  const isStudioPage = pathname === "/timeline";
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [issuesCount, setIssuesCount] = useState(2);
  const [showIssues, setShowIssues] = useState(true);
  const [activeMenu, setActiveMenu] = useState<"new-project" | "workspace">(
    "new-project",
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const getNavItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col bg-neutral-950 h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3 flex-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 flex-shrink-0">
            <LogoIcon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-100">Studio</span>
        </Link>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-violet-500 flex-shrink-0" />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-2">
        {/* Menu Items */}
        <div className="space-y-2 mb-6">
          {/* New Project */}
          <Link
            href="/storyboard"
            className={cn(
              "w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors border",
              pathname === "/storyboard"
                ? "bg-gradient-to-r from-rose-500/20 to-violet-500/20 border-rose-500/30 text-white"
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white",
            )}
          >
            <FolderPlus className="w-4 h-4" />
            New Project
          </Link>

          {/* Workspace */}
          <Link
            href="/workspace"
            className={cn(
              "w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
              pathname === "/workspace"
                ? "bg-gradient-to-r from-rose-500/20 to-violet-500/20 border-rose-500/30 text-white"
                : "",
            )}
          >
            <Folder className="w-4 h-4" />
            Workspace
          </Link>
        </div>

        {/* Recent Projects Section */}
        {/* <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between px-3 mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase">
              Recent Projects
            </span>
            <span className="text-xs text-gray-600">
              {RECENT_PROJECTS.length}
            </span>
          </div>
          <div className="space-y-1">
            {RECENT_PROJECTS.map((project) => (
              <div
                key={project.id}
                className="px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <p className="text-sm font-semibold text-gray-100">
                  {project.name}
                </p>
                <p className="text-xs text-gray-400">
                  {project.updated} · {project.status}
                </p>
              </div>
            ))}
          </div>
        </div>*/}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-3 space-y-3">
        {/* Issues Badge */}
        {showIssues && issuesCount > 0 && (
          <div className="flex items-center justify-between bg-white/5 rounded-full px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-white">N</span>
              </div>
              <span className="text-xs font-medium text-red-400">
                {issuesCount} Issues
              </span>
            </div>
            <button
              onClick={() => setShowIssues(false)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* User Profile */}
        {mounted && session?.user && (
          <div className="flex items-center gap-2">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-gray-300">
                  {(
                    session.user.name?.[0] ||
                    session.user.email?.[0] ||
                    "U"
                  ).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-100 truncate">
                {session.user.name || session.user.email}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {session.user.email}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default AppSidebar;
