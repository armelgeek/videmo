"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image, LayoutTemplate, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/workspace/brand", icon: Image, label: "Logo" },
  { href: "/workspace/brand/formats", icon: LayoutTemplate, label: "Formats" },
  { href: "/workspace/brand/styles", icon: Palette, label: "Styles" },
] as const;

/**
 * The three parts of the brand kit, in one place.
 *
 * Rendered by the three screens rather than by a shared layout, because the
 * editors sit under the same routes and a tab bar above a form being saved
 * would be one context too many.
 */
export function BrandTabs() {
  const pathname = usePathname();

  return (
    <nav
      data-tour="brand-tabs"
      aria-label="Brand kit"
      className="flex gap-1 border-b border-border px-6 pt-4 sm:px-8"
    >
      {TABS.map(({ href, icon: Icon, label }) => {
        // The logo tab is the index, so it must not light up for its children.
        const isActive = href === "/workspace/brand" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 rounded-t-lg border-2 border-b-0 px-4 py-2 text-sm font-semibold transition-colors",
              isActive
                ? "border-ink bg-card text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
