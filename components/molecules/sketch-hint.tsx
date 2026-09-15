import { HandArrow } from "@/components/organisms/landing/sketch/hand-arrow";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right";

// HandArrow only draws right/down curves; the rest is a CSS flip so all four share one stroke.
const ARROW: Record<Direction, { variant: "right" | "down-left" | "down-right"; className: string }> = {
  right: { variant: "right", className: "" },
  left: { variant: "right", className: "-scale-x-100" },
  down: { variant: "down-left", className: "" },
  up: { variant: "down-left", className: "-scale-y-100" },
};

interface SketchHintProps {
  children: React.ReactNode;
  /** Where the arrow points, relative to the note. */
  direction?: Direction;
  className?: string;
}

/**
 * The landing page's "↑ try it with your own text" note, for the app: a
 * handwritten nudge next to the one thing a first-time user should do.
 * Decorative, so screen readers get the text but not the arrow.
 */
export function SketchHint({ children, direction = "down", className }: SketchHintProps) {
  const arrow = ARROW[direction];
  const vertical = direction === "up" || direction === "down";
  const arrowEl = (
    <HandArrow
      variant={arrow.variant}
      className={cn("h-auto shrink-0 overflow-visible text-foreground/70", vertical ? "w-12" : "w-14", arrow.className)}
    />
  );
  const arrowFirst = direction === "up" || direction === "left";

  return (
    <p
      className={cn(
        "pointer-events-none flex select-none items-center gap-2 font-hand text-xl leading-tight text-foreground/80 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700",
        vertical && "flex-col",
        className,
      )}
    >
      {arrowFirst && arrowEl}
      <span className="-rotate-2">{children}</span>
      {!arrowFirst && arrowEl}
    </p>
  );
}
