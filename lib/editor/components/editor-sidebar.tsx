"use client";

import { cn } from "@/lib/utils";
import type React from "react";
import { memo } from "react";
import { GridIcon, InfoIcon, StoryboardIcon, LogoIcon, WhiteboardIcon } from "./icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SidebarView =
  | "library"
  | "inspector"
  | "storyboard"
  | "create"
  | "settings"
  | "transitions"
  | "whiteboard";

export interface EditorSidebarProps {
  activeView: SidebarView;
  isPanelOpen: boolean;
  onViewChange: (view: SidebarView) => void;
  onTogglePanel: () => void;
  onBack: () => void;
}

const SIDEBAR_ITEMS: {
  id: SidebarView;
  icon: React.FC<{ className?: string }>;
  label: string;
  shortcut?: string;
}[] = [
  {
    id: "library",
    icon: GridIcon,
    label: "Library",
    shortcut: "1",
  },
  {
    id: "inspector",
    icon: InfoIcon,
    label: "Inspector",
    shortcut: "2",
  },
  {
    id: "storyboard",
    icon: StoryboardIcon,
    label: "Storyboard",
    shortcut: "3",
  },
  {
    id: "whiteboard",
    icon: WhiteboardIcon,
    label: "Whiteboard",
    shortcut: "4",
  },
];

export const EditorSidebar = memo(function EditorSidebar({
  activeView,
  isPanelOpen,
  onViewChange,
  onTogglePanel,
  onBack,
}: EditorSidebarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <nav className="flex flex-col items-center w-[66px] shrink-0 h-full border-r border-[var(--border-default)] bg-[var(--surface-0)] z-10">
        {/* Logo */}
        <div className="flex items-center justify-center h-12 w-full border-b border-[var(--border-default)] shrink-0">
          <a href="/" className="flex items-center justify-center p-2">
            <LogoIcon className="h-6 w-6 shrink-0" />
          </a>
        </div>

        {/* Nav items */}
        <div className="flex flex-col items-center gap-1 p-2 flex-1 pt-3">
          {SIDEBAR_ITEMS.map(({ id, icon: Icon, label, shortcut }) => {
            const isActive = activeView === id && isPanelOpen;
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (activeView === id) {
                        onTogglePanel();
                      } else {
                        onViewChange(id);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-[3px] w-full rounded-md p-2 transition-colors group/item text-[10px] leading-tight font-medium",
                      isActive
                        ? "bg-[var(--hover-overlay)] text-primary"
                        : "text-[var(--text-tertiary)] hover:bg-[var(--hover-overlay)] hover:text-primary/70",
                    )}
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>
                    {label}
                    {shortcut && (
                      <span className="ml-2 text-[var(--text-muted)]">
                        ({shortcut})
                      </span>
                    )}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Footer */}
        <div className="w-full border-t border-[var(--border-default)] p-2 text-center">
          <span className="text-[10px] text-[var(--text-muted)]">
            <span className="font-semibold text-foreground">∞</span>
          </span>
        </div>
      </nav>
    </TooltipProvider>
  );
});

export default EditorSidebar;
