import * as React from "react"

import { cn } from "@/lib/utils/index"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border-2 border-ink bg-card px-3 py-1 text-base transition-[color,box-shadow,border-color] outline-none shadow-[3px_3px_0_hsl(var(--offset))] selection:bg-highlight selection:text-highlight-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:shadow-[3px_3px_0_hsl(var(--highlight))]",
        "aria-invalid:border-destructive aria-invalid:shadow-[3px_3px_0_hsl(var(--destructive))]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
