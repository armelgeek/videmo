"use client";

import type { ReactElement, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HintProps {
  /** Short, handwritten explanation of what the button does. */
  label: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** A single focusable element: the tooltip attaches to it, not a wrapper. */
  children: ReactElement;
}

/**
 * Sketch-style hover and focus hint for a button. Carries its own provider so
 * it works on any page without a global one.
 */
export function Hint({ label, side = "top", children }: HintProps) {
  return (
    <TooltipProvider delayDuration={350}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
