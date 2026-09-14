"use client";

import type * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Home,
  ImageIcon,
  LayoutGrid,
  Film,
  Settings,
  PlusSquare,
  Layers,
  SlidersHorizontal,
  Info,
  Gauge,
  Users,
  Shield,
  KeyRound,
  Building2,
  FileText,
} from "lucide-react";
import { LogoIcon } from "@/lib/editor/components/icons";
import { UserMenu } from "@/lib/editor/components/user-menu";

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
  grantedPermissions?: string[];
}

const ADMIN_ITEMS = [
  { href: "/dashboard", icon: Gauge, label: "Dashboard", permission: null },
  { href: "/users", icon: Users, label: "Users", permission: "user:read" },
  { href: "/roles", icon: Shield, label: "Roles", permission: "role:read" },
  { href: "/permissions", icon: KeyRound, label: "Permissions", permission: "permission:read" },
  { href: "/organizations", icon: Building2, label: "Organizations", permission: null },
  { href: "/blogs", icon: FileText, label: "Blog", permission: "blog:read" },
  { href: "/settings", icon: Settings, label: "Settings", permission: "setting:read" },
] as const;

const NAV_ITEMS = [
  {
    id: "home",
    href: "/",
    icon: Home,
    label: "Home",
  },
  {
    id: "image-playground",
    href: "/image-playground",
    icon: ImageIcon,
    label: "Image Playground",
  },
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

const STUDIO_ITEMS: {
  id: SidebarView;
  icon: React.FC<{ className?: string }>;
  label: string;
}[] = [
  {
    id: "create",
    icon: PlusSquare,
    label: "Create",
  },
  {
    id: "library",
    icon: Layers,
    label: "Library",
  },
  {
    id: "storyboard",
    icon: LayoutGrid,
    label: "Storyboard",
  },
  {
    id: "transitions",
    icon: SlidersHorizontal,
    label: "Transitions",
  },
  {
    id: "inspector",
    icon: Info,
    label: "Inspector",
  },
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
  },
];

export function AppSidebar({
  activeView,
  isPanelOpen,
  onViewChange,
  onTogglePanel,
  grantedPermissions,
}: AppSidebarProps) {
  const pathname = usePathname();
  const adminItems = grantedPermissions
    ? ADMIN_ITEMS.filter((item) => !item.permission || grantedPermissions.includes(item.permission))
    : [];
  const isStudioPage = pathname === "/timeline";

  const getNavItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col border-r border-white/10 bg-background/80 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 flex-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 transition-colors">
            <LogoIcon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Studio</span>
        </Link>
        <UserMenu />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = getNavItemActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {adminItems.length > 0 && (
          <>
            <div className="my-4 h-px bg-white/5" />
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Administration
            </p>
            <div className="space-y-1">
              {adminItems.map((item) => {
                const isActive = getNavItemActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-muted-foreground hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Studio-specific items */}
        {isStudioPage && onViewChange && onTogglePanel && (
          <>
            <div className="my-4 h-px bg-white/5" />
            <div className="space-y-1">
              {STUDIO_ITEMS.map((item) => {
                const isActive = activeView === item.id && isPanelOpen;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (activeView === item.id) {
                        onTogglePanel();
                      } else {
                        onViewChange(item.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-muted-foreground hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 px-3 py-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">v1.0</p>
        </div>
      </div>
    </aside>
  );
}

export default AppSidebar;
