import { cn } from "@/lib/utils";
import type { VisualStyle } from "@/lib/storyboard/visual-styles/types";

/**
 * Accent colours are written in the style's own words ("warm orange", "soft
 * green"), which are not CSS colours. Matching on the base word covers every
 * way they have been written so far; anything unrecognised just draws in ink.
 */
export const ACCENT_HEX: Record<string, string> = {
  red: "#e5484d",
  orange: "#f76b15",
  yellow: "#ffb224",
  green: "#30a46c",
  teal: "#12a594",
  blue: "#0091ff",
  purple: "#8e4ec6",
  pink: "#e93d82",
};

function accentOf(style: VisualStyle): string | null {
  for (const written of style.accentColors) {
    const word = written.toLowerCase();
    const match = Object.keys(ACCENT_HEX).find((base) => word.includes(base));
    if (match) return ACCENT_HEX[match];
  }
  return null;
}

/**
 * The line weight the style asks for, read off the art direction.
 *
 * ponytail: a keyword sniff, because a style has no stroke-width field. It
 * reads the words the built-ins and the editor's own examples already use. If
 * previews ever need to be exact, give `VisualStyle` a `strokeWidth` and
 * delete this.
 */
function strokeOf(artDirection: string): number {
  const text = artDirection.toLowerCase();
  if (/\b(bold|thick|chunky|marker|heavy)\b/.test(text)) return 4;
  if (/\b(thin|precise|fine|minimal|uniform|technical)\b/.test(text)) return 1.4;
  return 2.2;
}

/**
 * A sample drawing in the style, so a style is chosen by looking rather than
 * by reading. It is the vocabulary every style shares — a box, an arrow, a
 * subject, an accent mark — drawn the way this one would draw it.
 */
export function StylePreview({ style, className }: { style: VisualStyle; className?: string }) {
  const stroke = strokeOf(style.artDirection);
  const accent = accentOf(style);
  const round = stroke >= 3;

  return (
    <svg
      viewBox="0 0 180 96"
      className={cn("h-full w-full bg-white", className)}
      role="img"
      aria-label={`A sample drawing in the ${style.label} style`}
    >
      <g
        fill="none"
        stroke="#1a1a1a"
        strokeWidth={stroke}
        strokeLinecap={round ? "round" : "butt"}
        strokeLinejoin={round ? "round" : "miter"}
      >
        <rect x="16" y="30" width="42" height="32" rx={round ? 6 : 2} />
        <path d="M62 46h38" />
        <path d="M100 46l-9-6M100 46l-9 6" />
        <circle cx="128" cy="46" r="17" />

        {style.labels !== "none" && (
          <g opacity="0.55" strokeWidth={Math.max(1, stroke - 1)}>
            <path d="M22 74h30" />
            {style.labels === "every-subject" && <path d="M113 74h30" />}
          </g>
        )}

        {accent && (
          <g stroke={accent}>
            <path d="M148 20l4 8 8 1-6 6 2 8-8-4-8 4 2-8-6-6 8-1z" />
          </g>
        )}
      </g>
    </svg>
  );
}
