"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface ChipsFieldProps {
  id: string;
  label: string;
  hint: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  /** Offered as one-click toggles above the free entry. */
  suggestions?: string[];
  /** A dot in the suggestion's own colour, for accent colours. */
  swatch?: (value: string) => string | undefined;
}

/**
 * A short list of words — accent colours, drawing vocabulary — entered as
 * chips rather than as a comma-separated line, so what is in the list is
 * countable at a glance and removable one at a time.
 */
export function ChipsField({
  id,
  label,
  hint,
  items,
  onChange,
  placeholder,
  suggestions = [],
  swatch,
}: ChipsFieldProps) {
  const [draft, setDraft] = useState("");

  const add = (value: string) => {
    const word = value.trim();
    // Case-insensitive, because "Blue" and "blue" reach the prompt the same.
    if (!word || items.some((item) => item.toLowerCase() === word.toLowerCase())) return;
    onChange([...items, word]);
  };

  const toggle = (value: string) => {
    const match = items.find((item) => item.toLowerCase() === value.toLowerCase());
    if (match) onChange(items.filter((item) => item !== match));
    else add(value);
  };

  return (
    <div className="grid gap-2">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>

      <ul aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <li className="text-xs italic text-muted-foreground">Nothing yet.</li>
        )}
        {items.map((item) => (
          <li key={item}>
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card py-1 pl-2.5 pr-1 text-xs font-semibold">
              {swatch?.(item) && (
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full border border-ink"
                  style={{ backgroundColor: swatch(item) }}
                />
              )}
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => onChange(items.filter((i) => i !== item))}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => {
            const on = items.some((item) => item.toLowerCase() === suggestion.toLowerCase());
            return (
              <button
                key={suggestion}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(suggestion)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border-2 border-dashed px-2.5 py-1 text-xs font-medium transition-colors",
                  on
                    ? "border-transparent text-muted-foreground/50 line-through"
                    : "border-border text-muted-foreground hover:border-ink hover:text-foreground",
                )}
              >
                {swatch?.(suggestion) && (
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full border border-ink"
                    style={{ backgroundColor: swatch(suggestion) }}
                  />
                )}
                {suggestion}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          id={id}
          aria-label={`Add to ${label.toLowerCase()}`}
          value={draft}
          placeholder={placeholder}
          className="h-9 max-w-56"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter would submit the surrounding form; here it commits a chip.
            if (e.key !== "Enter" && e.key !== ",") return;
            e.preventDefault();
            add(draft);
            setDraft("");
          }}
        />
        <button
          type="button"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          disabled={!draft.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-dashed border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-ink hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
