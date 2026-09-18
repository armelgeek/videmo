"use client";

import React from "react";
import { Hint } from "@/components/molecules/hint";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, children, ...props }: IconButtonProps) {
  return (
    <Hint label={label}>
      <button
        type="button"
        aria-label={label}
        {...props}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-highlight disabled:opacity-40"
      >
        {children}
      </button>
    </Hint>
  );
}
