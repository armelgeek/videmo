"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface LineListFieldProps {
  /** Used for the field's label association and each row's accessible name. */
  id: string;
  label: string;
  hint: string;
  /** Numbered when the order carries meaning, bulleted when it does not. */
  ordered?: boolean;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  addLabel: string;
}

/**
 * A list written one entry at a time, rather than a textarea read line by line.
 *
 * The movements of a script and the rules of a breakdown are lists, and they
 * are what a format actually is — so the field looks like what it produces
 * instead of like every other input on the page.
 */
export function LineListField({
  id,
  label,
  hint,
  ordered = false,
  items,
  onChange,
  placeholder,
  addLabel,
}: LineListFieldProps) {
  const replace = (index: number, value: string) =>
    onChange(items.map((item, i) => (i === index ? value : item)));

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-sm font-medium">
          {label}
        </span>
        <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
          {items.length} {items.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <ul aria-labelledby={`${id}-label`} className="grid gap-1.5">
        {items.map((item, index) => (
          // The index is the identity here: rows are positional, and a row
          // emptied of its text still holds its place until it is removed.
          <li key={index} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "w-6 shrink-0 text-center text-xs font-mono text-muted-foreground",
                !ordered && "text-base leading-none",
              )}
            >
              {ordered ? String(index + 1).padStart(2, "0") : "—"}
            </span>
            <Input
              id={index === 0 ? id : undefined}
              aria-label={`${label} ${index + 1}`}
              value={item}
              placeholder={placeholder}
              onChange={(e) => replace(index, e.target.value)}
              className="h-9 shadow-[2px_2px_0_hsl(var(--offset))]"
            />
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-ink hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>

      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
