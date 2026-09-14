"use client";

import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string; hint?: string };

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="grid gap-1.5 justify-items-start">
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-full border-2 border-ink bg-card p-1">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                on ? "bg-highlight text-highlight-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {current?.hint && <p className="text-xs text-muted-foreground">{current.hint}</p>}
    </div>
  );
}
